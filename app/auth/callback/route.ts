import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  const code = requestUrl.searchParams.get('code')
  const rawRedirect = requestUrl.searchParams.get('redirect')

  // ✅ SAFE redirect (prevents open redirect attacks)
  const redirect =
    rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      ? rawRedirect
      : '/'

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=missing_code', requestUrl.origin)
    )
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  // =========================
  // 1. Exchange code for session
  // =========================
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('Auth exchange error:', exchangeError)

    return NextResponse.redirect(
      new URL('/login?error=auth_failed', requestUrl.origin)
    )
  }

  // =========================
  // 2. Get authenticated user
  // =========================
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      new URL('/login?error=no_user', requestUrl.origin)
    )
  }

  console.log('OAuth user:', user.email)

  // =========================
  // 3. Check if profile exists
  // =========================
  const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
    .from('profiles')
    .select('id, username')
    .eq('id', user.id)
    .maybeSingle()

  if (profileLookupError) {
    console.error('Profile lookup error:', profileLookupError)
  }

  // =========================
  // 4. Create profile if missing
  // =========================
  if (!existingProfile) {
    const fullName =
      user.user_metadata?.full_name || ''

    const firstName = fullName.split(' ')[0] || ''
    const lastName =
      fullName.split(' ').slice(1).join(' ') || ''

    const username =
      user.email
        ?.split('@')[0]
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '') +
      '_' +
      user.id.slice(0, 4)

    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        username,
        first_name: firstName,
        last_name: lastName,
        avatar_url: user.user_metadata?.avatar_url || '',
        provider: user.app_metadata?.provider || 'email',
        role: 'customer',
        is_active: true,
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('Profile insert error:', insertError)

      return NextResponse.redirect(
        new URL('/login?error=profile_create_failed', requestUrl.origin)
      )
    }

    console.log('Profile created for:', user.email)
  }

  // =========================
  // 5. Ensure verified status is set
  // =========================
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      email: user.email,
      avatar_url: user.user_metadata?.avatar_url || undefined,
      provider: user.app_metadata?.provider || 'email',
      is_verified: true,
      last_login: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('Profile update error:', updateError)
  }

  // =========================
  // 6. Redirect user
  // =========================
  return NextResponse.redirect(
    new URL(redirect, requestUrl.origin)
  )
}
