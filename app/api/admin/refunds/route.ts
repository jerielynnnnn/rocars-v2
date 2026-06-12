import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminLikeRole } from '@/lib/admin-role'
import { supabaseAdmin } from '@/lib/supabase-admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function isPermissionDenied(error: { message?: string } | null | undefined) {
  return error?.message?.toLowerCase().includes('permission denied') === true
}

function isCancelledOrderLocked(error: { message?: string } | null | undefined) {
  return error?.message?.toLowerCase().includes('cancelled orders are locked') === true
}

function getFallbackRefundStatusFromNotes(adminNotes: string | null | undefined) {
  const statusMatch = String(adminNotes || '').match(/\[REFUND_STATUS:(approved|completed|rejected|pending)\]/)
  return statusMatch?.[1] || null
}

function stripFallbackRefundStatusMarker(adminNotes: string | null | undefined) {
  return String(adminNotes || '').replace(/\[REFUND_STATUS:(approved|completed|rejected|pending)\]\s*/, '').trim() || null
}

function buildFallbackAdminNotes(status: string, adminResponse: string | null) {
  return `[REFUND_STATUS:${status}] ${adminResponse || ''}`.trim()
}

async function requireStaff(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null

  if (!token) {
    return { error: 'No token provided', status: 401 as const }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token)

  if (userError || !user) {
    return { error: 'Invalid token', status: 401 as const }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || !isAdminLikeRole(profile.role)) {
    return { error: 'Admin or staff access required', status: 403 as const }
  }

  return { user }
}

function mapFallbackStatus(
  requestStatus: string,
  order?: { payment_status?: string; order_status?: string } | null,
  adminNotes?: string | null
) {
  const refundStatus = getFallbackRefundStatusFromNotes(adminNotes)
  if (refundStatus) return refundStatus

  if (order?.payment_status === 'refunded' || order?.order_status === 'refunded') {
    return 'completed'
  }

  if (requestStatus === 'rejected') return 'rejected'
  if (requestStatus === 'approved') return 'pending'
  return 'pending'
}

function formatFallbackReason(reason: string) {
  const refundMatch = reason.match(/^\[REFUND:([^\]]+)\]\s*(.*)$/)

  if (!refundMatch) {
    return `Cancellation approved: ${reason}`
  }

  const reasonType = refundMatch[1].replace(/_/g, ' ')
  const details = refundMatch[2] || ''

  return `${reasonType.charAt(0).toUpperCase()}${reasonType.slice(1)}: ${details}`
}

