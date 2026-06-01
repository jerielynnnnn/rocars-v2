import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  const code = requestUrl.searchParams.get('code')
  const redirect = requestUrl.searchParams.get('redirect') || '/login?verified=true'

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
          set(name: string, value: string, options: any) {
            cookieStore.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: any) {
            cookieStore.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    // Exchange verification code for session
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Exchange error:', exchangeError)
      return NextResponse.redirect(
        new URL('/login?error=verification_failed', requestUrl.origin)
      )
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      console.log('Verified user:', user.email)

      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      // Create profile if missing
      if (!existingProfile) {
        const username =
          user.user_metadata?.username ||
          user.email?.split('@')[0] ||
          `user_${Date.now()}`

        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            username: username.toLowerCase(),
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || '',
            role: 'customer',
            is_active: true,
            is_verified: true,
            created_at: new Date().toISOString(),
          })

        if (insertError) {
          console.error('Profile creation error:', insertError)
        } else {
          console.log('Profile created successfully')
        }
      }

      // Update verified status
      await supabase
        .from('profiles')
        .update({
          is_verified: true,
        })
        .eq('id', user.id)
    }

    return NextResponse.redirect(
      new URL(redirect, requestUrl.origin)
    )
  }

  return NextResponse.redirect(
    new URL('/login', requestUrl.origin)
  )
}