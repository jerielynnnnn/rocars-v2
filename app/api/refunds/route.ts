import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const REFUNDABLE_STATUSES = ['delivered']
const REFUND_REASONS: Record<string, string> = {
  not_delivered: 'Item not delivered',
  missing_item: 'Missing item',
  damaged_item: 'Damaged item',
  wrong_item: 'Wrong item received',
  defective_item: 'Defective item',
  other: 'Other refund request',
}

function isPermissionDenied(error: { message?: string } | null | undefined) {
  return error?.message?.toLowerCase().includes('permission denied') === true
}

function isSequencePermissionDenied(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() || ''
  return message.includes('permission denied') && message.includes('sequence')
}

function getProofUrls(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter((url): url is string => typeof url === 'string')
    .map((url) => url.trim())
    .filter((url) => url.startsWith('http://') || url.startsWith('https://'))
    .slice(0, 5)
}

function buildReasonWithProofs(reason: string, proofUrls: string[]) {
  if (proofUrls.length === 0) return reason

  return `${reason}\n\n[PROOFS:${JSON.stringify(proofUrls)}]`
}

async function insertFallbackRefundRequest(payload: {
  order_id: number
  user_id: string
  reason: string
  status: string
  created_at: string
  updated_at: string
}) {
  const { data, error } = await supabaseAdmin
    .from('cancellation_requests')
    .insert(payload)
    .select('id, status')
    .single()

  if (!isSequencePermissionDenied(error)) {
    return { data, error }
  }

  const { data: latestRequest, error: latestRequestError } = await supabaseAdmin
    .from('cancellation_requests')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestRequestError) {
    return { request: null, error: latestRequestError }
  }

  return supabaseAdmin
    .from('cancellation_requests')
    .insert({
      id: Number(latestRequest?.id || 0) + 1,
      ...payload,
    })
    .select('id, status')
    .single()
}

async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null

  if (!token) {
    return { error: 'No token provided', status: 401 as const }
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { error: 'Invalid token', status: 401 as const }
  }

  return { user }
}

export async function POST(request: NextRequest) {
  const auth = await getUserFromRequest(request)

  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const orderId = Number(body.orderId)
    const reasonType = String(body.reasonType || 'other')
    const details = String(body.details || '').trim()
    const proofUrls = getProofUrls(body.proofUrls)

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
    }

    if (!details) {
      return NextResponse.json({ error: 'Please describe the refund issue' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, order_status, payment_status, total_amount, payment_method')
      .eq('id', orderId)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!REFUNDABLE_STATUSES.includes(order.order_status)) {
      return NextResponse.json(
        { error: 'Refund requests are available after an order is delivered' },
        { status: 400 }
      )
    }

    if (order.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Only paid orders can be submitted for refund review' },
        { status: 400 }
      )
    }

    const { data: existingRefund, error: existingRefundError } = await supabaseAdmin
      .from('refunds')
      .select('id, refund_status')
      .eq('order_id', orderId)
      .in('refund_status', ['pending', 'approved'])
      .maybeSingle()

    if (existingRefundError) {
      if (!isPermissionDenied(existingRefundError)) {
        return NextResponse.json({ error: existingRefundError.message }, { status: 500 })
      }

      const { data: existingFallbackRequest, error: existingFallbackError } = await supabaseAdmin
        .from('cancellation_requests')
        .select('id, status, reason')
        .eq('order_id', orderId)
        .in('status', ['pending', 'approved'])

      if (existingFallbackError) {
        return NextResponse.json({ error: existingFallbackError.message }, { status: 500 })
      }

      const hasActiveRefundRequest = existingFallbackRequest?.some((request) =>
        String(request.reason || '').startsWith('[REFUND:')
      )

      if (hasActiveRefundRequest) {
        return NextResponse.json(
          { error: 'This order already has an active refund request' },
          { status: 409 }
        )
      }
    }

    if (existingRefund) {
      return NextResponse.json(
        { error: `This order already has a ${existingRefund.refund_status} refund request` },
        { status: 409 }
      )
    }

    const reasonLabel = REFUND_REASONS[reasonType] || REFUND_REASONS.other
    const reason = buildReasonWithProofs(`${reasonLabel}: ${details}`, proofUrls)

    const { data: refund, error: refundError } = await supabaseAdmin
      .from('refunds')
      .insert({
        order_id: orderId,
        user_id: auth.user.id,
        reason,
        refund_status: 'pending',
        admin_response: null,
        created_at: new Date().toISOString(),
      })
      .select('id, refund_status')
      .single()

    if (refundError) {
      if (!isPermissionDenied(refundError)) {
        return NextResponse.json({ error: refundError.message }, { status: 500 })
      }

      const fallbackReason = buildReasonWithProofs(`[REFUND:${reasonType}] ${details}`, proofUrls)
      const { data: fallbackRequest, error: fallbackError } = await insertFallbackRefundRequest({
        order_id: orderId,
        user_id: auth.user.id,
        reason: fallbackReason,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 })
      }

      await supabaseAdmin.from('notifications').insert({
        user_id: auth.user.id,
        title: 'Refund Request Submitted',
        message: `Your refund request for order #${orderId} has been submitted for review.`,
        type: 'general',
        is_read: false,
        created_at: new Date().toISOString(),
      })

      await supabaseAdmin
        .from('admin_notifications')
        .insert({
          type: 'pending_refund',
          title: 'New Refund Request',
          message: `Order #${orderId} has a refund request: ${reasonLabel}.`,
          link: '/admin/refunds',
          is_read: false,
          metadata: {
            order_id: orderId,
            refund_id: fallbackRequest.id,
            source: 'cancellation_requests',
            reason_type: reasonType,
            amount: order.total_amount,
            payment_method: order.payment_method,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      return NextResponse.json({
        refund: {
          id: fallbackRequest.id,
          refund_status: fallbackRequest.status,
          source: 'cancellation_requests',
        },
      })
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: auth.user.id,
      title: 'Refund Request Submitted',
      message: `Your refund request for order #${orderId} has been submitted for review.`,
      type: 'general',
      is_read: false,
      created_at: new Date().toISOString(),
    })

    const { error: adminNotificationError } = await supabaseAdmin
      .from('admin_notifications')
      .insert({
        type: 'pending_refund',
        title: 'New Refund Request',
        message: `Order #${orderId} has a refund request: ${reasonLabel}.`,
        link: '/admin/refunds',
        is_read: false,
        metadata: {
          order_id: orderId,
          refund_id: refund.id,
          reason_type: reasonType,
          amount: order.total_amount,
          payment_method: order.payment_method,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (adminNotificationError) {
      console.error('Refund admin notification failed (ignored):', adminNotificationError)
    }

    return NextResponse.json({ refund })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit refund request'
    console.error('Refund request failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
