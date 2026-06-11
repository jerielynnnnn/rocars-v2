// app/admin/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import TwoFactorSetup from '@/components/TwoFactorSetup'
import {
  Shield, Key, Bell, User, Globe, Database,
  Activity, Eye, EyeOff, Save, RefreshCw,
  CheckCircle, AlertCircle, Loader2, ChevronRight,
  Fingerprint, ShieldAlert, Trash2, Plus
} from 'lucide-react'

interface AdminSettings {
  id: number
  user_id: string
  two_factor_enabled: boolean
  session_timeout_minutes: number
  login_alerts: boolean
  ip_whitelist_enabled: boolean
  ip_whitelist: string[]
  activity_logging: boolean
  audit_retention_days: number
  max_login_attempts: number
}

interface AdminLog {
  id: number
  admin_id: string
  actor_name?: string
  actor_role?: string | null
  action: string
  target_type: string
  target_id: string
  details: Record<string, unknown> | null
  ip_address: string
  created_at: string
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('security')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminRole, setAdminRole] = useState('')
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false)
  const [twoFactorBusy, setTwoFactorBusy] = useState(false)
  
  // Security Settings
  const [settings, setSettings] = useState<AdminSettings>({
    id: 0,
    user_id: '',
    two_factor_enabled: false,
    session_timeout_minutes: 30,
    login_alerts: true,
    ip_whitelist_enabled: false,
    ip_whitelist: [],
    activity_logging: true,
    audit_retention_days: 90,
    max_login_attempts: 5
  })
  
  const [newIp, setNewIp] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  
  // Recent activity logs
  const [recentActivity, setRecentActivity] = useState<AdminLog[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  
  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('admin-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profile_settings'
        },
        (payload) => {
          console.log('Realtime update received:', payload)
          fetchSettings()
        }
      )
      .subscribe()

    return channel
  }

  const fetchAdminData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setAdminEmail(user.email || '')
        setSettings(prev => ({ ...prev, user_id: user.id }))
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, role')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setAdminName(`${profile.first_name} ${profile.last_name}`)
          setAdminRole(profile.role)
        }
      }
    } catch (error) {
      console.error('Error fetching admin data:', error)
    }
  }

  const getLocalSettings = (userId: string) => {
    if (typeof window === 'undefined') return {}

    try {
      return JSON.parse(localStorage.getItem(`rocars-admin-settings:${userId}`) || '{}')
    } catch {
      return {}
    }
  }

  const saveLocalSettings = (userId: string, nextSettings: AdminSettings) => {
    if (typeof window === 'undefined') return

    localStorage.setItem(
      `rocars-admin-settings:${userId}`,
      JSON.stringify({
        ip_whitelist_enabled: nextSettings.ip_whitelist_enabled,
        ip_whitelist: nextSettings.ip_whitelist,
        activity_logging: nextSettings.activity_logging,
        audit_retention_days: nextSettings.audit_retention_days,
        max_login_attempts: nextSettings.max_login_attempts,
      })
    )
  }

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/admin/settings', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const result = await response.json()

      if (response.ok && result.settings) {
        const data = result.settings
        const localSettings = getLocalSettings(user.id) as Partial<AdminSettings>
        setSettings({
          id: data.id,
          user_id: data.user_id,
          two_factor_enabled: data.two_factor_enabled || false,
          session_timeout_minutes: data.session_timeout_minutes || 30,
          login_alerts: data.email_notifications_enabled || true,
          ip_whitelist_enabled: localSettings.ip_whitelist_enabled ?? false,
          ip_whitelist: Array.isArray(localSettings.ip_whitelist) ? localSettings.ip_whitelist : [],
          activity_logging: localSettings.activity_logging ?? true,
          audit_retention_days: localSettings.audit_retention_days ?? 90,
          max_login_attempts: localSettings.max_login_attempts ?? 5
        })
      } else if (!response.ok) {
        console.error('Error fetching settings:', result.error)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentActivity = async () => {
    setActivityLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/admin/activity-logs', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const result = await response.json()

      if (response.ok) {
        setRecentActivity((result.logs || []) as AdminLog[])
      } else {
        console.error('Error fetching activity:', result.error)
        setRecentActivity([])
      }
    } catch (error) {
      console.error('Error fetching activity:', error)
      setRecentActivity([])
    } finally {
      setActivityLoading(false)
    }
  }

  const logAdminAction = async (action: string, details?: Record<string, unknown>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      await fetch('/api/admin/activity-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action,
          target_type: 'user_profile_settings',
          target_id: user.id,
          details: details || { timestamp: new Date().toISOString() },
          ip_address: 'unknown',
        }),
      })
      
      // Refresh activity logs
      fetchRecentActivity()
    } catch (error) {
      console.error('Error logging admin action:', error)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setSaveSuccess(false)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Session expired')

      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          two_factor_enabled: settings.two_factor_enabled,
          login_alerts: settings.login_alerts,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save settings')
      }

      saveLocalSettings(user.id, settings)

      // Log the action
      await logAdminAction('UPDATE_SETTINGS', { tab: activeTab })

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    setPasswordError('')
    setPasswordSuccess('')

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError('New passwords do not match')
      return
    }

    if (passwordData.new_password.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }

    const hasUpperCase = /[A-Z]/.test(passwordData.new_password)
    const hasLowerCase = /[a-z]/.test(passwordData.new_password)
    const hasNumbers = /\d/.test(passwordData.new_password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.new_password)

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      setPasswordError('Password must contain uppercase, lowercase, number, and special character')
      return
    }

    try {
      if (!passwordData.current_password) {
        throw new Error('Current password is required')
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: passwordData.current_password
      })

      if (verifyError) {
        throw new Error('Current password is incorrect')
      }

      const { error } = await supabase.auth.updateUser({
        password: passwordData.new_password
      })

      if (error) throw error

      await logAdminAction('PASSWORD_CHANGE')

      setPasswordSuccess('Password changed successfully!')
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
      setShowPasswordForm(false)
      
      setTimeout(() => setPasswordSuccess(''), 3000)
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password')
    }
  }

  const completeTwoFactorSetup = async () => {
    setSettings(prev => ({ ...prev, two_factor_enabled: true }))
    setShowTwoFactorSetup(false)
    await logAdminAction('ENABLE_TWO_FACTOR_AUTH')
  }

  const disableTwoFactor = async () => {
    if (!confirm('Disable two-factor authentication for this account?')) return

    setTwoFactorBusy(true)
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to disable two-factor authentication')
      }

      setSettings(prev => ({ ...prev, two_factor_enabled: false }))
      setShowTwoFactorSetup(false)
      await logAdminAction('DISABLE_TWO_FACTOR_AUTH')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to disable two-factor authentication')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const addIpToWhitelist = () => {
    if (newIp && !settings.ip_whitelist.includes(newIp)) {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
      if (ipRegex.test(newIp) || newIp === 'localhost' || newIp === '127.0.0.1') {
        setSettings({
          ...settings,
          ip_whitelist: [...settings.ip_whitelist, newIp]
        })
        setNewIp('')
        logAdminAction('ADD_IP_TO_WHITELIST', { ip: newIp })
      } else {
        alert('Invalid IP address format')
      }
    }
  }

  const removeIpFromWhitelist = (ip: string) => {
    setSettings({
      ...settings,
      ip_whitelist: settings.ip_whitelist.filter(i => i !== ip)
    })
    logAdminAction('REMOVE_IP_FROM_WHITELIST', { ip })
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'UPDATE_SETTINGS': return <Save className="h-4 w-4 text-blue-500" />
      case 'PASSWORD_CHANGE': return <Key className="h-4 w-4 text-yellow-500" />
      case 'ENABLE_TWO_FACTOR_AUTH': return <Fingerprint className="h-4 w-4 text-green-500" />
      case 'DISABLE_TWO_FACTOR_AUTH': return <Fingerprint className="h-4 w-4 text-red-500" />
      case 'ADD_IP_TO_WHITELIST': return <Plus className="h-4 w-4 text-green-500" />
      case 'REMOVE_IP_FROM_WHITELIST': return <Trash2 className="h-4 w-4 text-red-500" />
      default: return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const tabs = [
    { id: 'security', label: 'Security', icon: Shield, description: 'Password, 2FA, and access controls' },
    { id: 'audit', label: 'Audit Logs', icon: Activity, description: 'Track admin activities' },
  ]

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAdminData()
    fetchSettings()
    fetchRecentActivity()
    setupRealtimeSubscription()

    return () => {
      supabase.removeAllChannels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="h-12 w-12 animate-spin text-black" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-6 w-6 text-black" />
            <h1 className="text-3xl font-bold text-gray-900">Security Settings</h1>
          </div>
          <p className="text-sm text-gray-500">Manage your admin account security and preferences</p>
        </div>
        
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Admin Info Card */}
      <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-black flex items-center justify-center">
            <User className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{adminName}</h2>
            <p className="text-gray-500">{adminEmail}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                {adminRole === 'admin' ? 'Super Administrator' : 'Administrator'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 animate-in fade-in duration-300">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <p className="text-green-700">Settings saved successfully!</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 px-1 text-sm font-medium transition flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'text-black border-b-2 border-black'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Password Change */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Key className="h-5 w-5 text-blue-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Change Password</h3>
                    <p className="text-sm text-gray-500">Update your admin account password</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                  className="text-sm text-black font-medium hover:underline"
                >
                  {showPasswordForm ? 'Cancel' : 'Change'}
                </button>
              </div>
            </div>

            {showPasswordForm && (
              <div className="p-6 space-y-4">
                {passwordError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-600">{passwordError}</p>
                  </div>
                )}
                {passwordSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-green-600">{passwordSuccess}</p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black pr-10"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black pr-10"
                      placeholder="Min. 8 characters with uppercase, lowercase, number & special char"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Password must contain at least 8 characters, uppercase, lowercase, number, and special character
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Confirm new password"
                  />
                </div>
                
                <button
                  onClick={changePassword}
                  className="w-full px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition"
                >
                  Update Password
                </button>
              </div>
            )}
          </div>

          {/* Two-Factor Authentication */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                  <Fingerprint className="h-5 w-5 text-yellow-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                </div>
              </div>
              {settings.two_factor_enabled ? (
                <button
                  onClick={disableTwoFactor}
                  disabled={twoFactorBusy}
                  className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  {twoFactorBusy ? 'Disabling...' : 'Disable'}
                </button>
              ) : (
                <button
                  onClick={() => setShowTwoFactorSetup(true)}
                  className="px-3 py-1.5 text-sm text-white bg-black rounded-lg hover:bg-gray-800"
                >
                  Enable
                </button>
              )}
            </div>
            {settings.two_factor_enabled ? (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-sm font-medium text-green-800">Two-factor authentication is enabled.</p>
                <p className="text-sm text-green-700 mt-1">You will be asked for an authenticator code when signing in.</p>
              </div>
            ) : showTwoFactorSetup ? (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                <TwoFactorSetup
                  onComplete={completeTwoFactorSetup}
                  onCancel={() => setShowTwoFactorSetup(false)}
                />
              </div>
            ) : null}
          </div>

          {/* IP Whitelist */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-purple-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">IP Whitelist</h3>
                  <p className="text-sm text-gray-500">Restrict admin access to specific IP addresses</p>
                </div>
              </div>
              <button
                onClick={() => setSettings({...settings, ip_whitelist_enabled: !settings.ip_whitelist_enabled})}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  settings.ip_whitelist_enabled ? 'bg-black' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  settings.ip_whitelist_enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            
            {settings.ip_whitelist_enabled && (
              <div className="mt-4">
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    placeholder="Enter IP address (e.g., 192.168.1.1)"
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                    onKeyPress={(e) => e.key === 'Enter' && addIpToWhitelist()}
                  />
                  <button
                    onClick={addIpToWhitelist}
                    className="px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {settings.ip_whitelist.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No IP addresses added yet</p>
                  ) : (
                    settings.ip_whitelist.map((ip, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <code className="text-sm text-gray-700">{ip}</code>
                        <button
                          onClick={() => removeIpFromWhitelist(ip)}
                          className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Login Alerts */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Login Alerts</h3>
                  <p className="text-sm text-gray-500">Receive email notifications for new login attempts</p>
                </div>
              </div>
              <button
                onClick={() => setSettings({...settings, login_alerts: !settings.login_alerts})}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  settings.login_alerts ? 'bg-black' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  settings.login_alerts ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Max Login Attempts */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Brute Force Protection</h3>
                <p className="text-sm text-gray-500">Limit failed login attempts</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Login Attempts
              </label>
              <select
                value={settings.max_login_attempts}
                onChange={(e) => setSettings({...settings, max_login_attempts: parseInt(e.target.value)})}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value={3}>3 attempts</option>
                <option value={5}>5 attempts</option>
                <option value={10}>10 attempts</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Account will be temporarily locked after exceeding attempts
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Session Tab */}
      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Audit Settings */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Database className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Audit Settings</h3>
                <p className="text-sm text-gray-500">Configure activity logging and retention</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Enable Activity Logging</p>
                  <p className="text-sm text-gray-500">Log all admin actions for audit purposes</p>
                </div>
                <button
                  onClick={() => setSettings({...settings, activity_logging: !settings.activity_logging})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    settings.activity_logging ? 'bg-black' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.activity_logging ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Audit Retention (days)
                </label>
                <select
                  value={settings.audit_retention_days}
                  onChange={(e) => setSettings({...settings, audit_retention_days: parseInt(e.target.value)})}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                  <option value={365}>1 year</option>
                </select>
              </div>
            </div>
          </div>

          {/* Recent Activity Logs */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Recent Activity</h3>
                <p className="text-sm text-gray-500">Latest admin and staff actions</p>
              </div>
              <button
                onClick={fetchRecentActivity}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-black"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {activityLoading ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  Loading activities...
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  No recent activity found
                </div>
              ) : (
                recentActivity.map((log) => (
                  <div key={log.id} className="px-6 py-4 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getActionIcon(log.action)}
                          <span className="text-sm font-medium text-gray-900">{log.action.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            {log.actor_name || 'Unknown user'}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        {log.target_type && (
                          <p className="text-xs text-gray-500 ml-6">
                            Target: {log.target_type}
                          </p>
                        )}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <p className="text-xs text-gray-400 ml-6">
                            Details: {JSON.stringify(log.details)}
                          </p>
                        )}
                        {log.ip_address && (
                          <p className="text-xs text-gray-400 ml-6">IP: {log.ip_address}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Summary Stats */}
          {recentActivity.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Activity Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-900">
                    {recentActivity.length}
                  </div>
                  <div className="text-xs text-gray-500">Total Actions</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-900">
                    {recentActivity.filter(l => l.action === 'UPDATE_SETTINGS').length}
                  </div>
                  <div className="text-xs text-gray-500">Settings Changes</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-900">
                    {recentActivity.filter(l => l.action === 'PASSWORD_CHANGE').length}
                  </div>
                  <div className="text-xs text-gray-500">Password Changes</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-900">
                    {recentActivity.filter(l => l.action.includes('IP')).length}
                  </div>
                  <div className="text-xs text-gray-500">IP Changes</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
