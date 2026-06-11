'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  Mail,
  Shield,
} from 'lucide-react'
import { FaGoogle } from 'react-icons/fa'

export default function SignUpPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const [registeredEmail, setRegisteredEmail] = useState('')
  const [showVerificationMessage, setShowVerificationMessage] = useState(false)

  const [resendTimer, setResendTimer] = useState(0)

  const [form, setForm] = useState({
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  })

  // PASSWORD CHECKS
  const passwordChecks = {
    length: form.password.length >= 8,
    hasLetter: /[A-Za-z]/.test(form.password),
    hasNumber: /[0-9]/.test(form.password),
  }

  const isStrongPassword =
    passwordChecks.length &&
    passwordChecks.hasLetter &&
    passwordChecks.hasNumber

  const startResendTimer = () => {
    setResendTimer(60)

    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const createAccount = async () => {
    setLoading(true)
    setError('')

    try {
      // VALIDATION
      if (!form.email.includes('@')) {
        throw new Error('Please enter a valid email')
      }

      if (!form.username.trim()) {
        throw new Error('Username is required')
      }

      if (!form.firstName.trim()) {
        throw new Error('First name is required')
      }

      if (!form.lastName.trim()) {
        throw new Error('Last name is required')
      }

      if (!isStrongPassword) {
        throw new Error(
          'Password must be at least 8 characters with letters and numbers'
        )
      }

      if (form.password !== form.confirmPassword) {
        throw new Error('Passwords do not match')
      }

      // CHECK USERNAME
      const { data: existingUsername } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', form.username)
        .maybeSingle()

      if (existingUsername) {
        throw new Error('Username already taken')
      }

      // SIGNUP
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent('/login?verified=true')}`,
          data: {
            username: form.username,
            first_name: form.firstName,
            last_name: form.lastName,
            provider: 'email',
          },
        },
      })

      if (signUpError) {
        if (signUpError.message.includes('Database error saving new user')) {
          throw new Error(
            'Supabase database trigger failed. Make sure your profiles trigger is configured correctly.'
          )
        }

        if (signUpError.message.includes('User already registered')) {
          throw new Error('This email is already registered')
        }

        throw signUpError
      }

      setRegisteredEmail(form.email)
      setShowVerificationMessage(true)
      startResendTimer()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const resendConfirmationEmail = async () => {
    if (resendTimer > 0) return

    setLoading(true)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: registeredEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent('/login?verified=true')}`,
        },
      })

      if (error) throw error

      startResendTimer()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent('/register/google')}`,
      },
    })

    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  // EMAIL VERIFICATION SCREEN
  if (showVerificationMessage) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-4xl bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-row">
            {/* LEFT SIDE - IMAGE */}
            <div className="hidden md:flex md:w-1/2 bg-black p-8 flex-col">
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Verify Your Email</h2>
                  <p className="text-gray-400 text-sm">
                    Almost there! Check your inbox to complete registration
                  </p>
                </div>
                
                <div className="my-8">
                  <div className="relative w-full h-64">
                    <img
                      src="/sign.png"
                      alt="ROCARS Automotive"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE - VERIFICATION FORM */}
            <div className="w-full md:w-1/2 p-6 md:p-8">
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center mx-auto mb-4">
                  <Mail size={24} />
                </div>
                <h1 className="text-2xl font-semibold text-black">
                  Verify your email
                </h1>
                <p className="text-sm text-gray-500 mt-2">
                  We sent a verification link to
                </p>
              </div>

              <div className="bg-gray-100 rounded-2xl py-3 px-4 mt-4 text-center">
                <p className="text-sm font-medium break-all">
                  {registeredEmail}
                </p>
              </div>

              <div className="mt-5 bg-gray-50 border border-gray-200 rounded-2xl p-4">
                <ul className="space-y-2 text-xs text-gray-600">
                  <li>• Check your spam or junk folder</li>
                  <li>• Verification link expires in 24 hours</li>
                  <li>• Login after verifying your email</li>
                </ul>
              </div>

              <button
                onClick={resendConfirmationEmail}
                disabled={loading || resendTimer > 0}
                className="w-full mt-5 bg-black hover:bg-gray-900 text-white py-3 rounded-2xl text-sm font-medium transition disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </div>
                ) : resendTimer > 0 ? (
                  `Resend in ${resendTimer}s`
                ) : (
                  'Resend Email'
                )}
              </button>

              <button
                onClick={() => setShowVerificationMessage(false)}
                className="w-full mt-3 text-sm text-gray-500 hover:text-black transition"
              >
                ← Back to signup
              </button>

              <div className="mt-5 pt-4 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-500">
                  Already verified?{' '}
                  <button
                    onClick={() => router.push('/login')}
                    className="font-medium text-black hover:underline"
                  >
                    Login
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // SIGNUP FORM
  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-4xl bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex flex-row">
          {/* LEFT SIDE - IMAGE */}
          <div className="hidden md:flex md:w-1/2 bg-black p-8 flex-col">
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Join ROCARS</h2>
                <p className="text-gray-400 text-sm">
                  Create an account to start shopping premium auto parts
                </p>
              </div>
              
              <div className="my-8">
                <div className="relative w-full h-90">
                  <img
                    src="/logo.png"
                    alt="ROCARS Automotive"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              <div className="mt-auto">
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                  <Shield size={14} />
                  <span>Secure registration with email verification</span>
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
                Create Account
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Join ROCARS Automotive
              </p>
            </div>

            {/* ERROR */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-xs rounded-2xl px-4 py-3 flex items-start gap-2">
                <Mail size={14} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              {/* EMAIL */}
              <input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
                className="w-full h-11 px-4 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
              />

              {/* USERNAME */}
              <div>
                <input
                  type="text"
                  placeholder="Username"
                  value={form.username}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      username: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, ''),
                    })
                  }
                  className="w-full h-11 px-4 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                />
                <p className="text-[10px] text-gray-400 mt-1 ml-1">
                  Lowercase letters and numbers only
                </p>
              </div>

              {/* NAME */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="First name"
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      firstName: e.target.value,
                    })
                  }
                  className="w-full h-11 px-4 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                />

                <input
                  type="text"
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lastName: e.target.value,
                    })
                  }
                  className="w-full h-11 px-4 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                />
              </div>

              {/* PASSWORD */}
              <div
                className="relative"
                onFocus={() => setFocusedField('password')}
                onBlur={() =>
                  setTimeout(() => setFocusedField(null), 200)
                }
              >
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        password: e.target.value,
                      })
                    }
                    className="w-full h-11 px-4 pr-11 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-3 top-3 text-gray-400 hover:text-black"
                  >
                    {showPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>

                {/* PASSWORD REQUIREMENTS */}
                {focusedField === 'password' &&
                  form.password &&
                  !isStrongPassword && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg p-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          {passwordChecks.length ? (
                            <Check size={12} className="text-green-500" />
                          ) : (
                            <X size={12} className="text-gray-300" />
                          )}
                          <span className={passwordChecks.length ? 'text-green-600' : 'text-gray-500'}>
                            8 characters
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          {passwordChecks.hasLetter ? (
                            <Check size={12} className="text-green-500" />
                          ) : (
                            <X size={12} className="text-gray-300" />
                          )}
                          <span className={passwordChecks.hasLetter ? 'text-green-600' : 'text-gray-500'}>
                            One letter
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          {passwordChecks.hasNumber ? (
                            <Check size={12} className="text-green-500" />
                          ) : (
                            <X size={12} className="text-gray-300" />
                          )}
                          <span className={passwordChecks.hasNumber ? 'text-green-600' : 'text-gray-500'}>
                            One number
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              {/* CONFIRM PASSWORD */}
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={form.confirmPassword}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full h-11 px-4 pr-11 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-3 text-gray-400 hover:text-black"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>

              {/* MATCH STATUS */}
              {form.confirmPassword && (
                <div className="flex items-center gap-1 text-xs">
                  {form.password === form.confirmPassword ? (
                    <>
                      <Check size={12} className="text-green-500" />
                      <span className="text-green-600">Passwords match</span>
                    </>
                  ) : (
                    <>
                      <X size={12} className="text-red-400" />
                      <span className="text-red-500">Passwords do not match</span>
                    </>
                  )}
                </div>
              )}

              {/* CREATE ACCOUNT BUTTON */}
              <button
                onClick={createAccount}
                disabled={
                  loading ||
                  !form.email ||
                  !form.username ||
                  !form.firstName ||
                  !form.lastName ||
                  !form.password ||
                  !form.confirmPassword ||
                  !isStrongPassword ||
                  form.password !== form.confirmPassword
                }
                className="w-full h-11 mt-2 rounded-2xl bg-black text-white text-sm font-medium hover:bg-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Account'
                )}
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
                onClick={handleGoogleSignUp}
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

              {/* LOGIN LINK */}
              <div className="pt-2 text-center">
                <p className="text-xs text-gray-500">
                  Already have an account?{' '}
                  <button
                    onClick={() => router.push('/login')}
                    className="text-black font-medium hover:underline"
                  >
                    Login
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
