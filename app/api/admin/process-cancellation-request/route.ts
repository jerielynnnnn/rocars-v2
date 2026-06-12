import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminLikeRole } from '@/lib/admin-role'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

function serializeSupabaseError(error: unknown) {
  const supabaseError =
    error && typeof error === 'object'
      ? error as {
          message?: string
          code?: string
          details?: string
          hint?: string
        }
      : null

  return {
    message: supabaseError?.message,
    code: supabaseError?.code,
    details: supabaseError?.details,
    hint: supabaseError?.hint,
  }
}

async function createPendingRefundForPaidCancellation({
  orderId,
  userId,
  reason,
  adminNotes,
}: {
  orderId: number
  userId: string
  reason: string
  adminNotes?: string | null
}) {
  const { data: existingRefund, error: existingRefundError } = await supabaseAdmin
    .from('refunds')
    .select('id, refund_status')
    .eq('order_id', orderId)
    .maybeSingle()

  if (existingRefundError) {
    throw existingRefundError
  }

  if (existingRefund) {
    return { refund: existingRefund, created: false }
  }

  const { data: refund, error: refundError } = await supabaseAdmin
    .from('refunds')
    .insert({
      order_id: orderId,
      user_id: userId,
      reason: `Cancellation approved: ${reason}`,
      refund_status: 'pending',
      admin_response: adminNotes || null,
      created_at: new Date().toISOString(),
    })
    .select('id, refund_status')
    .single()

  if (refundError) {
    throw refundError
  }

  return { refund, created: true }
}

