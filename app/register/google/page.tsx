'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function GoogleRegisterPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    avatar: '',
    username: '',
    password: '',
    confirmPassword: '',
  })

  useEffect(() => {
    const loadGoogleUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setForm((prev) => ({
        ...prev,
        email: user.email || '',
        firstName:
          user.user_metadata?.full_name?.split(' ')[0] || '',
        lastName:
          user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
        avatar: user.user_metadata?.avatar_url || '',
      }))
    }

    loadGoogleUser()
  }, [router])

  const completeRegistration = async () => {
    setLoading(true)
    setError('')

    try {
      if (form.password !== form.confirmPassword) {
        throw new Error('Passwords do not match')
      }

      // Update password for OAuth account
      const { error: passwordError } =
        await supabase.auth.updateUser({
          password: form.password,
          data: {
            username: form.username,
            first_name: form.firstName,
            last_name: form.lastName,
            avatar_url: form.avatar,
          },
        })

      if (passwordError) throw passwordError

      // OPTIONAL:
      // Send email verification manually
      // if you want secondary verification

      router.push('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-lg">
        <h1 className="text-2xl font-bold mb-2">
          Complete Registration
        </h1>

        <p className="text-sm text-gray-500 mb-6">
          Finish setting up your ROCARS account
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <input
            value={form.email}
            disabled
            className="w-full border rounded-2xl px-4 py-3 bg-gray-100"
          />

          <input
            placeholder="Username"
            value={form.username}
            onChange={(e) =>
              setForm({ ...form, username: e.target.value })
            }
            className="w-full border rounded-2xl px-4 py-3"
          />

          <input
            type="password"
            placeholder="Create Password"
            value={form.password}
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
            className="w-full border rounded-2xl px-4 py-3"
          />

          <input
            type="password"
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={(e) =>
              setForm({
                ...form,
                confirmPassword: e.target.value,
              })
            }
            className="w-full border rounded-2xl px-4 py-3"
          />

          <button
            onClick={completeRegistration}
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-2xl"
          >
            {loading
              ? 'Completing Registration...'
              : 'Complete Registration'}
          </button>
        </div>
      </div>
    </div>
  )
}