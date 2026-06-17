import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const FALLBACK_PUBLIC_ORIGIN = 'https://rocars-v2-production.up.railway.app'

type OAuthUser = {
  id: string
  email?: string | null
  user_metadata?: {
    full_name?: string
    name?: string
    avatar_url?: string
    picture?: string
  }
  app_metadata?: {
    provider?: string
  }
}

function getPublicOrigin(request: Request) {
  const requestUrl = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'

  if (forwardedHost && forwardedHost !== '0.0.0.0:8080') {
    return `${forwardedProto}://${forwardedHost}`
  }

  if (requestUrl.hostname !== '0.0.0.0') {
    return requestUrl.origin
  }

  const configuredOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, '')
  }

  return FALLBACK_PUBLIC_ORIGIN
}

function getSafeRedirect(rawRedirect: string | null) {
  return rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
    ? rawRedirect
    : '/'
}

function getProfilePayload(user: OAuthUser) {
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
  const [firstName, ...lastNameParts] = fullName.split(' ').filter(Boolean)
  const usernameBase =
    user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
    'google_user'
  const now = new Date().toISOString()

  return {
    id: user.id,
    email: user.email || null,
    username: `${usernameBase}_${user.id.slice(0, 8)}`,
    first_name: firstName || null,
    last_name: lastNameParts.join(' ') || null,
    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
    provider: user.app_metadata?.provider || 'google',
    role: 'customer',
    is_active: true,
    is_verified: true,
    last_login: now,
    created_at: now,
    updated_at: now,
  }
}

async function createProfile(user: OAuthUser) {
  const profilePayload = getProfilePayload(user)
  const { error: insertError } = await supabaseAdmin
    .from('profiles')
    .insert(profilePayload)

  if (!insertError) {
    return null
  }

  console.error('Profile full insert error:', insertError)

  const { error: fallbackInsertError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: profilePayload.id,
      email: profilePayload.email,
      username: profilePayload.username,
      first_name: profilePayload.first_name,
      last_name: profilePayload.last_name,
      created_at: profilePayload.created_at,
    })

  return fallbackInsertError
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const siteOrigin = getPublicOrigin(request)

  const code = requestUrl.searchParams.get('code')
  const redirect = getSafeRedirect(requestUrl.searchParams.get('redirect'))

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=missing_code', siteOrigin)
    )
  }

  const cookieStore = await cookies()
  const authCookies: {
    name: string
    value: string
    options: CookieOptions
  }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            authCookies.push({ name, value, options })
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const redirectWithAuthCookies = (path: string) => {
    const response = NextResponse.redirect(new URL(path, siteOrigin))
    authCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })
    return response
  }

  // =========================
  // 1. Exchange code for session
  // =========================
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('Auth exchange error:', exchangeError)

    return redirectWithAuthCookies('/login?error=auth_failed')
  }

  // =========================
  // 2. Get authenticated user
  // =========================
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirectWithAuthCookies('/login?error=no_user')
  }

  console.log('OAuth user:', user.email)

  if (redirect === '/register/google') {
    return redirectWithAuthCookies(redirect)
  }

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
    const insertError = await createProfile(user)

    if (insertError) {
      console.error('Profile fallback insert error:', insertError)
      const errorUrl = new URL('/login', siteOrigin)
      errorUrl.searchParams.set('error', 'profile_create_failed')
      errorUrl.searchParams.set('error_description', insertError.message)

      const response = NextResponse.redirect(errorUrl)
      authCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      return response
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
  return redirectWithAuthCookies(redirect)
}
