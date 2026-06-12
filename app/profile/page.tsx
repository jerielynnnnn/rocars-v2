'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  User, Home, Lock, Heart, ShoppingBag, 
  Settings, LogOut, ChevronRight, Camera, Loader2,
  CheckCircle, AlertCircle
} from 'lucide-react'
import Image from 'next/image'

interface ProfileData {
  id: string
  username: string
  first_name: string
  last_name: string
  middle_name: string
  email: string
  phone_number: string
  avatar_url: string | null
  created_at: string
  role: string
}

function ProfileContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'profile'
  
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) throw userError
      
      if (!user) {
        router.push('/login')
        return
      }

      // Try to get existing profile
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      // If profile doesn't exist, create one
      if (!data) {
        console.log('Profile not found, creating new profile...')
        
        const newProfile = {
          id: user.id,
          username: user.email?.split('@')[0] || `user_${Date.now()}`,
          first_name: '',
          last_name: '',
          middle_name: '',
          email: user.email,
          phone_number: '',
          avatar_url: null,
          role: 'customer',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const { data: createdProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([newProfile])
          .select()
          .maybeSingle()

        if (insertError) {
          console.error('Error creating profile:', insertError)
          throw insertError
        }

        data = createdProfile
        setMessage('Profile created successfully!')
        setMessageType('success')
        setTimeout(() => setMessage(''), 3000)
      } else if (error && error.code !== 'PGRST116') {
        throw error
      }

      // Set profile data
      setProfile({
        id: user.id,
        username: data?.username || user.email?.split('@')[0] || '',
        first_name: data?.first_name || '',
        last_name: data?.last_name || '',
        middle_name: data?.middle_name || '',
        email: user.email || '',
        phone_number: data?.phone_number || '',
        avatar_url: data?.avatar_url || null,
        created_at: data?.created_at || user.created_at || new Date().toISOString(),
        role: data?.role || 'customer',
      })
    } catch (error: any) {
      console.error('Error fetching profile:', error)
      setMessage(error.message || 'Failed to load profile. Please refresh the page.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profile) return
    
    setSaving(true)
    setMessage('')
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          middle_name: profile.middle_name,
          phone_number: profile.phone_number,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)

      if (error) throw error
      
      setMessage('Profile updated successfully!')
      setMessageType('success')
      setIsEditing(false)
      setTimeout(() => setMessage(''), 3000)
    } catch (error: any) {
      console.error('Error saving profile:', error)
      setMessage(error.message || 'Failed to update profile')
      setMessageType('error')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setMessage('Please upload a valid image file (JPEG, PNG, GIF, or WEBP)')
      setMessageType('error')
      return
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage('Image must be less than 2MB')
      setMessageType('error')
      return
    }

    setUploading(true)
    setMessage('')
    
    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile?.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile?.id)

      if (updateError) throw updateError

      // Update local state
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null)
      setMessage('Profile picture updated successfully!')
      setMessageType('success')
      setTimeout(() => setMessage(''), 3000)
    } catch (error: any) {
      console.error('Error uploading avatar:', error)
      setMessage(error.message || 'Failed to upload image. Please try again.')
      setMessageType('error')
    } finally {
      setUploading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
      setMessage('Failed to sign out. Please try again.')
      setMessageType('error')
    }
  }

  const tabs = [
    { id: 'profile', name: 'Profile Information', icon: User, href: '/profile?tab=profile' },
    { id: 'addresses', name: 'Addresses', icon: Home, href: '/profile/addresses' },
    { id: 'security', name: 'Security', icon: Lock, href: '/profile/security' },
    { id: 'wishlist', name: 'Wishlist', icon: Heart, href: '/profile/wishlist' },
    { id: 'orders', name: 'Orders', icon: ShoppingBag, href: '/orders' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load profile. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Account</h1>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            messageType === 'success' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            {messageType === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="flex-1">{message}</span>
            <button onClick={() => setMessage('')} className="ml-auto">
              <span className="text-lg">&times;</span>
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 sticky top-24">
              {/* Profile Summary */}
              <div className="p-6 text-center border-b border-gray-200">
                <div className="relative inline-block">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 mx-auto">
                    {profile.avatar_url ? (
                      <img 
                        src={profile.avatar_url} 
                        alt={profile.username} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Handle image load error
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement?.classList.add('bg-gradient-to-r', 'from-gray-400', 'to-gray-600');
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-r from-gray-400 to-gray-600 flex items-center justify-center">
                        <User className="w-10 h-10 text-white" />
                      </div>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-1.5 bg-black rounded-full cursor-pointer hover:bg-gray-800 transition-colors">
                    <Camera className="w-3 h-3 text-white" />
                    <input 
                      type="file" 
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" 
                      onChange={handleAvatarUpload} 
                      className="hidden" 
                      disabled={uploading} 
                    />
                  </label>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 mt-3">
                  {profile.first_name || profile.username} {profile.last_name}
                </h3>
                <p className="text-sm text-gray-500">@{profile.username}</p>
                <p className="text-xs text-gray-400 mt-1 capitalize">{profile.role}</p>
              </div>

              {/* Navigation */}
              <div className="p-4 space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === 'orders') {
                        router.push('/orders')
                      } else if (tab.href) {
                        router.push(tab.href)
                      }
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors ${
                      activeTab === tab.id || (tab.id === 'orders' && activeTab === 'orders')
                        ? 'bg-gray-100 text-black'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <tab.icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{tab.name}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
                
                {/* Sign Out Button */}
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors text-red-600 hover:bg-red-50 mt-4 pt-4 border-t border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium">Sign Out</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Main Content - Profile Form */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-sm font-medium text-black border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsEditing(false)
                        fetchProfile() // Reset to original data
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </span>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={profile.username}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">Username cannot be changed</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={profile.first_name}
                      onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                      disabled={!isEditing}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black transition-colors ${
                        !isEditing ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                      }`}
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                    <input
                      type="text"
                      value={profile.middle_name}
                      onChange={(e) => setProfile({ ...profile, middle_name: e.target.value })}
                      disabled={!isEditing}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black transition-colors ${
                        !isEditing ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                      }`}
                      placeholder="Enter your middle name (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={profile.last_name}
                      onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                      disabled={!isEditing}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black transition-colors ${
                        !isEditing ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                      }`}
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">Email cannot be changed. Contact support if you need to update your email.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={profile.phone_number}
                    onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                    disabled={!isEditing}
                    placeholder="+63 XXX XXX XXXX"
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black transition-colors ${
                      !isEditing ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                    }`}
                  />
                  <p className="text-xs text-gray-400 mt-1">Include country code (e.g., +63 for Philippines)</p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Member since</span>
                    <span className="text-gray-900">
                      {new Date(profile.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-600">Loading profile...</div>}>
      <ProfileContent />
    </Suspense>
  )
}
