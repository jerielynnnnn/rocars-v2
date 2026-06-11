'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function removeStaff(userId: string) {
  try {
    if (!userId) {
      return { error: 'User ID is required' }
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Update role to 'customer' to remove staff access
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        role: 'customer',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      return { error: updateError.message }
    }

    return { 
      success: true, 
      message: 'Staff access removed successfully' 
    }

  } catch (error) {
    console.error('Error in removeStaff:', error)
    return { error: 'Internal server error' }
  }
}