// app/auth/callback/route.ts
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

function getGoogleProfilePayload(user: OAuthUser) {
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
  const [firstName, ...lastNameParts] = fullName.split(' ').filter(Boolean)
  const usernameBase = user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'google_user'
  const now = new Date().toISOString()

  return {
    id: user.id,
    email: user.email || null,
    username: `${usernameBase}_${user.id.slice(0, 8)}`,
    first_name: firstName || null,
    last_name: lastNameParts.join(' ') || null,
    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
    role: 'customer',
    is_verified: true,
    is_active: true,
    last_login: now,
    created_at: now,
    updated_at: now,
  }
}

async function ensureGoogleProfile(user: OAuthUser) {
  const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileLookupError) {
    throw profileLookupError
  }

  const profilePayload = getGoogleProfilePayload(user)

  if (existingProfile) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        email: profilePayload.email,
        avatar_url: profilePayload.avatar_url,
        is_verified: true,
        is_active: true,
        last_login: profilePayload.last_login,
        updated_at: profilePayload.updated_at,
      })
      .eq('id', user.id)

    if (profileError) {
      console.error('API auth callback full profile update error:', profileError)
    }

    return
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert(profilePayload)

  if (!profileError) {
    return
  }

  console.error('API auth callback full profile insert error:', profileError)

  const { error: fallbackError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: profilePayload.id,
      email: profilePayload.email,
      username: profilePayload.username,
      first_name: profilePayload.first_name,
      last_name: profilePayload.last_name,
      created_at: profilePayload.created_at,
    })

  if (fallbackError) {
    throw fallbackError
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const siteOrigin = getPublicOrigin(request)
  const code = requestUrl.searchParams.get('code')
  const redirect = getSafeRedirect(requestUrl.searchParams.get('redirect'))

  if (code) {
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

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('API auth callback exchange error:', exchangeError)
      return redirectWithAuthCookies('/login?error=auth_failed')
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return redirectWithAuthCookies('/login?error=no_user')
    }

    if (redirect === '/register/google') {
      return redirectWithAuthCookies(redirect)
    }

    try {
      await ensureGoogleProfile(user)
    } catch (error) {
      console.error('API auth callback profile save error:', error)
      const errorUrl = new URL('/login', siteOrigin)
      errorUrl.searchParams.set('error', 'profile_create_failed')
      errorUrl.searchParams.set(
        'error_description',
        error instanceof Error ? error.message : 'Unable to save profile'
      )

      const response = NextResponse.redirect(errorUrl)
      authCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      return response
    }

    return redirectWithAuthCookies(redirect)
  }

  return NextResponse.redirect(new URL(redirect, siteOrigin))
}
