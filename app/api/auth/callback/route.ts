// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function getSafeRedirect(rawRedirect: string | null) {
  return rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
    ? rawRedirect
    : '/'
}

function getGoogleProfilePayload(user: {
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
}) {
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
  const [firstName, ...lastNameParts] = fullName.split(' ').filter(Boolean)
  const usernameBase = user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'google_user'

  return {
    email: user.email || null,
    username: `${usernameBase}_${user.id.slice(0, 4)}`,
    first_name: firstName || null,
    last_name: lastNameParts.join(' ') || null,
    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
    provider: user.app_metadata?.provider || 'google',
    is_verified: true,
    is_active: true,
    updated_at: new Date().toISOString(),
  }
}

async function ensureGoogleProfile(user: {
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
}) {
  const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileLookupError) {
    throw profileLookupError
  }

  const profilePayload = getGoogleProfilePayload(user)
  const { error: profileError } = existingProfile
    ? await supabaseAdmin
        .from('profiles')
        .update({
          email: profilePayload.email,
          avatar_url: profilePayload.avatar_url,
          provider: profilePayload.provider,
          is_verified: true,
          is_active: true,
          last_login: new Date().toISOString(),
          updated_at: profilePayload.updated_at,
        })
        .eq('id', user.id)
    : await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          ...profilePayload,
          role: 'customer',
          last_login: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })

  if (profileError) {
    throw profileError
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirect = getSafeRedirect(requestUrl.searchParams.get('redirect'))

  if (code) {
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
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('API auth callback exchange error:', exchangeError)
      return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin))
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login?error=no_user', requestUrl.origin))
    }

    try {
      await ensureGoogleProfile(user)
    } catch (error) {
      console.error('API auth callback profile save error:', error)
      return NextResponse.redirect(new URL('/login?error=profile_create_failed', requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL(redirect, requestUrl.origin))
}
