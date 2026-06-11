// app/api/auth/2fa/setup/route.ts
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST() {
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
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch {
              // Handle cookie setting error
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch {
              // Handle cookie removal error
            }
          },
        },
      }
    )
    
    // Get the user session
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Auth error:', userError)
      return NextResponse.json({ error: 'Unauthorized - Please log in again' }, { status: 401 })
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `ROCARS:${user.email}`
    })

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      Math.random().toString(36).substring(2, 10).toUpperCase()
    )

    // Check if settings exist
    const { data: existingSettings } = await supabaseAdmin
      .from('user_profile_settings')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingSettings) {
      // Update existing settings
      const { error: updateError } = await supabaseAdmin
        .from('user_profile_settings')
        .update({
          two_factor_secret: secret.base32,
          two_factor_backup_codes: backupCodes,
          two_factor_enabled: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Update error:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    } else {
      // Insert new settings
      const { error: insertError } = await supabaseAdmin
        .from('user_profile_settings')
        .insert({
          user_id: user.id,
          two_factor_secret: secret.base32,
          two_factor_backup_codes: backupCodes,
          two_factor_enabled: false,
          is_profile_public: true,
          show_email_publicly: false,
          show_phone_publicly: false,
          show_address_publicly: false,
          email_notifications_enabled: true,
          push_notifications_enabled: true,
          sms_notifications_enabled: false,
          notify_order_updates: true,
          notify_promotions: false,
          notify_product_alerts: true,
          notify_review_responses: true,
          notify_wishlist_updates: false,
          preferred_language: 'en',
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
          auto_save_address: true,
          save_search_history: true,
          allow_marketing_emails: false,
          allow_analytics_tracking: true,
          session_timeout_minutes: 30
        })

      if (insertError) {
        console.error('Insert error:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    // Generate QR code
    let qrCodeUrl = ''
    if (secret.otpauth_url) {
      qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url)
    }

    return NextResponse.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      backupCodes
    })
    
  } catch (error) {
    console.error('2FA setup error:', error)
    return NextResponse.json(
      { error: 'Failed to setup 2FA' },
      { status: 500 }
    )
  }
}
