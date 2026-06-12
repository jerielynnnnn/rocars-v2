'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function VerifyEmailPendingPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'verified' | 'pending'>('checking')
  const [email, setEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    // Get email from session storage (set during signup)
    const storedEmail = sessionStorage.getItem('pendingVerificationEmail')
    if (storedEmail) {
      setEmail(storedEmail)
    }

    // Check if user is already verified
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        setStatus('verified')
        setTimeout(() => router.push('/'), 2000)
      } else {
        setStatus('pending')
      }
    }

    checkSession()

    // Listen for auth changes (when user clicks email link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setStatus('verified')
        setTimeout(() => router.push('/'), 2000)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const resendEmail = async () => {
    if (!email) return
    
    setResendLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent('/login?verified=true')}`,
        },
      })
      
      if (error) throw error
      
      setResendMessage('Verification email sent! Check your inbox.')
      setCountdown(60)
      
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
    } catch (err: any) {
      console.error('Resend error:', err)
      setResendMessage('Failed to resend. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  if (status === 'verified') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Email Verified!</h1>
          <p className="text-gray-600 mt-2">Redirecting to ROCARS...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        {/* Progress Steps */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex-1 h-1 rounded-full mx-1 ${
                  step <= 2 ? 'bg-black' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-500 text-center mt-2">
            Step 2 of 3: Verify Your Email
          </p>
        </div>

        <div className="text-center">
          {/* Email Icon */}
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
          
          <p className="text-gray-600 mb-2">
            We sent a verification link to
          </p>
          
          <p className="font-medium bg-gray-50 py-2 px-4 rounded-lg mb-6 break-all">
            {email || 'your email address'}
          </p>

          {/* Status Box */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-left">
            <div className="flex gap-3">
              <div className="w-5 h-5 bg-yellow-400 rounded-full flex-shrink-0 mt-0.5"></div>
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Waiting for verification
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Click the verification link in your email to activate your account.
                  Didn't receive it? Check your spam folder or request a new link.
                </p>
              </div>
            </div>
          </div>

          {/* Tips Box */}
          <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs font-semibold text-blue-900 mb-2">Tips:</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Check your spam/junk folder</li>
              <li>• Add noreply@supabase.co to your contacts</li>
              <li>• The verification link expires in 24 hours</li>
              <li>• Make sure you entered the correct email address</li>
            </ul>
          </div>

          {/* Resend Message */}
          {resendMessage && (
            <div className={`text-sm p-2 rounded-lg mb-4 ${
              resendMessage.includes('sent') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}>
              {resendMessage}
            </div>
          )}

          {/* Resend Button */}
          <button
            onClick={resendEmail}
            disabled={resendLoading || countdown > 0}
            className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition disabled:opacity-50 mb-3"
          >
            {resendLoading ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : 'Resend Verification Email'}
          </button>

          {/* Back Button */}
          <button
            onClick={() => router.push('/signup')}
            className="w-full text-gray-600 py-3 rounded-xl font-medium hover:text-black transition border border-gray-200"
          >
            Back to Sign Up
          </button>

          {/* Login Link */}
          <div className="text-center mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Already verified?{' '}
              <button
                onClick={() => router.push('/login')}
                className="text-black font-medium hover:underline"
              >
                Click here to login
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
