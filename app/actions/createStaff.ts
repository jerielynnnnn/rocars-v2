'use server'

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { StaffRole } from '@/lib/admin-role'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function createStaff(formData: {
  email: string
  password: string
  firstName: string
  lastName: string
  username: string
  role: StaffRole
}) {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      username,
      role
    } = formData

    console.log('========== CREATE STAFF START ==========')
    console.log('Email:', email)
    console.log('Username:', username)
    console.log('Role:', role)

    if (!email || !password) {
      return { error: 'Email and password are required' }
    }

    if (!firstName || !lastName) {
      return { error: 'First name and last name are required' }
    }

    if (!username) {
      return { error: 'Username is required' }
    }

    console.log(
      'SERVICE ROLE EXISTS:',
      !!process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const { data: sessionData, error: sessionError } = await supabaseAuth.auth.getSession()

    if (sessionError || !sessionData.session?.access_token) {
      return { error: 'Admin session is required to create staff' }
    }

    const { data: actingProfile } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', sessionData.session.user.id)
      .single()

    if (!actingProfile || actingProfile.role !== 'admin') {
      return { error: 'Only admins can create staff accounts' }
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        },
      }
    )

    const supabaseUserClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        },
      }
    )

    console.log('Attempting admin signup...')

    const { data: authData, error: signUpError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          username,
          role,
        },
      })

    if (signUpError) {
      console.error('ADMIN SIGNUP ERROR:')
      console.error(signUpError)

      return {
        error: `SIGNUP ERROR: ${signUpError.message}`
      }
    }

    console.log('Admin signup successful')
    console.log('User ID:', authData.user?.id)

    if (!authData.user) {
      return { error: 'User created but no user returned' }
    }

    console.log('Upserting profile...')

    const { data: profileData, error: profileError } =
      await supabaseUserClient
        .from('profiles')
        .upsert(
          {
            id: authData.user.id,
            email: email.toLowerCase(),
            username,
            first_name: firstName,
            last_name: lastName,
            role,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select()

    console.log('Profile upsert result:', profileData)

    if (profileError) {
      console.error('PROFILE UPSERT ERROR:')
      console.error(profileError)

      return {
        error: `PROFILE UPSERT ERROR: ${profileError.message}`
      }
    }

    console.log('Attempting notification insert...')

    const { error: notifError } =
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: authData.user.id,
          title: 'Welcome to the Team!',
          message: `You've been added as a ${role} member.`,
          type: 'welcome',
          is_read: false,
          created_at: new Date().toISOString()
        })

    if (notifError) {
      console.error('NOTIFICATION ERROR:')
      console.error(notifError)
    }

    console.log('========== CREATE STAFF SUCCESS ==========')

    return {
      success: true,
      user: authData.user
    }
  } catch (error) {
    console.error('UNEXPECTED CREATE STAFF ERROR:')
    console.error(error)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error'
    }
  }
}
