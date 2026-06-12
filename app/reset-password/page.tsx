'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pageState, setPageState] = useState<'verifying' | 'form' | 'success' | 'error'>('verifying')

  useEffect(() => {
    const verifyLink = async () => {
      try {
        const rawSearch = typeof window !== 'undefined' ? window.location.search : ''
        const rawHash = typeof window !== 'undefined' ? window.location.hash : ''
        const paramSource = new URLSearchParams(rawSearch)

        if (rawHash.startsWith('#')) {
          const hashParams = new URLSearchParams(rawHash.slice(1))
          for (const [key, value] of hashParams.entries()) {
            if (!paramSource.has(key)) {
              paramSource.set(key, value)
            }
          }
        }

        const tokenHash = searchParams.get('token_hash') || paramSource.get('token_hash')
        const type = searchParams.get('type') || paramSource.get('type')
        const accessToken = searchParams.get('access_token') || paramSource.get('access_token')
        const refreshToken = searchParams.get('refresh_token') || paramSource.get('refresh_token')
        const code = searchParams.get('code') || paramSource.get('code')
        const token = searchParams.get('token') || paramSource.get('token')
        const email = searchParams.get('email') || paramSource.get('email')

        console.log('Reset URL params:', {
          tokenHash: Boolean(tokenHash),
          token: Boolean(token),
          type,
          accessToken: Boolean(accessToken),
          refreshToken: Boolean(refreshToken),
          code: Boolean(code),
          email: Boolean(email),
          rawSearch,
          rawHash,
        })

        const { data: { session: currentSession } } = await supabase.auth.getSession()

        if (currentSession) {
          console.log('Existing session found; allowing password reset form.')
          setPageState('form')
          return
        }

        if ((tokenHash && type) || (token && type === 'recovery')) {
          console.log('Verifying recovery link...')

          const verifyPayload = tokenHash
            ? {
                token_hash: tokenHash,
                type: 'recovery' as const,
              }
            : token && email
              ? {
                  token,
                  type: 'recovery' as const,
                  email,
                }
              : null

          if (!verifyPayload) {
            throw new Error('Missing recovery token or email in the password reset link.')
          }

          const { error: verifyError } = await supabase.auth.verifyOtp(verifyPayload)

          if (!verifyError) {
            console.log('Token verified successfully.')
            setPageState('form')
            return
          }

          console.error('Token verification failed:', verifyError)

          if (accessToken && refreshToken) {
            console.log('Falling back to access_token / refresh_token session setup...')
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (!sessionError) {
              console.log('Session restored successfully.')
              setPageState('form')
              return
            }

            console.error('Session setup failed:', sessionError)
          }

          if (code) {
            console.log('Falling back to code exchange...')
            const { error: codeError } = await supabase.auth.exchangeCodeForSession(code)

            if (!codeError) {
              console.log('Code exchange succeeded.')
              setPageState('form')
              return
            }

            console.error('Code exchange failed:', codeError)
          }

          throw verifyError
        }

        if (accessToken && refreshToken) {
          console.log('Restoring session from access_token / refresh_token...')
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (!sessionError) {
            console.log('Session restored successfully.')
            setPageState('form')
            return
          }

          console.error('Session setup failed:', sessionError)
        }

        if (code) {
          console.log('Exchanging code for session...')
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(code)

          if (!codeError) {
            console.log('Code exchange succeeded.')
            setPageState('form')
            return
          }

          console.error('Code exchange failed:', codeError)
        }

        console.error('No valid reset parameters found in the URL.')
        setPageState('error')
        setError('Invalid or expired reset link. Please request a new one.')
        
      } catch (err: any) {
        console.error('Verification error:', err)
        setPageState('error')
        setError(err.message || 'An error occurred. Please try again.')
      }
    }
    
    verifyLink()
  }, [searchParams])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter')
      setLoading(false)
      return
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number')
      setLoading(false)
      return
    }

    try {
      // Check if we have an active session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        // Try to get user anyway
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('No active session. Please request a new reset link.')
        }
      }
      
      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) {
        console.error('Update error:', updateError)
        
        if (updateError.message.includes('same as the old password')) {
          setError('New password must be different from your current password')
        } else if (updateError.message.includes('No active session')) {
          setError('Your reset link has expired. Please request a new one.')
        } else {
          setError(updateError.message)
        }
        setLoading(false)
        return
      }

      // Sign out after successful password change
      await supabase.auth.signOut()
      
      setPageState('success')
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login?reset=success')
      }, 3000)
      
    } catch (err: any) {
      console.error('Reset error:', err)
      setError('Failed to reset password. Please request a new link.')
      setLoading(false)
    }
  }

  // Verifying state
  if (pageState === 'verifying') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-900 mx-auto mb-4" />
          <p className="text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Invalid or Expired Link</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  // Success state
  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Password Reset Successful!</h1>
          <p className="text-gray-600 mb-4">Your password has been updated.</p>
          <p className="text-sm text-gray-500">Redirecting to login page...</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 text-gray-600 hover:text-gray-900 transition underline"
          >
            Click here to login now
          </button>
        </div>
      </div>
    )
  }

  // Form state
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Create New Password</h1>
          <p className="text-gray-500 text-sm">Enter your new password below</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl p-8">
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your new password"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition bg-gray-50 focus:bg-white pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your new password"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition bg-gray-50 focus:bg-white pr-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full bg-black text-white py-2.5 rounded-lg font-medium hover:bg-gray-900 transition disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Resetting password...</span>
                </div>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-600">Loading reset password...</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
