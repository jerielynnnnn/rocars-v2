import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(request: NextRequest) {
  try {
    console.log('=== REMOVE STAFF API CALLED ===')
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // Verify the token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
    }

    // Check if user has admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Don't allow removing your own admin access
    if (userId === user.id) {
      return NextResponse.json({ error: 'You cannot remove your own admin access' }, { status: 400 })
    }

    // Update role to 'customer' to remove staff access
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        role: 'customer',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Staff access removed successfully' 
    })

  } catch (error) {
    console.error('Error in remove-staff API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}