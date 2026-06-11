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

type AdminProfile = {
  id: string
  role: string | null
  first_name: string | null
  last_name: string | null
  username: string | null
  email: string | null
}

async function requireAdminLike(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

  if (!token) {
    return { error: 'No token provided', status: 401 as const }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) {
    return { error: 'Invalid token', status: 401 as const }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, first_name, last_name, username, email')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || !isAdminLikeRole(profile.role)) {
    return { error: 'Admin or staff access required', status: 403 as const }
  }

  return { user, profile }
}

function getActorName(profile?: Partial<AdminProfile> | null, fallbackEmail?: string | null) {
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  return fullName || profile?.username || profile?.email || fallbackEmail || 'Unknown user'
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminLike(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: logs, error } = await supabaseAdmin
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const actorIds = [...new Set((logs || []).map((log) => log.admin_id).filter(Boolean))]
  const profilesById = new Map<string, AdminProfile>()

  if (actorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, username, email, role')
      .in('id', actorIds)

    profiles?.forEach((profile) => profilesById.set(profile.id, profile as AdminProfile))
  }

  return NextResponse.json({
    logs: (logs || []).map((log) => {
      const actorProfile = profilesById.get(log.admin_id)
      return {
        ...log,
        actor_name: getActorName(actorProfile),
        actor_role: actorProfile?.role || null,
      }
    }),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminLike(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    body.ip_address ||
    null

  const { error } = await supabaseAdmin
    .from('admin_logs')
    .insert({
      admin_id: auth.user.id,
      action: body.action,
      target_type: body.target_type || null,
      target_id: body.target_id ? String(body.target_id) : null,
      details: {
        ...(body.details || {}),
        actor_name: getActorName(auth.profile, auth.user.email),
        actor_role: auth.profile.role,
      },
      ip_address: ipAddress,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
