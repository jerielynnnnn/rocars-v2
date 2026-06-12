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

export async function POST(request: NextRequest) {
  const auth = await getUserFromRequest(request)

  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const voucherId = Number(body.voucherId)

    if (!Number.isInteger(voucherId) || voucherId <= 0) {
      return NextResponse.json({ error: 'Invalid voucher id' }, { status: 400 })
    }

    await ensureProfile(auth.user)

    const { data: voucher, error: voucherError } = await supabaseAdmin
      .from('vouchers')
      .select('*')
      .eq('id', voucherId)
      .single()

    if (voucherError || !voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
    }

    const now = new Date()
    if (!voucher.is_active) {
      return NextResponse.json({ error: 'This voucher is no longer active' }, { status: 400 })
    }

    if (new Date(voucher.valid_from) > now) {
      return NextResponse.json({ error: 'This voucher is not yet available' }, { status: 400 })
    }

    if (new Date(voucher.valid_until) < now) {
      return NextResponse.json({ error: 'This voucher has expired' }, { status: 400 })
    }

    if (voucher.usage_limit && voucher.used_count >= voucher.usage_limit) {
      return NextResponse.json({ error: 'This voucher has reached its usage limit' }, { status: 400 })
    }

    const { data: existingClaim, error: existingClaimError } = await supabaseAdmin
      .from('voucher_usage')
      .select('id')
      .eq('user_id', auth.user.id)
      .eq('voucher_id', voucherId)
      .maybeSingle()

    if (existingClaimError) {
      return NextResponse.json({ error: existingClaimError.message }, { status: 500 })
    }

    if (existingClaim) {
      return NextResponse.json({ error: 'You have already claimed this voucher' }, { status: 409 })
    }

    const { error: insertError } = await supabaseAdmin
      .from('voucher_usage')
      .insert({
        user_id: auth.user.id,
        voucher_id: voucher.id,
        voucher_code: voucher.code,
        discount_amount: 0,
        free_shipping: voucher.type === 'free_shipping',
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('vouchers')
      .update({ used_count: Number(voucher.used_count || 0) + 1 })
      .eq('id', voucher.id)

    if (updateError) {
      console.error('Voucher used_count update failed:', updateError)
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: auth.user.id,
      title: 'Voucher Claimed!',
      message: `You have successfully claimed voucher ${voucher.code}. Use it at checkout!`,
      type: 'general',
      is_read: false,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, voucher })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to claim voucher'
    console.error('Voucher claim failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
