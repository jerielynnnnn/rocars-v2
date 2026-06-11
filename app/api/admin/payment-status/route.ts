import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminLikeRole } from '@/lib/admin-role'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function requireAdmin(token: string | null) {
  if (!token) {
    return { error: 'No token provided', status: 401 as const }
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return { error: 'Invalid token', status: 401 as const }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile || !isAdminLikeRole(profile.role)) {
    return { error: 'Admin or staff access required', status: 403 as const }
  }

  return { user: userData.user }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

    const auth = await requireAdmin(token)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { action, historyData, notificationData } = body

    if (action === 'log-status-history') {
      if (!historyData || !historyData.order_id) {
        return NextResponse.json({ error: 'Missing history data' }, { status: 400 })
      }

      const { error } = await supabaseAdmin
        .from('order_status_history')
        .insert({
          order_id: historyData.order_id,
          status: historyData.status,
          notes: historyData.notes ?? null,
          created_at: historyData.created_at ?? new Date().toISOString(),
        })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'create-notification') {
      if (!notificationData || !notificationData.user_id) {
        return NextResponse.json({ error: 'Missing notification data' }, { status: 400 })
      }

      const { error } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: notificationData.user_id,
          title: notificationData.title,
          message: notificationData.message,
          is_read: Boolean(notificationData.is_read),
          created_at: notificationData.created_at ?? new Date().toISOString(),
        })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('Admin payment-status error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