export async function POST(request: NextRequest) {
  try {
    // ========================
    // 1. AUTH CHECK
    // ========================
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }

    const { data: { user }, error: userError } =
      await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // ========================
    // 2. CHECK ADMIN ROLE
    // ========================
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    if (!isAdminLikeRole(profile?.role)) {
      return NextResponse.json(
        { error: 'Admin or staff access required' },
        { status: 403 }
      )
    }

    const supabaseWithAdminAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    // ========================
    // 3. REQUEST BODY
    // ========================
    const body = await request.json()
    const { requestId, action, adminNotes } = body

    if (!requestId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request payload' },
        { status: 400 }
      )
    }

    // ========================
    // 4. GET REQUEST
    // ========================
    const { data: cancellationRequest, error: requestError } = await supabaseAdmin
      .from('cancellation_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single()

    if (requestError || !cancellationRequest) {
      return NextResponse.json(
        { error: 'Request not found or already processed' },
        { status: 404 }
      )
    }

    // ========================
    // 5. APPROVE FLOW
    // ========================
    const now = new Date().toISOString()
    let refundCreated = false
    let refundId: number | null = null

    if (action === 'approve') {
      const { data: orderToCancel, error: orderLookupError } = await supabaseAdmin
        .from('orders')
        .select('id, user_id, total_amount, payment_status, payment_method')
        .eq('id', cancellationRequest.order_id)
        .single()

      if (orderLookupError || !orderToCancel) {
        const details = serializeSupabaseError(orderLookupError)
        console.error('Failed to load order for cancellation request:', {
          requestId,
          orderId: cancellationRequest.order_id,
          details,
        })

        return NextResponse.json(
          {
            error: details.message || 'Failed to load order',
            details,
          },
          { status: 500 }
        )
      }

      // 5.1 Update order FIRST (safe fail point)
      const { data: updatedOrder, error: orderError } = await supabaseWithAdminAuth
        .from('orders')
        .update({
          order_status: 'cancelled',
          cancelled_at: now,
          cancellation_reason: cancellationRequest.reason,
          updated_at: now,
        })
        .eq('id', cancellationRequest.order_id)
        .select('id')
        .single()

      if (orderError || !updatedOrder) {
        const details = serializeSupabaseError(orderError)
        console.error('Failed to update order for cancellation request:', {
          requestId,
          orderId: cancellationRequest.order_id,
          details,
        })

        return NextResponse.json(
          {
            error: details.message || 'Failed to update order',
            details,
          },
          { status: 500 }
        )
      }

      // 5.2 If the order was already paid, create a pending refund workflow.
      if (orderToCancel.payment_status === 'paid') {
        try {
          const refundResult = await createPendingRefundForPaidCancellation({
            orderId: orderToCancel.id,
            userId: orderToCancel.user_id,
            reason: cancellationRequest.reason,
            adminNotes,
          })

          refundCreated = refundResult.created
          refundId = refundResult.refund?.id || null

          if (refundCreated) {
            const { error: adminNotificationError } = await supabaseAdmin
              .from('admin_notifications')
              .insert({
                type: 'pending_refund',
                title: 'Refund Required',
                message: `Order #${orderToCancel.id} was paid and cancelled. Review refund request #${refundId}.`,
                link: '/admin/refunds',
                is_read: false,
                metadata: {
                  order_id: orderToCancel.id,
                  refund_id: refundId,
                  amount: orderToCancel.total_amount,
                  payment_method: orderToCancel.payment_method,
                },
                created_at: now,
                updated_at: now,
              })

            if (adminNotificationError) {
              console.error('Pending refund admin notification failed (ignored):', adminNotificationError)
            }
          }
        } catch (refundErr) {
          const details = serializeSupabaseError(refundErr)
          console.error('Failed to create pending refund for paid cancellation:', {
            requestId,
            orderId: cancellationRequest.order_id,
            details,
          })

          if (!details.message?.toLowerCase().includes('permission denied')) {
            return NextResponse.json(
              {
                error: details.message || 'Order cancelled, but refund creation failed',
                details,
              },
              { status: 500 }
            )
          }
        }
      }

      // 5.2 Restore stock (SAFE LOOP - NEVER FAIL REQUEST)
      try {
        const { data: items } = await supabaseAdmin
          .from('order_items')
          .select('product_id, quantity')
          .eq('order_id', cancellationRequest.order_id)

        if (items?.length) {
          for (const item of items) {
            const { data: product } = await supabaseAdmin
              .from('products')
              .select('stock')
              .eq('id', item.product_id)
              .single()

            if (product) {
              await supabaseAdmin
                .from('products')
                .update({
                  stock: (product.stock || 0) + item.quantity,
                })
                .eq('id', item.product_id)
            }
          }
        }
      } catch (stockErr) {
        console.error('Stock restore failed (ignored):', stockErr)
      }

      // 5.3 Notification (SAFE)
      try {
        await supabaseAdmin.from('notifications').insert({
          user_id: cancellationRequest.user_id,
          title: 'Cancellation Approved',
          message: refundId
            ? `Your order #${cancellationRequest.order_id} has been cancelled. A refund request has been created and is waiting for processing.`
            : `Your order #${cancellationRequest.order_id} has been cancelled.`,
          type: 'general',
        })
      } catch (notifErr) {
        console.error('Notification failed (ignored):', notifErr)
      }
    }

    // ========================
    // 6. REJECT FLOW
    // ========================
    if (action === 'reject') {
      try {
        await supabaseAdmin.from('notifications').insert({
          user_id: cancellationRequest.user_id,
          title: 'Cancellation Rejected',
          message: `Your cancellation request for order #${cancellationRequest.order_id} was rejected.${adminNotes ? ` Reason: ${adminNotes}` : ''}`,
          type: 'general',
        })
      } catch (err) {
        console.error('Reject notification failed:', err)
      }
    }

    // ========================
    // 7. UPDATE REQUEST STATUS
    // ========================
    const { error: updateError } = await supabaseAdmin
      .from('cancellation_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        admin_notes: adminNotes || null,
        processed_at: now,
        processed_by: user.id,
        updated_at: now,
      })
      .eq('id', requestId)

    if (updateError) {
      const details = serializeSupabaseError(updateError)
      console.error('Failed to update cancellation request:', {
        requestId,
        details,
      })

      return NextResponse.json(
        {
          error: details.message || 'Failed to update request',
          details,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Cancellation ${action}d successfully`,
      refundCreated,
      refundId,
    })
  } catch (error: unknown) {
    console.error('Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
