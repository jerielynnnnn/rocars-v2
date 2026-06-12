import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase admin client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Admin client - bypasses RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Regular client for authentication
const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(request: NextRequest) {
  try {
    console.log('=== CREATE STAFF API CALLED ===')
    
    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization')
    console.log('Auth header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // Verify the token and get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
    }
    
    console.log('User found:', user.email, user.id)

    // Check if user has admin role
    const { data: profile, error: profileLookupError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileLookupError) {
      return NextResponse.json({ error: 'Error checking user role: ' + profileLookupError.message }, { status: 500 })
    }

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { email, password, firstName, lastName, username, role } = await request.json()
    
    // Validate input
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    // Check if email already exists in profiles
    const { data: existingEmail } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('email', email.toLowerCase())
      .single()

    if (existingEmail) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    // Check if username already exists
    const { data: existingUsername } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single()

    if (existingUsername) {
      return NextResponse.json({ error: 'Username already taken. Please choose another one.' }, { status: 400 })
    }

    // Create user using Admin API
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName || '',
        last_name: lastName || '',
        username: username,
        role: role || 'staff'
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    console.log('User created with ID:', authData.user.id)

    // Insert profile with proper error handling
    try {
      const profileData = {
        id: authData.user.id,
        email: email.toLowerCase(),
        role: role || 'staff',
        first_name: firstName || '',
        last_name: lastName || '',
        username: username,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        is_verified: true
      }

      console.log('Inserting profile:', profileData)

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert(profileData)

      if (profileError) {
        console.error('Profile insert error:', profileError)
        
        // Delete the user since profile creation failed
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        
        // Return specific error message based on the error
        if (profileError.code === '23505') {
          return NextResponse.json({ 
            error: 'Username or email already exists' 
          }, { status: 400 })
        } else if (profileError.code === '23502') {
          return NextResponse.json({ 
            error: 'Missing required field' 
          }, { status: 400 })
        } else {
          return NextResponse.json({ 
            error: profileError.message 
          }, { status: 500 })
        }
      }

      console.log('Profile inserted successfully')

      // Create welcome notification
      const { error: notifError } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: authData.user.id,
          title: 'Welcome to the Team!',
          message: `You've been added as a ${role || 'staff'} member. Welcome to the team!`,
          type: 'welcome',
          is_read: false,
          created_at: new Date().toISOString()
        })

      if (notifError) {
        console.error('Error creating notification:', notifError)
      }

      return NextResponse.json({ 
        success: true, 
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: role || 'staff'
        },
        message: 'Staff member created successfully'
      })

    } catch (insertError) {
      console.error('Unexpected error during profile insert:', insertError)
      
      // Clean up - delete the user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      
      return NextResponse.json({ 
        error: 'Failed to create staff profile. Please try again.' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in create-staff API:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}
