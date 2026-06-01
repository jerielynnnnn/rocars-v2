import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('type')

  if (token_hash && type) {
    const supabase = await createClient()
    
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      // Successfully verified - redirect to reset password page
      redirectTo.pathname = '/reset-password'
      return NextResponse.redirect(redirectTo)
    } else {
      console.error('Verification error:', error)
    }
  }

  // If verification fails, redirect to forgot password with error
  redirectTo.pathname = '/forgot-password'
  redirectTo.searchParams.set('error', 'invalid_link')
  return NextResponse.redirect(redirectTo)
}