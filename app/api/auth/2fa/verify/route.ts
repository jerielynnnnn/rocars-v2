// app/api/auth/2fa/verify/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import speakeasy from 'speakeasy'

export async function POST(request: Request) {
  try {
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
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    const { data: { user } } = await supabase.auth.getUser()
    const { token } = await request.json()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!token) {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
    }

    // Get user's 2FA secret
    const { data: settings, error: settingsError } = await supabase
      .from('user_profile_settings')
      .select('two_factor_secret')
      .eq('user_id', user.id)
      .single()

    if (settingsError || !settings?.two_factor_secret) {
      return NextResponse.json(
        { error: '2FA is not set up for this account' },
        { status: 400 }
      )
    }

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret: settings.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 1
    })

    if (!verified) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      )
    }

    // Enable 2FA
    const { error: updateError } = await supabase
      .from('user_profile_settings')
      .update({ 
        two_factor_enabled: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('2FA verification error:', error)
    return NextResponse.json(
      { error: 'Failed to verify 2FA code' },
      { status: 500 }
    )
  }
}