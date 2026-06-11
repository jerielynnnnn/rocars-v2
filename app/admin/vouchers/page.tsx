'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PageContainer from '@/components/layout/PageContainer'
import PageSection from '@/components/layout/PageSection'
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
  Gift,
  Sparkles,
  ArrowLeft,
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
  const [filterType, setFilterType] = useState<'all' | 'active' | 'expired'>('all')
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
      const voucherData = {
        code: formData.code.toUpperCase(),
        type: formData.type,
        value: formData.value,
        min_spend: formData.min_spend,
        max_discount: formData.max_discount ? parseInt(formData.max_discount) : null,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        valid_from: new Date(formData.valid_from).toISOString(),
        valid_until: new Date(formData.valid_until).toISOString(),
        description: formData.description || null,
        is_active: formData.is_active,
      }

      if (editingVoucher) {
        const { error } = await supabase
          .from('vouchers')
          .update(voucherData)
          .eq('id', editingVoucher.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('vouchers')
          .insert([voucherData])

        if (error) throw error
      }

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

  const getVoucherIcon = (type: string) => {
    switch (type) {
      case 'percentage':
        return <Percent className="h-5 w-5" />
      case 'free_shipping':
        return <Truck className="h-5 w-5" />
      default:
        return <Tag className="h-5 w-5" />
    }
  }

  const getVoucherBadge = (type: string, value: number) => {
    switch (type) {
      case 'percentage':
        return `${value}% OFF`
      case 'fixed':
        return `₱${value.toLocaleString()} OFF`
      case 'free_shipping':
        return 'FREE SHIPPING'
      default:
        return 'DISCOUNT'
    }
  }

  const getStatusColor = (voucher: Voucher) => {
    const now = new Date()
    const validUntil = new Date(voucher.valid_until)
    const isValid = now <= validUntil && voucher.is_active
    
    if (!voucher.is_active) return 'bg-gray-100 text-gray-600'
    if (!isValid) return 'bg-red-100 text-red-600'
    return 'bg-green-100 text-green-600'
  }

  const getStatusText = (voucher: Voucher) => {
    const now = new Date()
    const validUntil = new Date(voucher.valid_until)
    const isValid = now <= validUntil && voucher.is_active
    
    if (!voucher.is_active) return 'Disabled'
    if (!isValid) return 'Expired'
    return 'Active'
  }

  const isVoucherValid = (voucher: Voucher) => {
    const now = new Date()
    const validFrom = new Date(voucher.valid_from)
    const validUntil = new Date(voucher.valid_until)
    return now >= validFrom && now <= validUntil && voucher.is_active
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)

  const filteredVouchers = vouchers.filter(voucher => {
    const matchesSearch = voucher.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voucher.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (!matchesSearch) return false

    if (filterType === 'active') {
      return isVoucherValid(voucher)
    }
    if (filterType === 'expired') {
      return !isVoucherValid(voucher)
    }
    
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
        <Loader2 className="h-12 w-12 animate-spin text-yellow-500" />
      </div>
    )
  }

  return (
    <PageSection>
      <PageContainer size="xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-2xl bg-yellow-100">
                  <Gift className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Vouchers</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Create and manage discount vouchers for customers
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-2xl font-medium hover:bg-gray-800 transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Create Voucher
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Vouchers</p>
                <p className="text-3xl font-bold text-gray-900">{vouchers.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Gift className="h-6 w-6 text-gray-500" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-3xl font-bold text-green-600">
                  {vouchers.filter(v => isVoucherValid(v)).length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Expired/Disabled</p>
                <p className="text-3xl font-bold text-red-600">
                  {vouchers.filter(v => !isVoucherValid(v)).length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Uses</p>
                <p className="text-3xl font-bold text-gray-900">
                  {vouchers.reduce((sum, v) => sum + (v.used_count || 0), 0)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by voucher code or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                filterType === 'all'
                  ? 'bg-black text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('active')}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                filterType === 'active'
                  ? 'bg-green-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterType('expired')}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                filterType === 'expired'
                  ? 'bg-red-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Expired/Disabled
            </button>
          </div>
        </div>

        {/* Vouchers Grid - Matching User End Style */}
        {filteredVouchers.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Gift className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Vouchers Found</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {searchTerm ? 'No vouchers match your search criteria.' : 'Create your first voucher to start offering discounts to customers!'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => {
                  resetForm()
                  setShowModal(true)
                }}
                className="mt-6 px-6 py-3 bg-yellow-400 text-black rounded-xl font-medium hover:bg-yellow-500 transition"
              >
                Create Voucher
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVouchers.map((voucher) => {
              const isValid = isVoucherValid(voucher)
              const statusColor = getStatusColor(voucher)
              const statusText = getStatusText(voucher)
              
              return (
                <div
                  key={voucher.id}
                  className={`relative overflow-hidden rounded-2xl border transition-all ${
                    isValid
                      ? 'bg-gradient-to-r from-yellow-50 to-white border-yellow-200 hover:shadow-md'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {/* Decorative Sparkles */}
                  <div className="absolute top-0 right-0">
                    <Sparkles className={`h-20 w-20 opacity-30 -rotate-12 ${
                      isValid ? 'text-yellow-300' : 'text-gray-400'
                    }`} />
                  </div>

                  <div className="p-5">
                    {/* Status Badge */}
                    <div className="flex justify-end mb-2">
                      <button
                        onClick={() => handleToggleStatus(voucher)}
                        className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}
                      >
                        {statusText}
                      </button>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-xl ${isValid ? 'bg-yellow-100' : 'bg-gray-200'}`}>
                        {getVoucherIcon(voucher.type)}
                      </div>
                      <div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isValid ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {getVoucherBadge(voucher.type, voucher.value)}
                        </span>
                        <p className="text-xs text-gray-400 mt-1 font-mono">
                          Code: {voucher.code}
                        </p>
                      </div>
                    </div>

                    <h3 className="font-bold text-black text-lg">
                      {voucher.type === 'percentage' && `${voucher.value}% OFF`}
                      {voucher.type === 'fixed' && `${formatPrice(voucher.value)} OFF`}
                      {voucher.type === 'free_shipping' && 'Free Shipping'}
                    </h3>

                    {voucher.description && (
                      <p className="text-sm text-gray-500 mt-1">{voucher.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-400">
                      {voucher.min_spend > 0 && (
                        <span>Min. Spend {formatPrice(voucher.min_spend)}</span>
                      )}
                      {voucher.max_discount && voucher.type === 'percentage' && (
                        <span>Max {formatPrice(voucher.max_discount)}</span>
                      )}
                      {voucher.usage_limit && (
                        <span>Limit: {voucher.used_count}/{voucher.usage_limit}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>
                          {!isValid ? 'Expired: ' : 'Valid until: '}
                          {new Date(voucher.valid_until).toLocaleDateString('en-PH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => editVoucher(voucher)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-sm font-medium"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(voucher.id)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition text-sm font-medium"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </PageContainer>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-yellow-100">
                  <Gift className="h-5 w-5 text-yellow-600" />
                </div>
                <h2 className="text-xl font-bold">
                  {editingVoucher ? 'Edit Voucher' : 'Create New Voucher'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
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
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voucher Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Active (immediately available for customers)
                </label>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="px-5 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800 transition font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingVoucher ? 'Update' : 'Create'} Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageSection>
  )
}