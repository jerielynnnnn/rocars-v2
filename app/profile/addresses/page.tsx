// app/profile/addresses/page.tsx - Updated with consistent layout
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { locationData } from '@/lib/locations'

import {
  Home,
  Plus,
  Edit2,
  Trash2,
  Star,
  MapPin,
  Phone,
  Loader2,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react'

interface Address {
  id: number
  recipient_first_name: string
  recipient_last_name: string
  phone_number: string
  province: string
  city: string
  barangay: string
  street_address: string
  zip_code: string
  is_default: boolean
}

export default function AddressesPage() {
  const router = useRouter()

  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const [location, setLocation] = useState({
    region: '',
    province: '',
    city: '',
    barangay: '',
  })

  const [formData, setFormData] = useState({
    recipient_first_name: '',
    recipient_last_name: '',
    phone_number: '',
    street_address: '',
    zip_code: '',
    is_default: false,
  })

  useEffect(() => {
    fetchAddresses()
  }, [])

  const fetchAddresses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })

      if (error) throw error
      setAddresses(data || [])
    } catch (err: any) {
      console.error('Error fetching addresses:', err)
      setMessage('Failed to load addresses')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const addressToDelete = addresses.find(a => a.id === id)
      if (addressToDelete?.is_default && addresses.length > 1) {
        const newDefault = addresses.find(a => a.id !== id)
        if (newDefault) {
          await supabase
            .from('addresses')
            .update({ is_default: true })
            .eq('id', newDefault.id)
        }
      }

      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        if (error.code === '23503') {
          setMessage('Cannot delete address because it is used in existing orders.')
          setMessageType('error')
        } else {
          setMessage(error.message)
          setMessageType('error')
        }
        return
      }

      setMessage('Address deleted successfully!')
      setMessageType('success')
      await fetchAddresses()
      setDeleteConfirmId(null)

      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      console.error('Delete error:', err)
      setMessage(err.message || 'Failed to delete address')
      setMessageType('error')
    }
  }

  const handleSetDefault = async (id: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id)

      await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', id)

      setMessage('Default address updated!')
      setMessageType('success')
      fetchAddresses()

      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setMessage(err.message || 'Failed to set default address')
      setMessageType('error')
    }
  }

  const handleEdit = (address: Address) => {
    setEditingAddress(address)
    setFormData({
      recipient_first_name: address.recipient_first_name,
      recipient_last_name: address.recipient_last_name,
      phone_number: address.phone_number,
      street_address: address.street_address,
      zip_code: address.zip_code || '',
      is_default: address.is_default,
    })
    setLocation({
      region: '',
      province: address.province,
      city: address.city,
      barangay: address.barangay,
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      recipient_first_name: '',
      recipient_last_name: '',
      phone_number: '',
      street_address: '',
      zip_code: '',
      is_default: false,
    })
    setLocation({
      region: '',
      province: '',
      city: '',
      barangay: '',
    })
    setEditingAddress(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (formData.is_default) {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', user.id)
      }

      const payload = {
        user_id: user.id,
        recipient_first_name: formData.recipient_first_name,
        recipient_last_name: formData.recipient_last_name,
        phone_number: formData.phone_number,
        street_address: formData.street_address,
        province: location.province,
        city: location.city,
        barangay: location.barangay,
        zip_code: formData.zip_code,
        is_default: formData.is_default,
      }

      if (editingAddress) {
        const { error } = await supabase
          .from('addresses')
          .update(payload)
          .eq('id', editingAddress.id)

        if (error) throw error
        setMessage('Address updated successfully!')
      } else {
        const { error } = await supabase.from('addresses').insert([payload])
        if (error) throw error
        setMessage('Address added successfully!')
      }

      setMessageType('success')
      resetForm()
      fetchAddresses()

      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setMessage(err.message || 'Failed to save address')
      setMessageType('error')
    } finally {
      setSubmitting(false)
    }
  }

  const regions = Object.keys(locationData)
  const provinces = location.region ? Object.keys(locationData[location.region] || {}) : []
  const cities = location.region && location.province
    ? Object.keys(locationData[location.region][location.province] || {})
    : []
  const barangays = location.region && location.province && location.city
    ? locationData[location.region][location.province][location.city]
    : []

  const updateLocation = (field: string, value: string) => {
    const updated = { ...location, [field]: value }
    if (field === 'region') {
      updated.province = ''
      updated.city = ''
      updated.barangay = ''
    }
    if (field === 'province') {
      updated.city = ''
      updated.barangay = ''
    }
    if (field === 'city') {
      updated.barangay = ''
    }
    setLocation(updated)
  }

  const formatFullAddress = (address: Address) => {
    return [address.street_address, address.barangay, address.city, address.province]
      .filter(Boolean)
      .join(', ')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Addresses</h1>
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Address</span>
              </button>
            )}
          </div>
        </div>

        {/* Message Toast */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            messageType === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {messageType === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <p className="flex-1 text-sm">{message}</p>
            <button onClick={() => setMessage('')} className="hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Address Form Modal - Same width as profile content area */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {editingAddress ? 'Edit Address' : 'Add New Address'}
                </h2>
                <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg transition">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      value={formData.recipient_first_name}
                      onChange={(e) => setFormData({ ...formData, recipient_first_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={formData.recipient_last_name}
                      onChange={(e) => setFormData({ ...formData, recipient_last_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    placeholder="+63 XXX XXX XXXX"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                  <input
                    type="text"
                    placeholder="House number, street name"
                    value={formData.street_address}
                    onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none"
                    required
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Region *</label>
                    <select
                      value={location.region}
                      onChange={(e) => updateLocation('region', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
                      required
                    >
                      <option value="">Select Region</option>
                      {regions.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
                    <select
                      value={location.province}
                      onChange={(e) => updateLocation('province', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
                      disabled={!location.region}
                      required
                    >
                      <option value="">Select Province</option>
                      {provinces.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City / Municipality *</label>
                    <select
                      value={location.city}
                      onChange={(e) => updateLocation('city', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
                      disabled={!location.province}
                      required
                    >
                      <option value="">Select City</option>
                      {cities.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barangay *</label>
                    <select
                      value={location.barangay}
                      onChange={(e) => updateLocation('barangay', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
                      disabled={!location.city}
                      required
                    >
                      <option value="">Select Barangay</option>
                      {barangays.map((b: string) => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                  <input
                    type="text"
                    placeholder="e.g., 4100"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_default"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4 text-black rounded focus:ring-black"
                  />
                  <label htmlFor="is_default" className="text-sm text-gray-700">
                    Set as default address
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-black text-white py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition"
                  >
                    {submitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </div>
                    ) : (
                      'Save Address'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Addresses List - Same width as profile content area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {addresses.length === 0 ? (
            <div className="text-center py-12">
              <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No addresses yet</h3>
              <p className="text-gray-500 mb-6">Add your first delivery address</p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
              >
                <Plus className="w-4 h-4" />
                Add Address
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {addresses.map((address) => (
                <div key={address.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {address.recipient_first_name} {address.recipient_last_name}
                        </h3>
                        {address.is_default && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                            <Star className="w-3 h-3" />
                            Default
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                          <span>{formatFullAddress(address)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                          <span>{address.phone_number}</span>
                        </div>
                        {address.zip_code && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">ZIP:</span>
                            <span>{address.zip_code}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      {!address.is_default && (
                        <button
                          onClick={() => handleSetDefault(address.id)}
                          className="p-2 text-gray-500 hover:text-black transition-colors"
                          title="Set as default"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(address)}
                        className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Edit address"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {deleteConfirmId === address.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete(address.id)}
                            className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(address.id)}
                          className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                          title="Delete address"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}