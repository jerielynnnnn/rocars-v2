import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

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

export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/products/[productId]/reviews'>
) {
  const { productId } = await context.params
  const parsedProductId = Number(productId)

  if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select(`
      id,
      product_id,
      rating,
      comment,
      created_at,
      user:profiles!reviews_user_id_fkey (
        username,
        first_name,
        last_name
      )
    `)
    .eq('product_id', parsedProductId)
    .order('created_at', { ascending: false })

  if (error) {
    const details = serializeSupabaseError(error)
    console.error('Product review API fetch failed:', {
      productId: parsedProductId,
      details,
    })

    return NextResponse.json(
      {
        error: details.message || 'Failed to fetch reviews',
        details,
      },
      { status: 500 }
    )
  }

  const reviews = (data || []).map((review) => {
    const user = Array.isArray(review.user) ? review.user[0] : review.user
    const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ')

    return {
      id: review.id,
      product_id: review.product_id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      user_name: fullName || user?.username || 'Verified Buyer',
    }
  })

  return NextResponse.json({ reviews })
}
