'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Star, 
  X,
  Wallet,
  Smartphone,
  Building,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface PaymentMethod {
  id: string
  user_id: string
  type: 'credit_card' | 'debit_card' | 'gcash' | 'paypal' | 'bank_transfer'
  last_four?: string
  card_brand?: string
  expiry_month?: string
  expiry_year?: string
  cardholder_name?: string
  email?: string
  account_name?: string
  account_number?: string
  is_default: boolean
  created_at?: string
}

export default function PaymentMethodsPage() {
  const router = useRouter()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [formData, setFormData] = useState({
    type: 'credit_card',
    cardholder_name: '',
    card_number: '',
    expiry_month: '',
    expiry_year: '',
    cvv: '',
    email: '',
    account_name: '',
    account_number: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchPaymentMethods()
  }, [])

  const fetchPaymentMethods = async () => {
    setLoading(true)
    setError('')
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) throw userError
      if (!user) {
        router.push('/login')
        return
      }

      // Check if payment_methods table exists
      const { error: tableCheck } = await supabase
        .from('payment_methods')
        .select('id')
        .limit(1)

      if (tableCheck) {
        console.log('Payment methods table may not exist yet')
        setPaymentMethods([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      setPaymentMethods(data || [])
    } catch (err: any) {
      console.error('Error fetching payment methods:', err)
      // Don't show error for missing table, just show empty state
      if (!err.message?.includes('does not exist')) {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const validateCardNumber = (number: string) => {
    const cleaned = number.replace(/\s/g, '')
    return /^\d{16}$/.test(cleaned)
  }

  const validateExpiry = (month: string, year: string) => {
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth() + 1
    
    const expYear = parseInt(year)
    const expMonth = parseInt(month)
    
    if (expYear < currentYear) return false
    if (expYear === currentYear && expMonth < currentMonth) return false
    return true
  }

  const getCardBrand = (cardNumber: string) => {
    const cleaned = cardNumber.replace(/\s/g, '')
    if (cleaned.startsWith('4')) return 'visa'
    if (cleaned.startsWith('5')) return 'mastercard'
    if (cleaned.startsWith('3')) return 'amex'
    if (cleaned.startsWith('6')) return 'discover'
    return 'card'
  }

  const handleAddPaymentMethod = async () => {
    const newErrors: Record<string, string> = {}
    
    if (formData.type === 'credit_card' || formData.type === 'debit_card') {
      if (!formData.cardholder_name) newErrors.cardholder_name = 'Cardholder name is required'
      if (!formData.card_number) newErrors.card_number = 'Card number is required'
      else if (!validateCardNumber(formData.card_number)) newErrors.card_number = 'Invalid card number'
      if (!formData.expiry_month) newErrors.expiry_month = 'Expiry month is required'
      if (!formData.expiry_year) newErrors.expiry_year = 'Expiry year is required'
      else if (!validateExpiry(formData.expiry_month, formData.expiry_year)) 
        newErrors.expiry_year = 'Card has expired'
      if (!formData.cvv) newErrors.cvv = 'CVV is required'
    } else if (formData.type === 'gcash' || formData.type === 'paypal') {
      if (!formData.email) newErrors.email = 'Email is required'
      else if (!/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = 'Invalid email format'
      if (!formData.account_name) newErrors.account_name = 'Account name is required'
    } else if (formData.type === 'bank_transfer') {
      if (!formData.account_name) newErrors.account_name = 'Account name is required'
      if (!formData.account_number) newErrors.account_number = 'Account number is required'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('Not authenticated')

      // If this is the first payment method, make it default
      const isFirst = paymentMethods.length === 0

      const newMethod: any = {
        user_id: user.id,
        type: formData.type,
        is_default: isFirst
      }
      
      if (formData.type === 'credit_card' || formData.type === 'debit_card') {
        const cardBrand = getCardBrand(formData.card_number)
        newMethod.card_brand = cardBrand
        newMethod.last_four = formData.card_number.slice(-4)
        newMethod.expiry_month = formData.expiry_month
        newMethod.expiry_year = formData.expiry_year
        newMethod.cardholder_name = formData.cardholder_name
      } else if (formData.type === 'gcash' || formData.type === 'paypal') {
        newMethod.email = formData.email
        newMethod.account_name = formData.account_name
      } else if (formData.type === 'bank_transfer') {
        newMethod.account_name = formData.account_name
        newMethod.account_number = formData.account_number
      }
      
      const { error } = await supabase
        .from('payment_methods')
        .insert([newMethod])

      if (error) throw error

      setSuccess('Payment method added successfully!')
      resetForm()
      await fetchPaymentMethods()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Error adding payment method:', err)
      setError(err.message)
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Update all to not default
      const { error: updateAllError } = await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('user_id', user.id)

      if (updateAllError) throw updateAllError

      // Set selected as default
      const { error } = await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', id)

      if (error) throw error

      setSuccess('Default payment method updated!')
      await fetchPaymentMethods()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Error setting default:', err)
      setError(err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return

    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id)

      if (error) throw error

      setSuccess('Payment method deleted successfully!')
      await fetchPaymentMethods()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Error deleting payment method:', err)
      setError(err.message)
    }
  }

  const resetForm = () => {
    setShowAddModal(false)
    setEditingMethod(null)
    setFormData({
      type: 'credit_card',
      cardholder_name: '',
      card_number: '',
      expiry_month: '',
      expiry_year: '',
      cvv: '',
      email: '',
      account_name: '',
      account_number: ''
    })
    setErrors({})
  }

  const getPaymentIcon = (type: string, cardBrand?: string) => {
    if (type === 'credit_card' || type === 'debit_card') {
      if (cardBrand === 'visa') return <CreditCard className="h-6 w-6 text-blue-600" />
      if (cardBrand === 'mastercard') return <CreditCard className="h-6 w-6 text-red-600" />
      return <CreditCard className="h-6 w-6 text-gray-600" />
    }
    if (type === 'gcash') return <Smartphone className="h-6 w-6 text-blue-500" />
    if (type === 'paypal') return <Wallet className="h-6 w-6 text-blue-500" />
    if (type === 'bank_transfer') return <Building className="h-6 w-6 text-green-600" />
    return <CreditCard className="h-6 w-6" />
  }

  const getPaymentDisplayText = (method: PaymentMethod) => {
    switch (method.type) {
      case 'credit_card':
      case 'debit_card':
        return `${method.card_brand?.toUpperCase()} •••• ${method.last_four} (Exp: ${method.expiry_month}/${method.expiry_year})`
      case 'gcash':
        return `GCash • ${method.email}`
      case 'paypal':
        return `PayPal • ${method.email}`
      case 'bank_transfer':
        return `Bank Transfer • ${method.account_name}`
      default:
        return ''
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payment Methods</h1>
            <p className="text-gray-600 mt-2">Manage your payment options for faster checkout</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Payment Method
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            {success}
          </div>
        )}
        
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {/* Payment Methods List */}
        {paymentMethods.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <CreditCard className="mx-auto h-16 w-16 text-gray-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No payment methods</h3>
            <p className="mt-2 text-gray-600">Add your first payment method to checkout faster</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-6 inline-flex items-center gap-2 px-6 py-2 bg-black text-white rounded-xl font-semibold hover:bg-gray-800"
            >
              <Plus className="h-5 w-5" />
              Add Payment Method
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-2xl border p-6 transition-all ${
                  method.is_default
                    ? 'border-black shadow-md'
                    : 'border-gray-200 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {getPaymentIcon(method.type, method.card_brand)}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-gray-900 capitalize">
                          {method.type.replace('_', ' ')}
                        </h3>
                        {method.is_default && (
                          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                            <Star className="h-3 w-3 fill-current" />
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {getPaymentDisplayText(method)}
                      </p>
                      {method.cardholder_name && (
                        <p className="text-xs text-gray-500 mt-1">
                          {method.cardholder_name}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {!method.is_default && (
                      <button
                        onClick={() => handleSetDefault(method.id)}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-black transition-colors"
                      >
                        Set as Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(method.id)}
                      className="p-2 text-red-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Payment Method Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">Add Payment Method</h2>
                <button
                  onClick={resetForm}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4">
                {/* Payment Type Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="gcash">GCash</option>
                    <option value="paypal">PayPal</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                {/* Credit/Debit Card Fields */}
                {(formData.type === 'credit_card' || formData.type === 'debit_card') && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        value={formData.cardholder_name}
                        onChange={(e) => setFormData({ ...formData, cardholder_name: e.target.value })}
                        placeholder="John Doe"
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${
                          errors.cardholder_name ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.cardholder_name && (
                        <p className="text-xs text-red-500 mt-1">{errors.cardholder_name}</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Card Number
                      </label>
                      <input
                        type="text"
                        value={formData.card_number}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 16)
                          setFormData({ ...formData, card_number: value })
                        }}
                        placeholder="1234 5678 9012 3456"
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${
                          errors.card_number ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.card_number && (
                        <p className="text-xs text-red-500 mt-1">{errors.card_number}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Expiry Month
                        </label>
                        <select
                          value={formData.expiry_month}
                          onChange={(e) => setFormData({ ...formData, expiry_month: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                        >
                          <option value="">Month</option>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                            <option key={month} value={month.toString().padStart(2, '0')}>
                              {month.toString().padStart(2, '0')}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Expiry Year
                        </label>
                        <select
                          value={formData.expiry_year}
                          onChange={(e) => setFormData({ ...formData, expiry_year: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                        >
                          <option value="">Year</option>
                          {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CVV
                      </label>
                      <input
                        type="password"
                        value={formData.cvv}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                          setFormData({ ...formData, cvv: value })
                        }}
                        placeholder="123"
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${
                          errors.cvv ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.cvv && (
                        <p className="text-xs text-red-500 mt-1">{errors.cvv}</p>
                      )}
                    </div>
                  </>
                )}

                {/* GCash/PayPal Fields */}
                {(formData.type === 'gcash' || formData.type === 'paypal') && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Account Name
                      </label>
                      <input
                        type="text"
                        value={formData.account_name}
                        onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                        placeholder="John Doe"
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${
                          errors.account_name ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.account_name && (
                        <p className="text-xs text-red-500 mt-1">{errors.account_name}</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {formData.type === 'gcash' ? 'GCash Number/Email' : 'PayPal Email'}
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder={formData.type === 'gcash' ? '09123456789 or email@example.com' : 'email@example.com'}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${
                          errors.email ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.email && (
                        <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                      )}
                    </div>
                  </>
                )}

                {/* Bank Transfer Fields */}
                {formData.type === 'bank_transfer' && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Account Name
                      </label>
                      <input
                        type="text"
                        value={formData.account_name}
                        onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                        placeholder="John Doe"
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${
                          errors.account_name ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.account_name && (
                        <p className="text-xs text-red-500 mt-1">{errors.account_name}</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Account Number
                      </label>
                      <input
                        type="text"
                        value={formData.account_number}
                        onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                        placeholder="1234567890"
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${
                          errors.account_number ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.account_number && (
                        <p className="text-xs text-red-500 mt-1">{errors.account_number}</p>
                      )}
                    </div>
                  </>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddPaymentMethod}
                    className="flex-1 px-4 py-2 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                  >
                    Add Payment Method
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}