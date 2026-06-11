import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminLikeRole } from '@/lib/admin-role'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function requireStaff(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null

  if (!token) {
    return { error: 'No token provided', status: 401 as const }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token)

  if (userError || !user) {
    return { error: 'Invalid token', status: 401 as const }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || !isAdminLikeRole(profile.role)) {
    return { error: 'Admin access required', status: 403 as const }
  }

  return { user }
}

export async function GET(request: NextRequest) {
  const staffCheck = await requireStaff(request)

  if ('error' in staffCheck) {
    return NextResponse.json(
      { error: staffCheck.error },
      { status: staffCheck.status }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ notifications: data || [] })
}

export async function PATCH(request: NextRequest) {
  const staffCheck = await requireStaff(request)

  if ('error' in staffCheck) {
    return NextResponse.json(
      { error: staffCheck.error },
      { status: staffCheck.status }
    )
  }

  const { notificationId, markAll } = await request.json()
  const updateData = { is_read: true, updated_at: new Date().toISOString() }

  const query = supabaseAdmin
    .from('admin_notifications')
    .update(updateData)

  const { error } = markAll
    ? await query.eq('is_read', false)
    : await query.eq('id', notificationId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
