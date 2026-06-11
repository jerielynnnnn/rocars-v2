'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { removeStaff } from '@/app/actions/removeStaff'
import { getRoleLabel, getRoleModules, type StaffRole } from '@/lib/admin-role'
import { 
  UserPlus, 
  X, 
  Mail, 
  Lock, 
  User, 
  Briefcase,
  Trash2,
  Shield,
  UserCheck,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface StaffMember {
  id: string
  email: string
  first_name: string
  last_name: string
  username: string
  role: StaffRole
  avatar_url: string | null
  created_at: string
  last_sign_in_at: string | null
}

interface StaffFormData {
  email: string
  password: string
  confirmPassword: string
  firstName: string
  lastName: string
  username: string
  role: StaffRole
}

export default function StaffManagement() {
  const router = useRouter()
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [formData, setFormData] = useState<StaffFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    username: '',
    role: 'staff'
  })

  // Fetch staff members
  // Replace the existing fetchStaffMembers function with this:

const fetchStaffMembers = async () => {
  setLoading(true)
  setError(null)
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Session error:', sessionError)
      throw new Error('Failed to get session')
    }
    
    if (!session) {
      console.log('No active session, redirecting to login...')
      router.push('/login')
      return
    }

    const response = await fetch('/api/admin/staff', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to load staff members')
    }
    
    setStaffMembers(result.staff || [])
  } catch (err) {
    console.error('Error fetching staff:', err)
    setError('Failed to load staff members: ' + (err as Error).message)
  } finally {
    setLoading(false)
  }
}
  useEffect(() => {
    fetchStaffMembers()
  }, [])

  // Filter staff members
  const filteredStaff = staffMembers.filter(staff => {
    const matchesSearch = 
      (staff.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (staff.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (staff.last_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (staff.username || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === 'all' || staff.role === roleFilter
    
    return matchesSearch && matchesRole
  })

  const handleAddStaff = async (e: React.FormEvent) => {
  e.preventDefault()
  setError(null)
  setSuccess(null)
  
  // Validation - all fields required
  if (!formData.email) {
    setError('Email is required')
    return
  }
  
  if (!formData.firstName) {
    setError('First name is required')
    return
  }
  
  if (!formData.lastName) {
    setError('Last name is required')
    return
  }
  
  if (!formData.username) {
    setError('Username is required')
    return
  }
  
  if (formData.password !== formData.confirmPassword) {
    setError('Passwords do not match')
    return
  }
  
  if (formData.password.length < 6) {
    setError('Password must be at least 6 characters')
    return
  }
  
  setCreating(true)
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('Admin session is required')
    }

    const response = await fetch('/api/admin/create-staff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: formData.username,
        role: formData.role,
      }),
    })

    const result = await response.json()
    
    // Log the full response for debugging
    console.log('API Response:', { status: response.status, result })

    if (!response.ok || result.error) {
      // Show the actual error message from the API
      const errorMessage = result.error || result.details || 'Failed to create staff member'
      console.error('API Error:', errorMessage, result)
      throw new Error(errorMessage)
    }
    
    // Reset form and close modal
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      username: '',
      role: 'staff'
    })
    setShowPassword(false)
    setShowConfirmPassword(false)
    setShowModal(false)
    
    // Refresh staff list
    await fetchStaffMembers()
    
    setSuccess('Staff member created successfully!')
    setTimeout(() => setSuccess(null), 3000)
    
  } catch (err) {
    console.error('Error creating staff:', err)
    setError(err instanceof Error ? err.message : 'An error occurred')
  } finally {
    setCreating(false)
  }
}
  const handleRemoveStaff = async () => {
    if (!selectedStaff) return
    
    setDeleting(true)
    setError(null)
    
    try {
      const result = await removeStaff(selectedStaff.id)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      setShowDeleteModal(false)
      setSelectedStaff(null)
      
      // Refresh staff list
      await fetchStaffMembers()
      
      setSuccess('Staff access removed successfully!')
      setTimeout(() => setSuccess(null), 3000)
      
    } catch (err) {
      console.error('Error removing staff:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setDeleting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const getRoleBadge = (role: string) => {
    const isAdmin = role === 'admin'

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
        isAdmin
          ? 'bg-purple-100 text-purple-800'
          : 'bg-blue-100 text-blue-800'
      }`}>
        {isAdmin ? <Shield className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
        {getRoleLabel(role)}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage staff members and their permissions
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition font-medium"
        >
          <UserPlus className="w-4 h-4" />
          Add Staff
        </button>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search staff by name, email, or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
              roleFilter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setRoleFilter('admin')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
              roleFilter === 'admin'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Admins
          </button>
          <button
            onClick={() => setRoleFilter('staff')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
              roleFilter === 'staff'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Staff
          </button>
          <button
            onClick={() => {
              setSearchTerm('')
              setRoleFilter('all')
              fetchStaffMembers()
            }}
            className="px-3 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition"
            title="Reset filters"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Staff List */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent mx-auto mb-3"></div>
          <p className="text-gray-500">Loading staff members...</p>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">
            {searchTerm || roleFilter !== 'all' 
              ? 'No staff members match your filters'
              : 'No staff members yet'}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            {!searchTerm && roleFilter === 'all' && 'Click "Add Staff" to create your first staff member'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Staff</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Joined</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-xs font-bold text-gray-600">
                            {(staff.first_name?.[0] || staff.username?.[0] || staff.email?.[0] || 'S').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-gray-900 font-medium text-sm">
                            {staff.first_name && staff.last_name 
                              ? `${staff.first_name} ${staff.last_name}`
                              : staff.username || staff.email?.split('@')[0] || 'No name'}
                          </p>
                          <p className="text-xs text-gray-400">
                            @{staff.username || 'no-username'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">{staff.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {getRoleBadge(staff.role)}
                        <span className="text-xs text-gray-400">{getRoleModules(staff.role).join(' • ') || 'Admin scope'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-500">{formatDate(staff.created_at)}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {staff.role !== 'admin' && (
                        <button
                          onClick={() => {
                            setSelectedStaff(staff)
                            setShowDeleteModal(true)
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 transition"
                          title="Remove staff access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              Showing {filteredStaff.length} of {staffMembers.length} staff members
            </p>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Add Staff Member</h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setError(null)
                  setFormData({
                    email: '',
                    password: '',
                    confirmPassword: '',
                    firstName: '',
                    lastName: '',
                    username: '',
                    role: 'staff'
                  })
                  setShowPassword(false)
                  setShowConfirmPassword(false)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    placeholder="staff@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    placeholder="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Choose Staff Manager for full staff access, or a module-specific role for Orders / Payments / Shipping.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    placeholder="•••••• (min. 6 characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    placeholder="••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Staff Member'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Remove Staff Access</h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedStaff(null)
                  setError(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700">
                Are you sure you want to remove <span className="font-semibold text-gray-900">
                  {selectedStaff.first_name || selectedStaff.username || selectedStaff.email?.split('@')[0]}
                </span>'s staff access?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This will change their role to customer. They will no longer have access to the admin panel.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedStaff(null)
                  setError(null)
                }}
                className="flex-1 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveStaff}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? 'Removing...' : 'Remove Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
