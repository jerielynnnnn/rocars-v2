import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

interface ReviewRating {
  product_id: number
  rating: number
}

export async function POST(request: NextRequest) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = Array.isArray((body as { ids?: unknown }).ids)
    ? (body as { ids: unknown[] }).ids
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    : []

  const productIds = Array.from(new Set(ids))

  if (productIds.length === 0) {
    return NextResponse.json({ ratings: [] })
  }

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('product_id, rating')
    .in('product_id', productIds)

  if (error) {
    console.error('Product ratings API fetch failed:', {
      productIds,
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
    })

    return NextResponse.json(
      { error: error.message || 'Failed to fetch product ratings' },
      { status: 500 }
    )
  }

  const totals = new Map<number, { sum: number; count: number }>()

  ;((data || []) as ReviewRating[]).forEach((review) => {
    const existing = totals.get(review.product_id) || { sum: 0, count: 0 }
    totals.set(review.product_id, {
      sum: existing.sum + review.rating,
      count: existing.count + 1,
    })
  })

  const ratings = Array.from(totals.entries()).map(([product_id, value]) => ({
    product_id,
    average_rating: value.sum / value.count,
    review_count: value.count,
  }))

  return NextResponse.json({ ratings })
}
