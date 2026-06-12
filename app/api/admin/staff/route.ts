import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminLikeRole } from '@/lib/admin-role'
import { supabaseAdmin } from '@/lib/supabase-admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null

  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 })
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token)

  if (userError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { data: currentProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || currentProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, first_name, last_name, username, role, avatar_url, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const staff = (data || [])
    .filter((profile) => isAdminLikeRole(profile.role))
    .map((profile) => ({
      ...profile,
      last_sign_in_at: null,
    }))

  return NextResponse.json({ staff })
}
