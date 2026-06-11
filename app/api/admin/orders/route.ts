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

async function getCancellationRequests() {
  const { data: requests, error: requestsError } = await supabaseAdmin
    .from('cancellation_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (requestsError) {
    throw requestsError
  }

  if (!requests || requests.length === 0) {
    return []
  }

  const orderIds = requests.map((request) => request.order_id)
  const userIds = requests.map((request) => request.user_id)

  const [{ data: orders, error: ordersError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabaseAdmin
        .from('orders')
        .select('id, total_amount, payment_status, order_status, user_id')
        .in('id', orderIds),
      supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds),
    ])

  if (ordersError) {
    throw ordersError
  }

  if (profilesError) {
    console.error('Admin orders API profile fetch failed:', profilesError)
  }

  return requests.map((request) => ({
    ...request,
    orders: orders?.find((order) => order.id === request.order_id),
    profiles: profiles?.find((profile) => profile.id === request.user_id),
  }))
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request)

  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const orderId = request.nextUrl.searchParams.get('orderId')

  try {
    if (orderId) {
      const parsedOrderId = Number(orderId)

      if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
        return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
      }

      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', parsedOrderId)
        .single()

      if (orderError) {
        return NextResponse.json({ error: orderError.message }, { status: 500 })
      }

      const [{ data: items, error: itemsError }, { data: address }, { data: profile }] =
        await Promise.all([
          supabaseAdmin
            .from('order_items')
            .select(`
              *,
              products (
                name,
                sku,
                brand
              )
            `)
            .eq('order_id', parsedOrderId),
          order?.address_id
            ? supabaseAdmin
                .from('addresses')
                .select('*')
                .eq('id', order.address_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          supabaseAdmin
            .from('profiles')
            .select('id, first_name, last_name, username, email, phone_number')
            .eq('id', order.user_id)
            .maybeSingle(),
        ])

      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }

      return NextResponse.json({
        order,
        items: items || [],
        address: address || null,
        profile: profile || null,
      })
    }

    const [{ data: orders, error: ordersError }, cancellationRequests] =
      await Promise.all([
        supabaseAdmin
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false }),
        getCancellationRequests(),
      ])

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 })
    }

    return NextResponse.json({
      orders: orders || [],
      cancellationRequests,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch orders'
    console.error('Admin orders API fetch failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
