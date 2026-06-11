import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function getAdminUser(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return { user: null, error: 'Unauthorized' }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token)

  if (userError || !user) {
    return { user: null, error: 'Unauthorized' }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !['admin', 'staff'].includes(profile?.role)) {
    return { user: null, error: 'Admin or staff access required' }
  }

  return { user, error: null }
}

export async function PATCH(request: Request) {
  try {
    const { user, error: authError } = await getAdminUser(request)

    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })
    }

    const body = await request.json()
    const updateData = {
      user_id: user.id,
      two_factor_enabled: body.two_factor_enabled === true,
      email_notifications_enabled: body.login_alerts !== false,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('user_profile_settings')
      .upsert(updateData, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings: data })
  } catch (error) {
    console.error('Admin settings update error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getAdminUser(request)

    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })
    }

    let { data, error } = await supabaseAdmin
      .from('user_profile_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data && !error) {
      const { data: createdSettings, error: insertError } = await supabaseAdmin
        .from('user_profile_settings')
        .insert({
          user_id: user.id,
          two_factor_enabled: false,
          email_notifications_enabled: true,
          is_profile_public: false,
          show_email_publicly: false,
          show_phone_publicly: false,
          show_address_publicly: false,
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
        })
        .select()
        .single()

      data = createdSettings
      error = insertError
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings: data })
  } catch (error) {
    console.error('Admin settings load error:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}
