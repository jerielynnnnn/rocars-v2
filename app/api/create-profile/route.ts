import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize Supabase with service role (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // This is server-side only
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: Request) {
  try {
    const { userId, username, firstName, lastName, middleName, email, phoneNumber } = await request.json()
    
    // Insert profile using admin client (bypasses all RLS)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        username,
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName || null,
        email,
        phone_number: phoneNumber || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) {
      console.error('Profile insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, profile: data })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}