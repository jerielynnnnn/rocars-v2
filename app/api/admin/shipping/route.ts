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

interface OrderItemRow {
  quantity: number
  products?: {
    name?: string | null
  } | null
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

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request)

  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: ordersData, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('*')
    .or('order_status.eq.processing,order_status.eq.shipped')
    .order('created_at', { ascending: true })

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 })
  }

  if (!ordersData || ordersData.length === 0) {
    return NextResponse.json({ orders: [] })
  }

  const orders = await Promise.all(
    ordersData.map(async (order) => {
      const [{ data: profileData }, { data: itemsData }] = await Promise.all([
        supabaseAdmin
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', order.user_id)
          .maybeSingle(),
        supabaseAdmin
          .from('order_items')
          .select(`
            quantity,
            products (
              name
            )
          `)
          .eq('order_id', order.id),
      ])

      const items = ((itemsData || []) as OrderItemRow[]).map((item) => ({
        name: item.products?.name || 'Unknown Product',
        quantity: item.quantity,
        weight: 0,
      }))

      return {
        id: order.id,
        user_id: order.user_id,
        customer_name: profileData
          ? `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || 'Customer'
          : 'Customer',
        customer_email: profileData?.email || '',
        items,
        total_weight: 0,
        shipping_address: order.shipping_address || 'No address provided',
        order_status: order.order_status,
        tracking_number: order.tracking_number,
        carrier: order.carrier,
        shipping_label_url: order.shipping_label_url,
        created_at: order.created_at,
      }
    })
  )

  return NextResponse.json({ orders })
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request)

  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { orderId, trackingNumber, carrier, courierLabel } = await request.json()

  if (!orderId || !trackingNumber || !carrier) {
    return NextResponse.json(
      { error: 'Order ID, tracking number, and carrier are required' },
      { status: 400 }
    )
  }

  const estimatedDeliveryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      tracking_number: trackingNumber,
      carrier,
      order_status: 'shipped',
      updated_at: nowIso(),
      estimated_delivery_date: estimatedDeliveryDate,
    })
    .eq('id', orderId)
    .select('id, user_id')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await supabaseAdmin
    .from('order_status_history')
    .insert({
      order_id: orderId,
      status: 'shipped',
      notes: `Shipped via ${courierLabel || carrier}. Tracking: ${trackingNumber}`,
      created_at: nowIso(),
    })

  if (updatedOrder?.user_id) {
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: updatedOrder.user_id,
        title: 'Your Order Has Shipped!',
        message: `Order #${orderId} has been shipped via ${courierLabel || carrier}. Tracking: ${trackingNumber}`,
        is_read: false,
        created_at: nowIso(),
      })
  }

  return NextResponse.json({ success: true })
}
