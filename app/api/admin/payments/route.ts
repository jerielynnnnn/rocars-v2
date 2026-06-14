import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminLikeRole } from '@/lib/admin-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { nowIso } from '@/lib/time'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

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

async function getRefundedOrderIds() {
  const refundedOrderIds = new Set<number>()

  const { data: refundsData, error: refundsError } = await supabaseAdmin
    .from('refunds')
    .select('order_id')
    .in('refund_status', ['approved', 'completed'])

  if (!refundsError) {
    for (const refund of refundsData || []) {
      if (refund.order_id) {
        refundedOrderIds.add(Number(refund.order_id))
      }
    }
  }

  const { data: fallbackRequests, error: fallbackError } = await supabaseAdmin
    .from('cancellation_requests')
    .select('order_id, admin_notes')
    .in('status', ['approved'])

  if (!fallbackError) {
    for (const request of fallbackRequests || []) {
      if (
        request.order_id
        && String(request.admin_notes || '').match(/\[REFUND_STATUS:(approved|completed)\]/)
      ) {
        refundedOrderIds.add(Number(request.order_id))
      }
    }
  }

  return refundedOrderIds
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request)

  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const refundedOrderIds = await getRefundedOrderIds()

  const { data: revenueOrders, error: revenueOrdersError } = await supabaseAdmin
    .from('orders')
    .select('id, total_amount')
    .eq('payment_status', 'paid')

  if (revenueOrdersError) {
    return NextResponse.json({ error: revenueOrdersError.message }, { status: 500 })
  }

  const totalRevenue = (revenueOrders || [])
    .filter((order) => !refundedOrderIds.has(Number(order.id)))
    .reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0
    )

  const { data: paymentsData, error: paymentsError } = await supabaseAdmin
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })

  if (paymentsError) {
    if (paymentsError.message.toLowerCase().includes('permission denied')) {
      return getPaymentsFromOrders()
    }

    return NextResponse.json({ error: paymentsError.message }, { status: 500 })
  }

  if (!paymentsData || paymentsData.length === 0) {
    return NextResponse.json({ payments: [], totalRevenue })
  }

  const orderIds = Array.from(
    new Set(paymentsData.map((payment) => payment.order_id).filter(Boolean))
  )

  const { data: ordersData, error: ordersError } = orderIds.length > 0
    ? await supabaseAdmin
        .from('orders')
        .select('id, payment_method, total_amount, payment_status, order_status, user_id')
        .in('id', orderIds)
    : { data: [], error: null }

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 })
  }

  const ordersMap = new Map((ordersData || []).map((order) => [order.id, order]))
  const userIds = Array.from(
    new Set(Array.from(ordersMap.values()).map((order) => order.user_id).filter(Boolean))
  )

  const { data: profilesData, error: profilesError } = userIds.length > 0
    ? await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds)
    : { data: [], error: null }

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 })
  }

  const profilesMap = new Map((profilesData || []).map((profile) => [profile.id, profile]))
  const payments = paymentsData.map((payment) => {
    const order = ordersMap.get(payment.order_id) || null
    const customer = order ? profilesMap.get(order.user_id) || null : null

    return {
      ...payment,
      order,
      customer,
    }
  })

  return NextResponse.json({ payments, totalRevenue })
}

async function getPaymentsFromOrders() {
  const refundedOrderIds = await getRefundedOrderIds()

  const { data: ordersData, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      user_id,
      payment_method,
      payment_provider,
      payment_transaction_id,
      payment_status,
      order_status,
      total_amount,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false })

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 })
  }

  if (!ordersData || ordersData.length === 0) {
    return NextResponse.json({ payments: [] })
  }

  const userIds = Array.from(new Set(ordersData.map((order) => order.user_id).filter(Boolean)))
  const { data: profilesData, error: profilesError } = userIds.length > 0
    ? await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds)
    : { data: [], error: null }

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 })
  }

  const profilesMap = new Map((profilesData || []).map((profile) => [profile.id, profile]))
  const payments = ordersData.map((order) => ({
    id: order.id,
    order_id: order.id,
    payment_provider: order.payment_provider || order.payment_method || 'order',
    transaction_id: order.payment_transaction_id || `order-${order.id}`,
    amount: order.total_amount,
    payment_status: order.payment_status || 'pending',
    paid_at: order.payment_status === 'paid' ? order.updated_at || order.created_at : null,
    created_at: order.created_at,
    order: {
      id: order.id,
      payment_method: order.payment_method,
      total_amount: order.total_amount,
      payment_status: order.payment_status,
      order_status: order.order_status,
      user_id: order.user_id,
    },
    customer: profilesMap.get(order.user_id) || null,
    source: 'orders',
  }))

  return NextResponse.json({
    payments,
    totalRevenue: payments
      .filter((payment) => payment.payment_status === 'paid')
      .filter((payment) => !refundedOrderIds.has(Number(payment.order_id)))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    warning: 'Payments table is not readable by the service role; showing order payment data instead.',
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request)

  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { paymentId, newStatus, orderId } = await request.json()

  if (!paymentId || !newStatus) {
    return NextResponse.json({ error: 'Payment ID and status are required' }, { status: 400 })
  }

  const updateData: Record<string, string | null> = {
    payment_status: newStatus,
  }

  if (newStatus === 'paid') {
    updateData.paid_at = nowIso()
  }

  const effectiveOrderId = orderId || paymentId
  let paymentsTableUnavailable = false

  const { error: paymentError } = await supabaseAdmin
    .from('payments')
    .update(updateData)
    .eq('id', paymentId)

  if (paymentError) {
    paymentsTableUnavailable = true
    console.error('Payments table update failed; falling back to orders payment fields:', paymentError)
  }

  if (effectiveOrderId) {
    const orderUpdate: Record<string, string | undefined> =
      newStatus === 'paid'
        ? {
            payment_status: 'paid',
            order_status: 'processing',
            updated_at: nowIso(),
          }
        : {
            payment_status: newStatus,
            order_status: newStatus === 'failed' ? 'pending_payment' : undefined,
            updated_at: nowIso(),
          }

    Object.keys(orderUpdate).forEach((key) => {
      if (orderUpdate[key] === undefined) {
        delete orderUpdate[key]
      }
    })

    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .update(orderUpdate)
      .eq('id', effectiveOrderId)

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    if (newStatus === 'paid') {
      await supabaseAdmin
        .from('order_status_history')
        .insert({
          order_id: effectiveOrderId,
          status: 'processing',
          notes: 'Payment confirmed, order is now processing',
      })
    }
  }

  if (!effectiveOrderId && paymentsTableUnavailable) {
    return NextResponse.json(
      { error: 'Payment table is unavailable and no order id was provided for fallback update' },
      { status: 500 }
    )
  }

  if (effectiveOrderId && (newStatus === 'paid' || newStatus === 'failed')) {
    const { data: orderData } = await supabaseAdmin
      .from('orders')
      .select('user_id')
      .eq('id', effectiveOrderId)
      .maybeSingle()

    if (orderData?.user_id) {
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: orderData.user_id,
          title: newStatus === 'paid' ? 'Payment Confirmed' : 'Payment Failed',
          message: newStatus === 'paid'
            ? `Your payment for order #${effectiveOrderId} has been confirmed. Your order is now being processed.`
            : `Your payment for order #${effectiveOrderId} has failed. Please try again or contact support.`,
          is_read: false,
          type: 'general',
          created_at: nowIso(),
        })
    }
  }

  return NextResponse.json({ success: true })
}
