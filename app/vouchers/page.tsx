'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Tag, 
  Calendar, 
  DollarSign, 
  Percent,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Loader2,
  AlertCircle,
  Users,
  Gift
} from 'lucide-react'

type Voucher = {
  id: number
  code: string
  type: 'fixed' | 'percentage' | 'free_shipping'
  value: number
  min_spend: number
  max_discount: number | null
  usage_limit: number | null
  used_count: number
  valid_from: string
  valid_until: string
  is_active: boolean
  description: string | null
  created_at: string
}

export default function AdminVouchersPage() {
  const router = useRouter()
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    type: 'fixed' as 'fixed' | 'percentage' | 'free_shipping',
    value: 0,
    min_spend: 0,
    max_discount: '',
    usage_limit: '',
    valid_from: '',
    valid_until: '',
    description: '',
    is_active: true,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    checkAdminAndFetchVouchers()
  }, [])

  const checkAdminAndFetchVouchers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login?redirect=/admin/vouchers')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile?.role !== 'admin') {
        router.push('/')
        return
      }

      await fetchVouchers()
    } catch (error) {
      console.error('Error checking admin:', error)
      router.push('/')
    }
  }

  const fetchVouchers = async () => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setVouchers(data || [])
    } catch (error) {
      console.error('Error fetching vouchers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      // Validate required fields
      if (!formData.code) {
        throw new Error('Voucher code is required')
      }
      if (!formData.valid_from) {
        throw new Error('Valid from date is required')
      }
      if (!formData.valid_until) {
        throw new Error('Valid until date is required')
      }

      // Create date objects
      const validFrom = new Date(formData.valid_from)
      const validUntil = new Date(formData.valid_until)
      
      // Validate dates
      if (isNaN(validFrom.getTime())) {
        throw new Error('Invalid valid from date')
      }
      if (isNaN(validUntil.getTime())) {
        throw new Error('Invalid valid until date')
      }
      if (validUntil <= validFrom) {
        throw new Error('Valid until date must be after valid from date')
      }

      // Prepare data for insert/update
      const voucherData = {
        code: formData.code.toUpperCase().trim(),
        type: formData.type,
        value: Number(formData.value),
        min_spend: Number(formData.min_spend),
        max_discount: formData.max_discount ? Number(formData.max_discount) : null,
        usage_limit: formData.usage_limit ? Number(formData.usage_limit) : null,
        valid_from: validFrom.toISOString(),
        valid_until: validUntil.toISOString(),
        description: formData.description?.trim() || null,
        is_active: formData.is_active,
      }

      console.log('Saving voucher data:', voucherData)

      let result
      if (editingVoucher) {
        result = await supabase
          .from('vouchers')
          .update(voucherData)
          .eq('id', editingVoucher.id)
          .select()
      } else {
        result = await supabase
          .from('vouchers')
          .insert([voucherData])
          .select()
      }

      if (result.error) {
        console.error('Supabase error details:', result.error)
        throw new Error(result.error.message)
      }

      console.log('Save successful:', result.data)

      await fetchVouchers()
      resetForm()
      setShowModal(false)
    } catch (error: any) {
      console.error('Error saving voucher:', error)
      setError(error.message || 'Failed to save voucher')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this voucher?')) return

    try {
      const { error } = await supabase
        .from('vouchers')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchVouchers()
    } catch (error) {
      console.error('Error deleting voucher:', error)
      alert('Failed to delete voucher')
    }
  }

  const handleToggleStatus = async (voucher: Voucher) => {
    try {
      const { error } = await supabase
        .from('vouchers')
        .update({ is_active: !voucher.is_active })
        .eq('id', voucher.id)

      if (error) throw error
      await fetchVouchers()
    } catch (error) {
      console.error('Error toggling voucher status:', error)
      alert('Failed to update voucher status')
    }
  }

  const resetForm = () => {
    setFormData({
      code: '',
      type: 'fixed',
      value: 0,
      min_spend: 0,
      max_discount: '',
      usage_limit: '',
      valid_from: '',
      valid_until: '',
      description: '',
      is_active: true,
    })
    setEditingVoucher(null)
  }

  const editVoucher = (voucher: Voucher) => {
    setEditingVoucher(voucher)
    setFormData({
      code: voucher.code,
      type: voucher.type,
      value: voucher.value,
      min_spend: voucher.min_spend,
      max_discount: voucher.max_discount?.toString() || '',
      usage_limit: voucher.usage_limit?.toString() || '',
      valid_from: voucher.valid_from.split('T')[0],
      valid_until: voucher.valid_until.split('T')[0],
      description: voucher.description || '',
      is_active: voucher.is_active,
    })
    setShowModal(true)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'percentage':
        return <Percent className="h-4 w-4" />
      case 'free_shipping':
        return <Truck className="h-4 w-4" />
      default:
        return <DollarSign className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'percentage':
        return 'Percentage'
      case 'free_shipping':
        return 'Free Shipping'
      default:
        return 'Fixed Amount'
    }
  }

  const isVoucherValid = (voucher: Voucher) => {
    const now = new Date()
    const validFrom = new Date(voucher.valid_from)
    const validUntil = new Date(voucher.valid_until)
    return now >= validFrom && now <= validUntil && voucher.is_active
  }

  const filteredVouchers = vouchers.filter(voucher =>
    voucher.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    voucher.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vouchers</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage discount vouchers for customers
            </p>
          </div>
          <button
            onClick={() => {
              resetForm()
              setShowModal(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition"
          >
            <Plus className="h-4 w-4" />
            Create Voucher
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Vouchers</p>
                <p className="text-2xl font-bold text-gray-900">{vouchers.length}</p>
              </div>
              <Gift className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {vouchers.filter(v => v.is_active && isVoucherValid(v)).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Expired</p>
                <p className="text-2xl font-bold text-red-600">
                  {vouchers.filter(v => !isVoucherValid(v)).length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Uses</p>
                <p className="text-2xl font-bold text-gray-900">
                  {vouchers.reduce((sum, v) => sum + (v.used_count || 0), 0)}
                </p>
              </div>
              <Users className="h-8 w-8 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search vouchers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </div>

        {/* Vouchers Grid */}
        {filteredVouchers.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Tag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No vouchers found</h3>
            <p className="text-gray-500">Create your first voucher to start offering discounts.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredVouchers.map((voucher) => {
              const isValid = isVoucherValid(voucher)
              return (
                <div
                  key={voucher.id}
                  className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition ${
                    isValid ? 'border-gray-200' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-gray-100">
                          {getTypeIcon(voucher.type)}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{voucher.code}</h3>
                          <p className="text-xs text-gray-500">{getTypeLabel(voucher.type)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleStatus(voucher)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          voucher.is_active && isValid
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {voucher.is_active && isValid ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {voucher.type === 'fixed' && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Discount</span>
                        <span className="font-semibold text-gray-900">
                          ₱{voucher.value.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {voucher.type === 'percentage' && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Discount</span>
                        <span className="font-semibold text-gray-900">
                          {voucher.value}% OFF
                        </span>
                      </div>
                    )}
                    {voucher.type === 'free_shipping' && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Benefit</span>
                        <span className="font-semibold text-gray-900">
                          Free Shipping
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Min. Spend</span>
                      <span className="font-medium text-gray-700">
                        ₱{voucher.min_spend.toLocaleString()}
                      </span>
                    </div>

                    {voucher.max_discount && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Max Discount</span>
                        <span className="font-medium text-gray-700">
                          ₱{voucher.max_discount.toLocaleString()}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Usage</span>
                      <span className="font-medium text-gray-700">
                        {voucher.used_count} / {voucher.usage_limit || '∞'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(voucher.valid_from).toLocaleDateString()} - {new Date(voucher.valid_until).toLocaleDateString()}
                      </span>
                    </div>

                    {voucher.description && (
                      <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                        {voucher.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1">
                        {isValid && voucher.is_active ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span className="text-xs text-green-600">Valid</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 text-red-500" />
                            <span className="text-xs text-red-600">Expired</span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => editVoucher(voucher)}
                          className="p-1 text-gray-500 hover:text-gray-700 transition"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(voucher.id)}
                          className="p-1 text-gray-500 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">
                {editingVoucher ? 'Edit Voucher' : 'Create Voucher'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                X
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voucher Code *
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., SUMMER2024"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voucher Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="fixed">Fixed Amount (₱)</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="free_shipping">Free Shipping</option>
                </select>
              </div>

              {formData.type !== 'free_shipping' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.type === 'percentage' ? 'Discount Percentage *' : 'Discount Amount (₱) *'}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Spend (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.min_spend}
                  onChange={(e) => setFormData({ ...formData, min_spend: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {formData.type === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum Discount (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.max_discount}
                    onChange={(e) => setFormData({ ...formData, max_discount: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usage Limit
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.usage_limit}
                  onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                  placeholder="Leave empty for unlimited"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid From *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid Until *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describe the voucher..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-black focus:ring-black"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Active (immediately available for use)
                </label>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingVoucher ? 'Update' : 'Create'} Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
