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
  })

  const [userId, setUserId] = useState<string | null>(null)

  const cleanUsername = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, '')

  const getErrorMessage = (err: unknown) =>
    err instanceof Error ? err.message : 'Something went wrong'

  useEffect(() => {
    const loadGoogleUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const user = session?.user

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      const fullName = user.user_metadata?.full_name || ''
      const fallbackUsername = cleanUsername(
        user.user_metadata?.username || user.email?.split('@')[0] || ''
      )

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, first_name, last_name, avatar_url, provider')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.username && profile.provider === 'google') {
        router.replace('/')
        return
      }

      setForm((prev) => ({
        ...prev,
        email: user.email || '',
        firstName: profile?.first_name || fullName.split(' ')[0] || '',
        lastName:
          profile?.last_name || fullName.split(' ').slice(1).join(' ') || '',
        avatar: profile?.avatar_url || user.user_metadata?.avatar_url || '',
        username: profile?.username || fallbackUsername,
      }))
    }

    loadGoogleUser()
  }, [router])

  const completeRegistration = async () => {
    setLoading(true)
    setError('')

    try {
      if (!userId) throw new Error('User session not found')

      if (!form.username) {
        throw new Error('Username is required')
      }

      if (form.username.length < 3) {
        throw new Error('Username must be at least 3 characters')
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('User session not found')
      }

      const response = await fetch('/api/auth/complete-google-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to complete registration')
      }

      router.push('/')
    } catch (err) {
      console.error(err)
      setError(getErrorMessage(err))
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
            placeholder="First Name"
            value={form.firstName}
            onChange={(e) =>
              setForm({ ...form, firstName: e.target.value })
            }
            className="w-full border rounded-2xl px-4 py-3"
          />

          <input
            placeholder="Last Name"
            value={form.lastName}
            onChange={(e) =>
              setForm({ ...form, lastName: e.target.value })
            }
            className="w-full border rounded-2xl px-4 py-3"
          />

          <input
            placeholder="Username"
            value={form.username}
            onChange={(e) =>
              setForm({ ...form, username: cleanUsername(e.target.value) })
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
