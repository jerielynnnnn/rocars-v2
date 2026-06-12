'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import type { AuthError, User } from '@supabase/supabase-js'
import {
  Eye,
  EyeOff,
  Shield,
  Lock,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react'
import { FaGoogle } from 'react-icons/fa'
import { isAdminLikeRole } from '@/lib/admin-role'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const redirectTo = searchParams.get('redirect') || '/'
  const verified = searchParams.get('verified')
  const authError = searchParams.get('error')
  const authErrorDescription = searchParams.get('error_description')

  const [form, setForm] = useState({
    identifier: '',
    password: '',
    twoFactorCode: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [show2FAField, setShow2FAField] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [requires2FA, setRequires2FA] = useState(false)
  const [pendingUser, setPendingUser] = useState<User | null>(null)

  const getErrorMessage = (err: unknown, fallback: string) => {
    return err instanceof Error ? err.message : fallback
  }

  useEffect(() => {
    const saved = localStorage.getItem('rocars_identifier')
    const remember = localStorage.getItem('rocars_remember')

    if (saved && remember === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((p) => ({ ...p, identifier: saved }))
      setRememberMe(true)
    }
  }, [])

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        // Check user role before redirecting
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.session.user.id)
          .single()
        
        if (isAdminLikeRole(profile?.role)) {
          router.push('/admin/dashboard')
        } else {
          router.push(redirectTo)
        }
      }
    }
    check()
  }, [router, redirectTo])

  useEffect(() => {
    if (verified === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuccessMessage('Email verified successfully! You can now login.')
    }
  }, [verified])

  useEffect(() => {
    if (!authError) return

    const message = authErrorDescription
      ? decodeURIComponent(authErrorDescription.replace(/\+/g, ' '))
      : 'Google sign-in failed. Please try again.'

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(message)
  }, [authError, authErrorDescription])

  // =========================
  // VERIFY 2FA CODE
  // =========================
  const verify2FACode = async () => {
    if (!form.twoFactorCode) {
      setError('Please enter your 2FA verification code')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (!pendingUser) {
        throw new Error('Session expired. Please login again.')
      }

      const response = await fetch('/api/auth/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pendingUser.id,
          token: form.twoFactorCode,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Invalid 2FA verification code')
      }

      // 2FA verified successfully - complete login
      await completeLogin(pendingUser)

    } catch (err) {
      console.error('2FA verification error:', err)
      setError(getErrorMessage(err, '2FA verification failed'))
      setLoading(false)
    }
  }

  // =========================
  // COMPLETE LOGIN AFTER 2FA
  // =========================
  const completeLogin = async (user: User) => {
    try {
      if (rememberMe) {
        localStorage.setItem('rocars_identifier', form.identifier)
        localStorage.setItem('rocars_remember', 'true')
      } else {
        localStorage.removeItem('rocars_identifier')
        localStorage.removeItem('rocars_remember')
      }

      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id)

      // Get user profile with role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, username, email, first_name, last_name')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
      }

      console.log('Profile data:', profile)
      console.log('Is admin?', profile?.role === 'admin')

      // Store role in session storage for quick access
      if (profile?.role) {
        sessionStorage.setItem('userRole', profile.role)
        sessionStorage.setItem('userName', `${profile.first_name || ''} ${profile.last_name || ''}`.trim())
      }

      // Clear 2FA state
      setShow2FAField(false)
      setRequires2FA(false)
      setPendingUser(null)

      // Redirect based on role
      if (isAdminLikeRole(profile?.role)) {
        console.log('Redirecting to admin dashboard...')
        router.push('/admin/dashboard')
      } else {
        console.log('Redirecting to:', redirectTo)
        router.push(redirectTo)
      }
    } catch (err) {
      console.error('Complete login error:', err)
      setError(getErrorMessage(err, 'Failed to complete login'))
      setLoading(false)
    }
  }

  const getProfileProvider = async (email: string): Promise<string | null> => {
    const { data } = await supabase
      .from('profiles')
      .select('provider')
      .eq('email', email)
      .maybeSingle()

    return data?.provider || null
  }

  const getAuthErrorMessage = (error: AuthError | Error) => {
    const message = error?.message || ''

    if (/invalid login credentials/i.test(message)) {
      return 'Invalid email or password. If you created this account with Google, use Continue with Google instead.'
    }

    if (/email.*not confirmed|confirm your email/i.test(message)) {
      return 'Please verify your email before signing in.'
    }

    if (/too many requests/i.test(message)) {
      return 'Too many sign-in attempts. Please wait a moment and try again.'
    }

    return message || 'Login failed'
  }

  // =========================
  // LOGIN (STEP 1)
  // =========================
  const handleLogin = async () => {
    setLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      if (!form.identifier || !form.password) {
        throw new Error('Please fill in all fields')
      }

      const emailToUse = form.identifier.trim().toLowerCase()
      
      if (!emailToUse.includes('@')) {
        throw new Error('Please enter a valid email address')
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: form.password,
      })

      if (error) {
        if (/invalid login credentials/i.test(error.message)) {
          const provider = await getProfileProvider(emailToUse)

          if (provider === 'google') {
            throw new Error(
              'This account was created with Google. Use Continue with Google, or reset your password first if you want to sign in with email and password.'
            )
          }
        }

        throw new Error(getAuthErrorMessage(error))
      }
      
      if (!data.user) throw new Error('Login failed')

      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut()
        throw new Error('Please verify your email first. Check your inbox.')
      }

      // Check if 2FA is enabled for this user
      const twoFactorResponse = await fetch('/api/auth/2fa/status')
      const twoFactorStatus = twoFactorResponse.ok
        ? await twoFactorResponse.json()
        : { enabled: false }

      // If 2FA is enabled, store pending user and show 2FA field
      if (twoFactorStatus.enabled === true) {
        setPendingUser(data.user)
        setRequires2FA(true)
        setShow2FAField(true)
        setLoading(false)
        return
      }

      // No 2FA, complete login directly
      await completeLogin(data.user)

    } catch (err) {
      setError(getErrorMessage(err, 'Login failed'))
      setLoading(false)
    }
  }

  // =========================
  // GOOGLE LOGIN
  // =========================
  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent('/')}`,
      },
    })

    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  // =========================
  // FORGOT PASSWORD
  // =========================
  const handleForgotPassword = async () => {
    setError('')
    setSuccessMessage('')

    if (!form.identifier) {
      setError('Enter your email')
      return
    }

    try {
      const emailToUse = form.identifier.trim().toLowerCase()
      
      if (!emailToUse.includes('@')) {
        throw new Error('Please enter a valid email address')
      }

      const { error } = await supabase.auth.resetPasswordForEmail(
        emailToUse,
        {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent('/reset-password')}`,
        }
      )

      if (error) throw error

      setSuccessMessage('Password reset link sent to your email!')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send password reset email'))
    }
  }

  // Handle 2FA code submission on Enter key
  const handle2FAKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      verify2FACode()
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-4xl bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex flex-row">
          {/* LEFT SIDE - IMAGE - Pure Black Background */}
          <div className="hidden md:flex md:w-1/2 bg-black p-8 flex-col">
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {show2FAField ? '2FA Verification' : 'Login'}
                </h2>
                <p className="text-gray-400 text-sm">
                  {show2FAField 
                    ? 'Enter your 2FA code to complete login'
                    : 'Sign in to access your account and explore premium auto parts'
                  }
                </p>
              </div>
              
              <div className="my-8">
                <div className="relative w-full h-50">
                  <Image
                    src="/logo.png"
                    alt="ROCARS Automotive"
                    width={360}
                    height={200}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              <div className="mt-auto">
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                  <Shield size={14} />
                  <span>Secured login with 2FA support</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE - FORM */}
          <div className="w-full md:w-1/2 p-6 md:p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center mx-auto mb-3 md:hidden">
                <span className="font-bold text-sm">R</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-black">
                {show2FAField ? '2-Step Verification' : 'Welcome Back'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {show2FAField 
                  ? 'Enter the 6-digit code from your authenticator app'
                  : 'Sign in to your account'
                }
              </p>
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-600 text-xs rounded-2xl px-4 py-3 flex items-center gap-2">
                <Check size={14} />
                {successMessage}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-xs rounded-2xl px-4 py-3 flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* 2FA FIELD - shows only if enabled */}
              {show2FAField && requires2FA ? (
                <>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Enter 6-digit 2FA code"
                      value={form.twoFactorCode}
                      onChange={(e) =>
                        setForm({ ...form, twoFactorCode: e.target.value })
                      }
                      onKeyPress={handle2FAKeyPress}
                      maxLength={6}
                      autoFocus
                      className="w-full h-12 pl-10 pr-4 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black text-center text-lg tracking-wider"
                    />
                  </div>
                  
                  {/* Back to login button */}
                  <button
                    onClick={() => {
                      setShow2FAField(false)
                      setRequires2FA(false)
                      setPendingUser(null)
                      setForm({ ...form, twoFactorCode: '' })
                      setError('')
                    }}
                    className="text-xs text-gray-500 hover:text-black text-center block w-full"
                  >
                    ← Back to login
                  </button>

                  {/* Verify 2FA Button */}
                  <button
                    type="button"
                    onClick={verify2FACode}
                    disabled={loading}
                    className="w-full h-12 rounded-2xl bg-black text-white text-sm font-medium hover:bg-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? 'Verifying...' : 'Verify & Login'}
                  </button>
                </>
              ) : (
                <>
                  {/* IDENTIFIER */}
                  <div>
                    <input
                      type="email"
                      placeholder="Email address"
                      value={form.identifier}
                      onChange={(e) =>
                        setForm({ ...form, identifier: e.target.value })
                      }
                      className="w-full h-11 px-4 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                    />
                  </div>

                  {/* PASSWORD */}
                  <div className="relative">
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (!loading && !googleLoading) {
                              handleLogin()
                            }
                          }
                        }}
                        className="w-full h-11 px-4 pr-11 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-black"
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  {/* REMEMBER ME + FORGOT PASSWORD */}
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-gray-300 text-black focus:ring-black"
                      />
                      <span className="text-xs">Remember me</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs text-black hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* LOGIN BUTTON */}
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={loading || googleLoading}
                    className="w-full h-11 rounded-2xl bg-black text-white text-sm font-medium hover:bg-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>

                  {/* DIVIDER */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-3 bg-white text-gray-400">or</span>
                    </div>
                  </div>

                  {/* GOOGLE BUTTON */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading || googleLoading}
                    className="w-full h-11 rounded-2xl border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2"
                  >
                    {googleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FaGoogle className="text-red-500" />
                    )}
                    Continue with Google
                  </button>

                  {/* SIGN UP LINK */}
                  <div className="pt-2 text-center">
                    <p className="text-xs text-gray-500">
                      Don&apos;t have an account?{' '}
                      <button
                        onClick={() => router.push('/register')}
                        className="text-black font-medium hover:underline"
                      >
                        Create account
                      </button>
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-600">Loading login...</div>}>
      <LoginContent />
    </Suspense>
  )
}