async function getRefundsFromCancellationRequests(status: string, page: number, pageSize: number) {
  const { data: requests, error: requestsError } = await supabaseAdmin
    .from('cancellation_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (requestsError) {
    return NextResponse.json({ error: requestsError.message }, { status: 500 })
  }

  if (!requests || requests.length === 0) {
    return NextResponse.json({ refunds: [], total: 0, source: 'cancellation_requests' })
  }

  const orderIds = Array.from(new Set(requests.map((request) => request.order_id).filter(Boolean)))
  const userIds = Array.from(new Set(requests.map((request) => request.user_id).filter(Boolean)))

  const [{ data: ordersData, error: ordersError }, { data: profilesData, error: profilesError }] =
    await Promise.all([
      orderIds.length > 0
        ? supabaseAdmin
            .from('orders')
            .select('id, total_amount, order_status, payment_status, payment_method, created_at, user_id')
            .in('id', orderIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length > 0
        ? supabaseAdmin
            .from('profiles')
            .select('id, first_name, last_name, email')
            .in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
    ])

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 })
  }

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 })
  }

  const ordersMap = new Map((ordersData || []).map((order) => [order.id, order]))
  const profilesMap = new Map((profilesData || []).map((profile) => [profile.id, profile]))
  const fallbackRefunds = requests
    .filter((request) => {
      const reason = String(request.reason || '')
      const order = ordersMap.get(request.order_id)
      return reason.startsWith('[REFUND:')
        || (request.status === 'approved' && order?.payment_status === 'paid')
        || order?.payment_status === 'refunded'
        || order?.order_status === 'refunded'
    })
    .map((request) => {
      const order = ordersMap.get(request.order_id) || null
      const refundStatus = mapFallbackStatus(request.status, order, request.admin_notes)

      return {
        id: request.id,
        order_id: request.order_id,
        user_id: request.user_id,
        reason: formatFallbackReason(String(request.reason || 'Refund review required')),
        refund_status: refundStatus,
        admin_response: stripFallbackRefundStatusMarker(request.admin_notes),
        created_at: request.created_at,
        order,
        user: profilesMap.get(request.user_id) || null,
        source: 'cancellation_requests',
      }
    })
    .filter((refund) => status === 'all' || refund.refund_status === status)

  const from = (page - 1) * pageSize
  const to = from + pageSize

  return NextResponse.json({
    refunds: fallbackRefunds.slice(from, to),
    total: fallbackRefunds.length,
    source: 'cancellation_requests',
    warning: 'Refunds table is not readable; showing refund workflow data from cancellation requests.',
  })
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request)

  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const status = request.nextUrl.searchParams.get('status') || 'all'
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || '1'))
  const pageSize = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('pageSize') || '10')))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabaseAdmin
    .from('refunds')
    .select('*', { count: 'exact' })

  if (status !== 'all') {
    query = query.eq('refund_status', status)
  }

  const { data: refundsData, error: refundsError, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (refundsError) {
    if (isPermissionDenied(refundsError)) {
      return getRefundsFromCancellationRequests(status, page, pageSize)
    }

    return NextResponse.json({ error: refundsError.message }, { status: 500 })
  }

  if (!refundsData || refundsData.length === 0) {
    return NextResponse.json({ refunds: [], total: count || 0 })
  }

  const orderIds = Array.from(new Set(refundsData.map((refund) => refund.order_id).filter(Boolean)))
  const userIds = Array.from(new Set(refundsData.map((refund) => refund.user_id).filter(Boolean)))

  const [{ data: ordersData, error: ordersError }, { data: profilesData, error: profilesError }] =
    await Promise.all([
      orderIds.length > 0
        ? supabaseAdmin
            .from('orders')
            .select('id, total_amount, order_status, payment_status, payment_method, created_at, user_id')
            .in('id', orderIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length > 0
        ? supabaseAdmin
            .from('profiles')
            .select('id, first_name, last_name, email')
            .in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
    ])

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 })
  }

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 })
  }

  const ordersMap = new Map((ordersData || []).map((order) => [order.id, order]))
  const profilesMap = new Map((profilesData || []).map((profile) => [profile.id, profile]))

  const refunds = refundsData.map((refund) => ({
    ...refund,
    order: ordersMap.get(refund.order_id) || null,
    user: profilesMap.get(refund.user_id) || null,
  }))

  return NextResponse.json({ refunds, total: count || 0 })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireStaff(request)

  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const refundId = Number(body.refundId)
    const newStatus = String(body.status || '')
    const adminResponse = typeof body.adminResponse === 'string'
      ? body.adminResponse.trim()
      : null

    if (!Number.isInteger(refundId) || refundId <= 0) {
      return NextResponse.json({ error: 'Invalid refund id' }, { status: 400 })
    }

    if (!['pending', 'approved', 'rejected', 'completed'].includes(newStatus)) {
      return NextResponse.json({ error: 'Invalid refund status' }, { status: 400 })
    }

    const { data: refund, error: refundLookupError } = await supabaseAdmin
      .from('refunds')
      .select('*')
      .eq('id', refundId)
      .single()

    if (refundLookupError || !refund) {
      if (isPermissionDenied(refundLookupError)) {
        const { data: fallbackRequest, error: fallbackLookupError } = await supabaseAdmin
          .from('cancellation_requests')
          .select('*')
          .eq('id', refundId)
          .single()

        if (fallbackLookupError || !fallbackRequest) {
          return NextResponse.json(
            { error: fallbackLookupError?.message || 'Refund request not found' },
            { status: 404 }
          )
        }

        return processFallbackRefundRequest({
          request: fallbackRequest,
          newStatus,
          adminResponse,
        })
      }

      return NextResponse.json(
        { error: refundLookupError?.message || 'Refund request not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, string | null> = {
      refund_status: newStatus,
    }

    if (adminResponse !== null) {
      updateData.admin_response = adminResponse
    }

    const { error: refundUpdateError } = await supabaseAdmin
      .from('refunds')
      .update(updateData)
      .eq('id', refundId)

    if (refundUpdateError) {
      return NextResponse.json({ error: refundUpdateError.message }, { status: 500 })
    }

    const now = new Date().toISOString()

    if (newStatus === 'approved' || newStatus === 'completed') {
      const { data: refundOrder, error: refundOrderError } = await supabaseAdmin
        .from('orders')
        .select('id, order_status')
        .eq('id', refund.order_id)
        .maybeSingle()

      if (refundOrderError) {
        return NextResponse.json({ error: refundOrderError.message }, { status: 500 })
      }

      if (refundOrder?.order_status !== 'cancelled') {
        const orderUpdate: Record<string, string> = {
          order_status: 'refunded',
          payment_status: 'refunded',
          updated_at: now,
        }

        if (newStatus === 'approved') {
          orderUpdate.refund_approved_at = now
        }

        const { error: orderUpdateError } = await supabaseAdmin
          .from('orders')
          .update(orderUpdate)
          .eq('id', refund.order_id)

        if (orderUpdateError && !isCancelledOrderLocked(orderUpdateError)) {
          return NextResponse.json({ error: orderUpdateError.message }, { status: 500 })
        }
      }

      const { error: paymentUpdateError } = await supabaseAdmin
        .from('payments')
        .update({ payment_status: 'refunded' })
        .eq('order_id', refund.order_id)

      if (paymentUpdateError && !paymentUpdateError.message.toLowerCase().includes('permission denied')) {
        return NextResponse.json({ error: paymentUpdateError.message }, { status: 500 })
      }

      await supabaseAdmin
        .from('order_status_history')
        .insert({
          order_id: refund.order_id,
          status: 'refunded',
          notes: `Refund ${newStatus}${adminResponse ? `: ${adminResponse}` : ''}`,
        })
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: refund.user_id,
      title: `Refund ${newStatus.charAt(0).toUpperCase()}${newStatus.slice(1)}`,
      message: `Your refund request for order #${refund.order_id} was ${newStatus}.${adminResponse ? ` ${adminResponse}` : ''}`,
      type: 'general',
      is_read: false,
      created_at: now,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update refund'
    console.error('Admin refund update failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function processFallbackRefundRequest({
  request,
  newStatus,
  adminResponse,
}: {
  request: {
    id: number
    order_id: number
    user_id: string
  }
  newStatus: string
  adminResponse: string | null
}) {
  const now = new Date().toISOString()
  const requestStatus = newStatus === 'rejected' ? 'rejected' : 'approved'

  const { error: requestUpdateError } = await supabaseAdmin
    .from('cancellation_requests')
    .update({
      status: requestStatus,
      admin_notes: buildFallbackAdminNotes(newStatus, adminResponse),
      processed_at: now,
      updated_at: now,
    })
    .eq('id', request.id)

  if (requestUpdateError) {
    return NextResponse.json({ error: requestUpdateError.message }, { status: 500 })
  }

  if (newStatus === 'approved' || newStatus === 'completed') {
    const { data: refundOrder, error: refundOrderError } = await supabaseAdmin
      .from('orders')
      .select('id, order_status')
      .eq('id', request.order_id)
      .maybeSingle()

    if (refundOrderError) {
      return NextResponse.json({ error: refundOrderError.message }, { status: 500 })
    }

    if (refundOrder?.order_status !== 'cancelled') {
      const { error: orderUpdateError } = await supabaseAdmin
        .from('orders')
        .update({
          order_status: 'refunded',
          payment_status: 'refunded',
          refund_approved_at: now,
          updated_at: now,
        })
        .eq('id', request.order_id)

      if (orderUpdateError && !isCancelledOrderLocked(orderUpdateError)) {
        return NextResponse.json({ error: orderUpdateError.message }, { status: 500 })
      }
    }

    const { error: paymentUpdateError } = await supabaseAdmin
      .from('payments')
      .update({ payment_status: 'refunded' })
      .eq('order_id', request.order_id)

    if (paymentUpdateError && !isPermissionDenied(paymentUpdateError)) {
      console.error('Fallback refund payment update failed (ignored):', paymentUpdateError)
    }

    await supabaseAdmin
      .from('order_status_history')
      .insert({
        order_id: request.order_id,
        status: 'refunded',
        notes: `Refund ${newStatus}${adminResponse ? `: ${adminResponse}` : ''}`,
      })
  }

  await supabaseAdmin.from('notifications').insert({
    user_id: request.user_id,
    title: `Refund ${newStatus.charAt(0).toUpperCase()}${newStatus.slice(1)}`,
    message: `Your refund request for order #${request.order_id} was ${newStatus}.${adminResponse ? ` ${adminResponse}` : ''}`,
    type: 'general',
    is_read: false,
    created_at: now,
  })

  return NextResponse.json({ success: true, source: 'cancellation_requests' })
}
