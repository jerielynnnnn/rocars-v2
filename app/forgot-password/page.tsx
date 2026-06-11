'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, ArrowLeft, Mail, CheckCircle, AlertCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validate email
    if (!email.includes('@')) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/auth/callback?redirect=${encodeURIComponent('/reset-password')}`,
      })

      if (error) {
        console.error('Reset password error:', error)
        
        // Handle specific error cases
        if (error.message.includes('User not found')) {
          // Supabase intentionally does not reveal whether the account exists.
          // Show a generic confirmation instead of claiming the email was sent.
          setSuccess(true)
          setLoading(false)
          return
        }
        
        if (error.message.includes('rate limit')) {
          throw new Error('Too many attempts. Please wait 1 hour before trying again.')
        }
        
        if (error.message.includes('Anonymous access is disabled')) {
          throw new Error('Unable to send reset email. Please try again later.')
        }
        
        throw error
      }

      // Success - show confirmation message
      setSuccess(true)
    } catch (err: any) {
      console.error('Reset error:', err)
      setError(err.message || 'Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Check your email
          </h1>
          <p className="text-gray-600 mb-4">
            If there is an account for <strong>{email}</strong>, a password reset link has been sent.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              If the email exists in our system, click the reset link in your inbox. The link will expire in 24 hours.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Didn't receive the email? Check your spam folder or{' '}
              <button
                onClick={() => {
                  setSuccess(false)
                  setEmail('')
                }}
                className="underline hover:text-blue-800"
              >
                try again
              </button>
            </p>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="text-gray-600 hover:text-gray-900 transition flex items-center justify-center gap-2 mx-auto"
          >
            <ArrowLeft size={16} />
            Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-gray-900" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Forgot password?
          </h1>
          <p className="text-gray-500 text-sm">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-6 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl p-8">
          <form onSubmit={handleResetRequest} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  placeholder="Enter your registered email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition bg-gray-50 focus:bg-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                We'll send a password reset link to this email
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-black text-white py-2.5 rounded-lg font-medium hover:bg-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending reset link...</span>
                </div>
              ) : (
                'Send reset link'
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full text-gray-500 py-2 text-sm hover:text-gray-900 transition flex items-center justify-center gap-2"
            >
              <ArrowLeft size={14} />
              Back to login
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            If you don't receive the email within a few minutes, check your spam folder
          </p>
        </div>
      </div>
    </div>
  )
}
