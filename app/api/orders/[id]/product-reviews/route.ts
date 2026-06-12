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

async function ensureProfile(user: {
  id: string
  email?: string | null
  user_metadata?: {
    first_name?: string
    last_name?: string
    full_name?: string
    name?: string
    username?: string
  }
}) {
  const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileLookupError) {
    throw profileLookupError
  }

  if (existingProfile) {
    return
  }

  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
  const [fallbackFirstName, ...fallbackLastNameParts] = fullName.split(' ').filter(Boolean)

  const { error: insertProfileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email || null,
      username: user.user_metadata?.username || user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`,
      first_name: user.user_metadata?.first_name || fallbackFirstName || null,
      last_name: user.user_metadata?.last_name || fallbackLastNameParts.join(' ') || null,
      created_at: new Date().toISOString(),
    })

  if (insertProfileError) {
    throw insertProfileError
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/orders/[id]/product-reviews'>
) {
  const auth = await getUserFromRequest(request)

  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { id } = await context.params
    const orderId = Number(id)
    const body = await request.json()
    const rating = Number(body.rating)
    const comment = String(body.comment || '').trim()

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    await ensureProfile(auth.user)

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        user_id,
        order_status,
        order_items (
          product_id
        )
      `)
      .eq('id', orderId)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.order_status !== 'delivered') {
      return NextResponse.json({ error: 'Only delivered orders can be reviewed' }, { status: 400 })
    }

    const productIds = Array.from(
      new Set(
        (order.order_items || [])
          .map((item) => Number(item.product_id))
          .filter((productId) => Number.isInteger(productId) && productId > 0)
      )
    )

    if (productIds.length === 0) {
      return NextResponse.json({ created: 0 })
    }

    const { data: existingReviews, error: existingReviewsError } = await supabaseAdmin
      .from('reviews')
      .select('product_id')
      .eq('user_id', auth.user.id)
      .in('product_id', productIds)

    if (existingReviewsError) {
      return NextResponse.json({ error: existingReviewsError.message }, { status: 500 })
    }

    const reviewedProductIds = new Set((existingReviews || []).map((review) => Number(review.product_id)))
    const reviewComment = comment || `Rated from order #${orderId}.`
    const reviewsToInsert = productIds
      .filter((productId) => !reviewedProductIds.has(productId))
      .map((productId) => ({
        user_id: auth.user.id,
        product_id: productId,
        rating,
        comment: reviewComment,
        created_at: new Date().toISOString(),
      }))

    if (reviewsToInsert.length === 0) {
      return NextResponse.json({ created: 0 })
    }

    const { error: insertError } = await supabaseAdmin
      .from('reviews')
      .insert(reviewsToInsert)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ created: reviewsToInsert.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create product reviews'
    console.error('Order product review creation failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
