// app/profile/security/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Smartphone,
  LogOut,
  Key,
  ChevronRight,
  X,
  ArrowLeft,
  Bell,
  Mail,
  BellRing,
  MessageSquare,
  ShoppingBag,
  Tag,
  Users,
  Globe,
  Moon,
  Sun,
  Monitor,
  Heart, // ← Added Heart import
} from 'lucide-react'

interface NotificationSettings {
  email_notifications_enabled: boolean
  push_notifications_enabled: boolean
  sms_notifications_enabled: boolean
  notify_order_updates: boolean
  notify_promotions: boolean
  notify_product_alerts: boolean
  notify_review_responses: boolean
  notify_wishlist_updates: boolean
}

interface PreferenceSettings {
  preferred_language: string
  timezone: string
  date_format: string
  theme: 'light' | 'dark' | 'system'
}

export default function SecurityPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [isLoading2FA, setIsLoading2FA] = useState(true)
  const [showPasscodeForm, setShowPasscodeForm] = useState(false)

  const [passwordData, setPasswordData] = useState({
    new_password: '',
    confirm_password: '',
  })

  const [passcodeData, setPasscodeData] = useState({
    passcode: '',
    confirm_passcode: '',
  })

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_notifications_enabled: true,
    push_notifications_enabled: true,
    sms_notifications_enabled: false,
    notify_order_updates: true,
    notify_promotions: false,
    notify_product_alerts: true,
    notify_review_responses: true,
    notify_wishlist_updates: false,
  })

  const [preferenceSettings, setPreferenceSettings] = useState<PreferenceSettings>({
    preferred_language: 'en',
    timezone: 'UTC',
    date_format: 'YYYY-MM-DD',
    theme: 'system',
  })

  useEffect(() => {
    check2FAStatus()
    loadNotificationSettings()
    loadPreferenceSettings()
  }, [])

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 4000)
  }

  // =========================
  // CHECK 2FA STATUS
  // =========================
  const check2FAStatus = async () => {
    try {
      setIsLoading2FA(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('two_factor_auth')
        .select('enabled')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      setTwoFactorEnabled(data?.enabled || false)
    } catch (error: any) {
      console.error(error)
      showToast('Failed to load security settings', 'error')
    } finally {
      setIsLoading2FA(false)
    }
  }

  // =========================
  // LOAD NOTIFICATION SETTINGS
  // =========================
  const loadNotificationSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_profile_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setNotificationSettings({
          email_notifications_enabled: data.email_notifications_enabled ?? true,
          push_notifications_enabled: data.push_notifications_enabled ?? true,
          sms_notifications_enabled: data.sms_notifications_enabled ?? false,
          notify_order_updates: data.notify_order_updates ?? true,
          notify_promotions: data.notify_promotions ?? false,
          notify_product_alerts: data.notify_product_alerts ?? true,
          notify_review_responses: data.notify_review_responses ?? true,
          notify_wishlist_updates: data.notify_wishlist_updates ?? false,
        })
      }
    } catch (error: any) {
      console.error('Error loading notification settings:', error)
    }
  }

  // =========================
  // LOAD PREFERENCE SETTINGS
  // =========================
  const loadPreferenceSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_profile_settings')
        .select('preferred_language, timezone, date_format')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setPreferenceSettings(prev => ({
          ...prev,
          preferred_language: data.preferred_language || 'en',
          timezone: data.timezone || 'UTC',
          date_format: data.date_format || 'YYYY-MM-DD',
        }))
      }
    } catch (error: any) {
      console.error('Error loading preference settings:', error)
    }
  }

  // =========================
  // SAVE NOTIFICATION SETTINGS
  // =========================
  const saveNotificationSettings = async () => {
    setLoadingNotifications(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('user_profile_settings')
        .upsert({
          user_id: user.id,
          ...notificationSettings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (error) throw error

      showToast('Notification settings saved successfully!')
    } catch (error: any) {
      console.error('Error saving notification settings:', error)
      showToast(error.message || 'Failed to save notification settings', 'error')
    } finally {
      setLoadingNotifications(false)
    }
  }

  // =========================
  // SAVE PREFERENCE SETTINGS
  // =========================
  const savePreferenceSettings = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('user_profile_settings')
        .upsert({
          user_id: user.id,
          preferred_language: preferenceSettings.preferred_language,
          timezone: preferenceSettings.timezone,
          date_format: preferenceSettings.date_format,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (error) throw error

      showToast('Preferences saved successfully!')
    } catch (error: any) {
      console.error('Error saving preference settings:', error)
      showToast(error.message || 'Failed to save preferences', 'error')
    } finally {
      setLoading(false)
    }
  }

  // =========================
  // CHANGE PASSWORD
  // =========================
  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      setLoading(true)

      if (passwordData.new_password !== passwordData.confirm_password) {
        showToast('Passwords do not match', 'error')
        return
      }

      if (passwordData.new_password.length < 6) {
        showToast('Password must be at least 6 characters', 'error')
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: passwordData.new_password,
      })

      if (error) throw error

      setPasswordData({ new_password: '', confirm_password: '' })
      showToast('Password updated successfully')
    } catch (error: any) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // =========================
  // ENABLE 2FA
  // =========================
  const handleEnable2FA = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      setLoading(true)

      if (passcodeData.passcode !== passcodeData.confirm_passcode) {
        showToast('2FA codes do not match', 'error')
        return
      }

      if (!/^\d{6}$/.test(passcodeData.passcode)) {
        showToast('2FA must be 6 digits', 'error')
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const plainCode = passcodeData.passcode
      const { data: existing } = await supabase
        .from('two_factor_auth')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('two_factor_auth')
          .update({
            enabled: true,
            passcode: plainCode,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('two_factor_auth').insert({
          user_id: user.id,
          enabled: true,
          passcode: plainCode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        if (error) throw error
      }

      setTwoFactorEnabled(true)
      setShowPasscodeForm(false)
      setPasscodeData({ passcode: '', confirm_passcode: '' })
      showToast('2FA enabled successfully')
    } catch (err: any) {
      console.error('Error enabling 2FA:', err)
      showToast(err.message || 'Failed to enable 2FA', 'error')
    } finally {
      setLoading(false)
    }
  }

  // =========================
  // DISABLE 2FA
  // =========================
  const handleDisable2FA = async () => {
    const confirmed = confirm('Are you sure you want to disable 2FA? This will make your account less secure.')
    if (!confirmed) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('two_factor_auth')
        .update({
          enabled: false,
          passcode: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (error) throw error
      setTwoFactorEnabled(false)
      showToast('2FA disabled successfully')
    } catch (error: any) {
      showToast(error.message, 'error')
    }
  }

  // =========================
  // SIGN OUT ALL
  // =========================
  const handleSignOutAll = async () => {
    const confirmed = confirm('Sign out from all devices? You will need to log in again on all devices.')
    if (!confirmed) return

    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error: any) {
      showToast(error.message, 'error')
    }
  }

  // =========================
  // BACK TO PROFILE
  // =========================
  const handleBackToProfile = () => {
    router.push('/profile')
  }

  const timezones = [
    'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 
    'Europe/Paris', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Manila', 
    'Australia/Sydney', 'Pacific/Auckland'
  ]

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'zh', name: '中文' },
    { code: 'tl', name: 'Filipino' },
  ]

  const dateFormats = [
    { value: 'YYYY-MM-DD', label: '2024-01-31' },
    { value: 'MM/DD/YYYY', label: '01/31/2024' },
    { value: 'DD/MM/YYYY', label: '31/01/2024' },
    { value: 'MMMM D, YYYY', label: 'January 31, 2024' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* BACK BUTTON & HEADER */}
        <div className="mb-6">
          <button
            onClick={handleBackToProfile}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-black transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Profile</span>
          </button>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Security & Preferences</h1>
              <p className="text-gray-500 mt-1">Manage your account security, notifications, and preferences</p>
            </div>
          </div>
        </div>

        {/* ALERT MESSAGE */}
        {message && (
          <div className={`mb-6 flex items-center gap-2 rounded-xl border px-4 py-3 ${
            messageType === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {messageType === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span className="flex-1 text-sm">{message}</span>
            <button onClick={() => setMessage('')} className="hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* SIDEBAR */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border shadow-sm sticky top-24">
              <div className="p-5 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Settings Center</h3>
                    <p className="text-xs text-gray-500">All your preferences</p>
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-1">
                <button onClick={() => document.getElementById('password-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full flex items-center justify-between hover:bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 transition-colors">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    <span>Password</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
                
                <button onClick={() => document.getElementById('2fa-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full flex items-center justify-between hover:bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 transition-colors">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>Two-Factor Auth</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                <button onClick={() => document.getElementById('notifications-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full flex items-center justify-between hover:bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 transition-colors">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    <span>Notifications</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                <button onClick={() => document.getElementById('preferences-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full flex items-center justify-between hover:bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 transition-colors">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <span>Preferences</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
                
                <button onClick={() => document.getElementById('sessions-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full flex items-center justify-between hover:bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 transition-colors">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    <span>Session Management</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="lg:col-span-3 space-y-6">

            {/* PASSWORD SECTION */}
            <div id="password-section" className="bg-white rounded-2xl border shadow-sm scroll-mt-24">
              <div className="p-5 border-b bg-gray-50 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 text-lg">Change Password</h2>
                    <p className="text-sm text-gray-500">Update your account password regularly</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-black focus:border-black outline-none"
                      placeholder="Enter new password"
                      required
                      minLength={6}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-black outline-none"
                    placeholder="Confirm new password"
                    required
                  />
                </div>

                <button type="submit" disabled={loading}
                  className="inline-flex items-center gap-2 bg-black text-white rounded-xl px-6 py-3 hover:bg-gray-800 transition disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Update Password
                </button>
              </form>
            </div>

            {/* 2FA SECTION */}
            <div id="2fa-section" className="bg-white rounded-2xl border shadow-sm scroll-mt-24">
              <div className="p-5 border-b bg-gray-50 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 text-lg">Two-Factor Authentication</h2>
                    <p className="text-sm text-gray-500">Add an extra layer of security</p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                {isLoading2FA ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${twoFactorEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <h3 className="font-medium text-gray-900">
                            {twoFactorEnabled ? '2FA is Active' : '2FA is Disabled'}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-500">
                          {twoFactorEnabled
                            ? 'Your account is protected with two-factor authentication'
                            : 'Enable 2FA to add an extra layer of security'}
                        </p>
                      </div>

                      {!twoFactorEnabled ? (
                        <button onClick={() => setShowPasscodeForm(!showPasscodeForm)}
                          className="bg-black text-white rounded-xl px-6 py-2.5 hover:bg-gray-800 transition font-medium">
                          {showPasscodeForm ? 'Cancel' : 'Enable 2FA'}
                        </button>
                      ) : (
                        <button onClick={handleDisable2FA}
                          className="border border-red-500 text-red-600 rounded-xl px-6 py-2.5 hover:bg-red-50 transition font-medium">
                          Disable 2FA
                        </button>
                      )}
                    </div>

                    {showPasscodeForm && !twoFactorEnabled && (
                      <form onSubmit={handleEnable2FA} className="mt-6 space-y-4 border-t pt-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <p className="text-sm text-blue-800">
                            <strong>Important:</strong> Set a 6-digit code for login verification. Store it securely.
                          </p>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-gray-700 block mb-1">6-Digit 2FA Code</label>
                          <input
                            type="password"
                            maxLength={6}
                            value={passcodeData.passcode}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '')
                              setPasscodeData({ ...passcodeData, passcode: value })
                            }}
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-black outline-none"
                            placeholder="123456"
                            required
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium text-gray-700 block mb-1">Confirm 2FA Code</label>
                          <input
                            type="password"
                            maxLength={6}
                            value={passcodeData.confirm_passcode}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '')
                              setPasscodeData({ ...passcodeData, confirm_passcode: value })
                            }}
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-black outline-none"
                            placeholder="123456"
                            required
                          />
                        </div>

                        <button type="submit" disabled={loading}
                          className="w-full bg-black text-white rounded-xl px-6 py-3 hover:bg-gray-800 transition disabled:opacity-50 font-medium">
                          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save 2FA Code'}
                        </button>
                      </form>
                    )}

                    {twoFactorEnabled && (
                      <div className="mt-5 bg-green-50 border border-green-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-green-800">2FA protection is active</p>
                            <p className="text-xs text-green-700 mt-1">Your account is protected with two-factor authentication.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* NOTIFICATION SETTINGS SECTION */}
            <div id="notifications-section" className="bg-white rounded-2xl border shadow-sm scroll-mt-24">
              <div className="p-5 border-b bg-gray-50 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 text-lg">Notification Settings</h2>
                    <p className="text-sm text-gray-500">Choose how and when you want to be notified</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-6">
                {/* Notification Channels */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <BellRing className="w-4 h-4" />
                    Notification Channels
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-gray-600" />
                        <div>
                          <span className="text-sm font-medium text-gray-700">Email Notifications</span>
                          <p className="text-xs text-gray-500">Receive notifications via email</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.email_notifications_enabled}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, email_notifications_enabled: e.target.checked })}
                        className="w-4 h-4 text-black rounded focus:ring-black"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-gray-600" />
                        <div>
                          <span className="text-sm font-medium text-gray-700">Push Notifications</span>
                          <p className="text-xs text-gray-500">Browser push notifications</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.push_notifications_enabled}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, push_notifications_enabled: e.target.checked })}
                        className="w-4 h-4 text-black rounded focus:ring-black"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-5 h-5 text-gray-600" />
                        <div>
                          <span className="text-sm font-medium text-gray-700">SMS Notifications</span>
                          <p className="text-xs text-gray-500">Text message notifications</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.sms_notifications_enabled}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, sms_notifications_enabled: e.target.checked })}
                        className="w-4 h-4 text-black rounded focus:ring-black"
                      />
                    </label>
                  </div>
                </div>

                {/* Notification Types */}
                <div className="pt-4 border-t">
                  <h3 className="font-medium text-gray-900 mb-3">Notify me about</h3>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm text-gray-700">Order updates & status changes</span>
                        <p className="text-xs text-gray-400">Shipping, delivery, and order confirmations</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.notify_order_updates}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, notify_order_updates: e.target.checked })}
                        className="w-4 h-4 text-black rounded focus:ring-black"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">Promotions & special offers</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.notify_promotions}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, notify_promotions: e.target.checked })}
                        className="w-4 h-4 text-black rounded focus:ring-black"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">Product alerts & restocks</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.notify_product_alerts}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, notify_product_alerts: e.target.checked })}
                        className="w-4 h-4 text-black rounded focus:ring-black"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">Review responses & replies</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.notify_review_responses}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, notify_review_responses: e.target.checked })}
                        className="w-4 h-4 text-black rounded focus:ring-black"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">Wishlist updates</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.notify_wishlist_updates}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, notify_wishlist_updates: e.target.checked })}
                        className="w-4 h-4 text-black rounded focus:ring-black"
                      />
                    </label>
                  </div>
                </div>

                <button onClick={saveNotificationSettings} disabled={loadingNotifications}
                  className="w-full bg-black text-white rounded-xl px-6 py-3 hover:bg-gray-800 transition disabled:opacity-50 font-medium">
                  {loadingNotifications ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Notification Settings'}
                </button>
              </div>
            </div>

            {/* PREFERENCES SECTION */}
            <div id="preferences-section" className="bg-white rounded-2xl border shadow-sm scroll-mt-24">
              <div className="p-5 border-b bg-gray-50 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 text-lg">Preferences</h2>
                    <p className="text-sm text-gray-500">Customize your experience</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Language</label>
                  <select
                    value={preferenceSettings.preferred_language}
                    onChange={(e) => setPreferenceSettings({ ...preferenceSettings, preferred_language: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-black outline-none"
                  >
                    {languages.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Timezone</label>
                  <select
                    value={preferenceSettings.timezone}
                    onChange={(e) => setPreferenceSettings({ ...preferenceSettings, timezone: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-black outline-none"
                  >
                    {timezones.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Date Format</label>
                  <select
                    value={preferenceSettings.date_format}
                    onChange={(e) => setPreferenceSettings({ ...preferenceSettings, date_format: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-black outline-none"
                  >
                    {dateFormats.map(format => (
                      <option key={format.value} value={format.value}>{format.label}</option>
                    ))}
                  </select>
                </div>

                <button onClick={savePreferenceSettings} disabled={loading}
                  className="w-full bg-black text-white rounded-xl px-6 py-3 hover:bg-gray-800 transition disabled:opacity-50 font-medium">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Preferences'}
                </button>
              </div>
            </div>

            {/* SESSIONS SECTION */}
            <div id="sessions-section" className="bg-white rounded-2xl border shadow-sm scroll-mt-24">
              <div className="p-5 border-b bg-gray-50 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 text-lg">Session Management</h2>
                    <p className="text-sm text-gray-500">Manage active devices and sessions</p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Warning: This will log you out everywhere</p>
                      <p className="text-xs text-yellow-700 mt-1">Signing out from all devices will terminate every active session.</p>
                    </div>
                  </div>
                </div>

                <button onClick={handleSignOutAll}
                  className="w-full flex items-center justify-center gap-2 border-2 border-red-500 text-red-600 rounded-xl px-6 py-3 hover:bg-red-50 transition font-medium">
                  <LogOut className="w-4 h-4" />
                  Sign Out From All Devices
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}