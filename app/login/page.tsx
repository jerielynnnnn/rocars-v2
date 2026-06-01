'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import {
  Eye,
  EyeOff,
  Shield,
  Lock,
  Loader2,
  AlertCircle,
  Check,
  X,
} from 'lucide-react'
import { FaGoogle } from 'react-icons/fa'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const redirectTo = searchParams.get('redirect') || '/'
  const verified = searchParams.get('verified')

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
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('rocars_identifier')
    const remember = localStorage.getItem('rocars_remember')

    if (saved && remember === 'true') {
      setForm((p) => ({ ...p, identifier: saved }))
      setRememberMe(true)
    }
  }, [])

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) router.push(redirectTo)
    }
    check()
  }, [router, redirectTo])

  useEffect(() => {
    if (verified === 'true') {
      setSuccessMessage('Email verified successfully! You can now login.')
    }
  }, [verified])

  // =========================
  // LOGIN
  // =========================
const handleLogin = async () => {
  setLoading(true)
  setError('')
  setSuccessMessage('')

  try {
    if (!form.identifier || !form.password) {
      throw new Error('Please fill in all fields')
    }

    let emailToUse = form.identifier.trim()

    const isPhone = /^[0-9+]{10,15}$/.test(form.identifier)

    if (isPhone) {
      const { data } = await supabase
        .from('profiles')
        .select('email')
        .eq('phone_number', form.identifier)
        .maybeSingle()

      if (!data) throw new Error('Phone number not found')
      emailToUse = data.email
    } else if (!form.identifier.includes('@')) {
      const { data } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', form.identifier.toLowerCase())
        .maybeSingle()

      if (!data) throw new Error('Username not found')
      emailToUse = data.email
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: form.password,
    })

    if (error) throw error
    if (!data.user) throw new Error('Login failed')

    if (!data.user.email_confirmed_at) {
      await supabase.auth.signOut()
      throw new Error('Please verify your email first. Check your inbox.')
    }

    setUserId(data.user.id)

    const { data: settings } = await supabase
      .from('two_factor_auth')
      .select('enabled, passcode')
      .eq('user_id', data.user.id)
      .maybeSingle()

    // FIXED: Handle 2FA without throwing error
    if (settings?.enabled) {
      // If we haven't entered 2FA code yet, show the field and stop
      if (!form.twoFactorCode) {
        setRequires2FA(true)
        setShow2FAField(true)
        setLoading(false) // Important: stop loading state
        return // Just return, don't throw error
      }

      // If we have a code, verify it
      if (form.twoFactorCode !== settings.passcode) {
        await supabase.auth.signOut()
        throw new Error('Invalid 2FA code')
      }
    }

    // Only proceed with login if no 2FA or 2FA is verified
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
      .eq('id', data.user.id)

    await new Promise(resolve => setTimeout(resolve, 500))
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, username, email')
      .eq('id', data.user.id)
      .maybeSingle()

    console.log('Profile data:', profile)
    console.log('Profile error:', profileError)
    console.log('Is admin?', profile?.role === 'admin')

    if (profile?.role) {
      sessionStorage.setItem('userRole', profile.role)
    }

    if (profile?.role === 'admin') {
      console.log('Redirecting to admin dashboard...')
      router.push('/admin/dashboard')
    } else {
      console.log('Redirecting to:', redirectTo)
      router.push(redirectTo)
    }
  } catch (err: any) {
    console.error('Login error:', err)
    setError(err.message || 'Login failed')
  } finally {
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
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirectTo}`,
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
      setError('Enter your email, username, or phone number first')
      return
    }

    let emailToUse = form.identifier.trim()

    const isPhone = /^[0-9+]{10,15}$/.test(form.identifier)

    try {
      if (isPhone) {
        const { data } = await supabase
          .from('profiles')
          .select('email')
          .eq('phone_number', form.identifier)
          .maybeSingle()

        if (!data) throw new Error('Phone number not found')
        emailToUse = data.email
      } else if (!form.identifier.includes('@')) {
        const { data } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', form.identifier.toLowerCase())
          .maybeSingle()

        if (!data) throw new Error('Username not found')
        emailToUse = data.email
      }

      const { error } = await supabase.auth.resetPasswordForEmail(
        emailToUse,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      )

      if (error) throw error

      setSuccessMessage('Password reset link sent to your email!')
    } catch (err: any) {
      setError(err.message)
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
                <h2 className="text-2xl font-bold text-white mb-2">Login</h2>
                <p className="text-gray-400 text-sm">
                  Sign in to access your account.
                </p>
              </div>
              
              {/* Both Images Container */}
    <div className="my-2 space-y-6">
      {/* Logo Image */}
      <div className="relative w-full h-35">
        <img
          src="/logo.png"
          alt="ROCARS Automotive"
          className="w-99  h-77 object-contain"
        />
      </div>
      
      {/* Tire Image */}
      <div className="relative w-full h-50">
        <img
          src="/tirepc.png"
          alt="Tire"
          className="w-99 h-66 object-contain"
        />
      </div>
    </div>

              <div className="mt-auto">
                <div className="flex items-center gap-2 text-gray-500 text-xs">
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
                Welcome Back
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Sign in to your account
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
              {/* IDENTIFIER */}
              <div>
                <input
                  type="text"
                  placeholder="Email / Username / Phone number"
                  value={form.identifier}
                  onChange={(e) =>
                    setForm({ ...form, identifier: e.target.value })
                  }
                  className="w-full h-11 px-4 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                />
              </div>

              {/* PASSWORD */}
              <div
                className="relative"
                onFocus={() => setFocusedField('password')}
                onBlur={() => setTimeout(() => setFocusedField(null), 200)}
              >
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
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

              {/* 2FA FIELD - shows only if enabled */}
              {show2FAField && requires2FA && (
                <div className="relative">
                  <Lock className="absolute left-4 top-3 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="2FA Verification Code"
                    value={form.twoFactorCode}
                    onChange={(e) =>
                      setForm({ ...form, twoFactorCode: e.target.value })
                    }
                    className="w-full h-11 pl-10 pr-4 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                  />
                </div>
              )}

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
                onClick={handleLogin}
                disabled={loading}
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
                onClick={handleGoogleLogin}
                disabled={googleLoading}
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
                  Don't have an account?{' '}
                  <button
                    onClick={() => router.push('/register')}
                    className="text-black font-medium hover:underline"
                  >
                    Create account
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}