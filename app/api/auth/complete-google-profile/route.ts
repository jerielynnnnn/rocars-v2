import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const body = await request.json()
    const username = String(body.username || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
    const firstName = String(body.firstName || '').trim()
    const lastName = String(body.lastName || '').trim()
    const avatarUrl = String(body.avatar || user.user_metadata?.avatar_url || '')

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const { data: takenUsername, error: usernameError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .maybeSingle()

    if (usernameError) {
      return NextResponse.json({ error: usernameError.message }, { status: 500 })
    }

    if (takenUsername) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    const profilePayload = {
      email: user.email,
      username,
      first_name: firstName,
      last_name: lastName,
      avatar_url: avatarUrl,
      provider: 'google',
      is_verified: true,
      updated_at: new Date().toISOString(),
    }

    const query = existingProfile
      ? supabaseAdmin
          .from('profiles')
          .update(profilePayload)
          .eq('id', user.id)
          .select()
          .single()
      : supabaseAdmin
          .from('profiles')
          .insert({
            id: user.id,
            ...profilePayload,
            role: 'customer',
            is_active: true,
            created_at: new Date().toISOString(),
          })
          .select()
          .single()

    const { data: profile, error: profileError } = await query

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        username,
        first_name: firstName,
        last_name: lastName,
      },
    })

    if (metadataError) {
      console.error('Google profile metadata update failed:', metadataError)
    }

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error('Complete Google profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
