// app/checkout/page.tsx
'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/context/CartContext'
import {
  ArrowLeft,
  MapPin,
  Truck,
  Smartphone,
  Shield,
  Clock,
  AlertCircle,
  Loader2,
  XCircle,
  Home,
  Edit2,
  CheckCircle2,
  Gift,
  Percent,
  Tag,
  Wallet,
} from 'lucide-react'

type CartItem = {
  id: number
  name: string
  price: number
  image: string
  quantity: number
  originalPrice?: number
  discount?: number
}

type Address = {
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

type PaymentMethodType = 'cod' | 'gcash'

type Voucher = {
  id: number
  code: string
  type: 'fixed' | 'percentage' | 'free_shipping'
  value: number
  min_spend: number
  max_discount: number | null
  description: string | null
  valid_from: string
  valid_until: string
  is_active: boolean
  used_count?: number
  usage_limit?: number | null
}

type UserVoucher = {
  id: number
  voucher_id: number
  voucher_code: string
  discount_amount: number
  free_shipping: boolean
  applied_at: string
  created_at: string
  order_id: number | null
  voucher: Voucher | null
}

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { cartItems, clearCart } = useCart()

  const [checkoutData, setCheckoutData] = useState<any>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethodType>('cod')
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showGcashModal, setShowGcashModal] = useState(false)
  const [gcashPaymentStatus, setGcashPaymentStatus] = useState<'idle' | 'processing' | 'redirecting'>('idle')
  const [gcashError, setGcashError] = useState('')
  const [paymentProcessed, setPaymentProcessed] = useState(false)
  
  // Voucher state
  const [showVoucherModal, setShowVoucherModal] = useState(false)
  const [voucherCode, setVoucherCode] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null)
  const [voucherDiscount, setVoucherDiscount] = useState(0)
  const [freeShipping, setFreeShipping] = useState(false)
  const [voucherError, setVoucherError] = useState('')
  const [voucherLoading, setVoucherLoading] = useState(false)
  const [userVouchers, setUserVouchers] = useState<UserVoucher[]>([])
  const [loadingVouchers, setLoadingVouchers] = useState(false)

  // Memoize clearCart
  const handleClearCart = useCallback(async () => {
    try {
      await clearCart()
      localStorage.removeItem('checkoutSummary')
      localStorage.removeItem('pendingGcashOrder')
    } catch (error) {
      console.error('Error clearing cart:', error)
    }
  }, [clearCart])

  // Get base values from checkout data
  const subtotal = Number(checkoutData?.subtotal || 0)
  const shippingFee = Number(checkoutData?.shippingFee || 0)
  const finalShippingFee = freeShipping ? 0 : shippingFee
  const total = subtotal - voucherDiscount + finalShippingFee

  // Fetch user's available vouchers - FIXED to accept userId parameter
  const fetchUserVouchers = async (targetUserId: string) => {
    if (!targetUserId) {
      console.log('No userId, skipping fetch')
      return
    }
    
    setLoadingVouchers(true)
    console.log('Fetching vouchers for user:', targetUserId)
    
    try {
      // Get all claimed vouchers from voucher_usage where order_id is null
      const { data: usageData, error: usageError } = await supabase
        .from('voucher_usage')
        .select('*, vouchers(*)')
        .eq('user_id', targetUserId)
        .is('order_id', null)

      if (usageError) {
        console.error('Error fetching user vouchers:', usageError)
        setUserVouchers([])
        setLoadingVouchers(false)
        return
      }

      if (!usageData || usageData.length === 0) {
        console.log('No claimed vouchers found')
        setUserVouchers([])
        setLoadingVouchers(false)
        return
      }

      console.log('Found claimed vouchers:', usageData.length)

      // Filter valid vouchers
      const now = new Date()
      const validVouchers: UserVoucher[] = []

      for (const item of usageData) {
        const voucher = item.vouchers as any
        
        if (!voucher) {
          console.log(`No voucher data for item:`, item)
          continue
        }

        // Check if voucher is active
        if (!voucher.is_active) {
          console.log(`Voucher ${voucher.code} is not active`)
          continue
        }

        // Check if voucher is valid (not expired and has started)
        const validFrom = new Date(voucher.valid_from)
        const validUntil = new Date(voucher.valid_until)
        
        if (validFrom > now) {
          console.log(`Voucher ${voucher.code} not yet available`)
          continue
        }
        
        if (validUntil < now) {
          console.log(`Voucher ${voucher.code} has expired`)
          continue
        }

        validVouchers.push({
          id: item.id,
          voucher_id: item.voucher_id,
          voucher_code: item.voucher_code,
          discount_amount: item.discount_amount,
          free_shipping: item.free_shipping,
          applied_at: item.applied_at,
          created_at: item.created_at,
          order_id: item.order_id,
          voucher: voucher
        })
      }

      console.log(`Valid vouchers for checkout: ${validVouchers.length}`)
      setUserVouchers(validVouchers)
    } catch (error) {
      console.error('Error fetching user vouchers:', error)
      setUserVouchers([])
    } finally {
      setLoadingVouchers(false)
    }
  }

  // Apply voucher
  const handleApplyVoucher = async (code: string) => {
    setVoucherLoading(true)
    setVoucherError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setVoucherError('Please login to use vouchers')
        return
      }

      // Check if voucher already used by this user
      const { data: existingUsage } = await supabase
        .from('voucher_usage')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('voucher_code', code.toUpperCase())
        .not('order_id', 'is', null)

      if (existingUsage && existingUsage.length > 0) {
        setVoucherError('You have already used this voucher')
        return
      }

      // Fetch voucher
      const { data: voucher, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single()

      if (error || !voucher) {
        setVoucherError('Invalid voucher code')
        return
      }

      // Check expiration
      const now = new Date()
      const validFrom = new Date(voucher.valid_from)
      const validUntil = new Date(voucher.valid_until)
      
      if (now < validFrom) {
        setVoucherError('This voucher is not yet available')
        return
      }
      
      if (now > validUntil) {
        setVoucherError('Voucher has expired')
        return
      }

      // Check usage limit
      if (voucher.usage_limit && (voucher.used_count || 0) >= voucher.usage_limit) {
        setVoucherError('Voucher usage limit reached')
        return
      }

      // Check minimum spend
      if (voucher.min_spend > 0 && subtotal < voucher.min_spend) {
        setVoucherError(`Minimum spend of ₱${voucher.min_spend.toLocaleString()} required`)
        return
      }

      // Calculate discount
      let discountAmount = 0
      let isFreeShipping = false

      if (voucher.type === 'percentage') {
        discountAmount = (subtotal * voucher.value) / 100
        if (voucher.max_discount && discountAmount > voucher.max_discount) {
          discountAmount = voucher.max_discount
        }
      } else if (voucher.type === 'fixed') {
        discountAmount = voucher.value
      } else if (voucher.type === 'free_shipping') {
        isFreeShipping = true
        discountAmount = 0
      }

      discountAmount = Math.round(discountAmount * 100) / 100

      // Check if user already has this voucher claimed but not used
      const { data: existingClaim } = await supabase
        .from('voucher_usage')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('voucher_id', voucher.id)
        .is('order_id', null)
        .maybeSingle()

      if (existingClaim) {
        setAppliedVoucher(voucher)
        setVoucherDiscount(discountAmount)
        setFreeShipping(isFreeShipping)
        setShowVoucherModal(false)
        setVoucherCode('')
        setVoucherLoading(false)
        return
      }

      // Store voucher usage
      const { error: insertError } = await supabase
        .from('voucher_usage')
        .insert({
          user_id: session.user.id,
          voucher_id: voucher.id,
          voucher_code: voucher.code,
          discount_amount: discountAmount,
          free_shipping: isFreeShipping,
        })

      if (insertError) {
        console.error('Error recording voucher usage:', insertError)
        setVoucherError('Failed to apply voucher')
        return
      }

      setAppliedVoucher(voucher)
      setVoucherDiscount(discountAmount)
      setFreeShipping(isFreeShipping)
      setShowVoucherModal(false)
      setVoucherCode('')
      
      // Refresh available vouchers
      await fetchUserVouchers(session.user.id)

    } catch (err) {
      console.error('Error applying voucher:', err)
      setVoucherError('Failed to apply voucher')
    } finally {
      setVoucherLoading(false)
    }
  }

  // Remove voucher
  const handleRemoveVoucher = async () => {
    if (!appliedVoucher || !userId) return

    try {
      const { error } = await supabase
        .from('voucher_usage')
        .delete()
        .eq('user_id', userId)
        .eq('voucher_id', appliedVoucher.id)
        .is('order_id', null)

      if (error) {
        console.error('Error removing voucher usage:', error)
      }

      setAppliedVoucher(null)
      setVoucherDiscount(0)
      setFreeShipping(false)
      await fetchUserVouchers(userId)
    } catch (err) {
      console.error('Error removing voucher:', err)
    }
  }

  // Payment return handler
  useEffect(() => {
    if (paymentProcessed) return

    const paymentSuccess = searchParams?.get('payment_success')
    const paymentCanceled = searchParams?.get('payment_canceled')
    const orderId = searchParams?.get('orderId')

    if (paymentSuccess === 'true' && orderId) {
      setPaymentProcessed(true)
      handleClearCart().then(() => {
        router.push(`/order-confirmation?orderId=${orderId}`)
      })
    }

    if (paymentCanceled === 'true') {
      setPaymentProcessed(true)
      alert('Payment cancelled.')
      const url = new URL(window.location.href)
      url.searchParams.delete('payment_canceled')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, router, handleClearCart, paymentProcessed])

  // Load data - FIXED to pass userId to fetchUserVouchers
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login?redirect=/checkout')
          return
        }
        
        const currentUserId = session.user.id
        setUserId(currentUserId)
        console.log('User ID from session:', currentUserId)

        const savedCheckout = localStorage.getItem('checkoutSummary')
        if (!savedCheckout) {
          router.push('/cart')
          return
        }

        const parsed = JSON.parse(savedCheckout)
        setCheckoutData(parsed)

        const { data: addressData, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', currentUserId)
          .order('is_default', { ascending: false })

        if (!error && addressData) {
          setAddresses(addressData)
          if (parsed.address) {
            setSelectedAddress(parsed.address)
          } else {
            const defaultAddress = addressData.find((a: Address) => a.is_default)
            if (defaultAddress) setSelectedAddress(defaultAddress)
          }
        }

        // Fetch user's claimed vouchers - PASS THE USER ID DIRECTLY
        await fetchUserVouchers(currentUserId)
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const formatAddress = (address: Address) => {
    return `${address.street_address}, ${address.barangay}, ${address.city}, ${address.province}`
  }

  const getVoucherDisplay = (voucher: any) => {
    if (!voucher) return ''
    switch (voucher.type) {
      case 'percentage':
        return `${voucher.value}% OFF${voucher.max_discount ? ` (up to ₱${voucher.max_discount.toLocaleString()})` : ''}`
      case 'fixed':
        return `₱${voucher.value.toLocaleString()} OFF`
      case 'free_shipping':
        return 'Free Shipping'
      default:
        return 'Discount'
    }
  }

  const getVoucherIcon = (type: string) => {
    switch (type) {
      case 'percentage':
        return <Percent className="h-4 w-4" />
      case 'free_shipping':
        return <Truck className="h-4 w-4" />
      default:
        return <Tag className="h-4 w-4" />
    }
  }

  const createOrder = async (paymentMethod: string, paymentStatus: string) => {
    if (!selectedAddress || !userId) {
      throw new Error('Missing address or user information.')
    }

    const items = (checkoutData?.items || cartItems).map((item: any) => ({
      id: item.id,
      quantity: item.quantity,
      price: Number(item.price ?? item.unit_price ?? 0),
    }))

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        address_id: selectedAddress.id,
        items,
        payment_method: paymentMethod,
        subtotal,
        shipping_fee: finalShippingFee,
        total_amount: total,
        payment_status: paymentStatus,
        order_status: paymentMethod === 'cod' ? 'pending' : 'pending_payment',
        notes: appliedVoucher ? `Voucher applied: ${appliedVoucher.code}` : null,
        voucher_id: appliedVoucher?.id ?? null,
        voucher_discount: voucherDiscount,
        voucher_code: appliedVoucher?.code ?? null,
        free_shipping: freeShipping,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Order creation failed')
    }

    const order = data.order

    if (!order) {
      throw new Error('No order data returned')
    }

    // Create payment record for COD
    if (paymentMethod === 'cod') {
      await supabase.from('payments').insert({
        order_id: order.id,
        payment_provider: 'cod',
        transaction_id: `COD-${order.id}-${Date.now()}`,
        amount: total,
        payment_status: 'pending',
        created_at: new Date().toISOString()
      })
    }

    // Create payment record for GCash
    if (paymentMethod === 'gcash') {
      await supabase.from('payments').insert({
        order_id: order.id,
        payment_provider: 'gcash',
        transaction_id: `GCASH-${order.id}-${Date.now()}`,
        amount: total,
        payment_status: 'pending',
        created_at: new Date().toISOString()
      })
    }

    // Update voucher usage if voucher was applied
    if (appliedVoucher) {
      const currentUsedCount = appliedVoucher.used_count || 0
      await supabase
        .from('vouchers')
        .update({ used_count: currentUsedCount + 1 })
        .eq('id', appliedVoucher.id)
      
      const { data: existingUsage } = await supabase
        .from('voucher_usage')
        .select('id')
        .eq('voucher_id', appliedVoucher.id)
        .eq('user_id', userId)
        .is('order_id', null)
        .single()

      if (existingUsage) {
        await supabase
          .from('voucher_usage')
          .update({
            order_id: order.id,
            discount_amount: voucherDiscount,
            free_shipping: freeShipping,
          })
          .eq('id', existingUsage.id)
      }
    }

    // Insert notification
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Order Created',
      message: `Your order #${order.id} was created successfully. Total: ${formatPrice(total)}`,
      is_read: false,
    })

    // Create status history
    await supabase.from('order_status_history').insert({
      order_id: order.id,
      status: order.order_status,
      notes: paymentMethod === 'cod' ? 'Order placed with COD' : 'Order placed - awaiting payment',
      created_at: new Date().toISOString(),
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('user-notifications-updated'))
    }

    return order
  }

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      alert('Please select a delivery address.')
      return
    }

    setIsProcessing(true)

    try {
      if (selectedPayment === 'cod') {
        const order = await createOrder('cod', 'unpaid')
        await handleClearCart()
        localStorage.removeItem('checkoutSummary')
        router.push(`/order-confirmation?orderId=${order.id}`)
      } else if (selectedPayment === 'gcash') {
        setShowGcashModal(true)
      }
    } catch (err: any) {
      console.error('Order placement error:', err)
      alert(err.message || 'Failed to place order. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const initiateGcashPayment = async () => {
    try {
      setGcashPaymentStatus('processing')
      setGcashError('')

      const order = await createOrder('gcash', 'pending_payment')

      if (!order?.id) {
        throw new Error('Failed to create order')
      }

      const computedTotal = Number((subtotal + finalShippingFee - voucherDiscount).toFixed(2))
      const amountInCentavos = Math.round(computedTotal * 100)

      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInCentavos,
          currency: 'PHP',
          orderId: order.id,
          description: `ROCARS Order #${order.id}`,
          successUrl: `${window.location.origin}/checkout?payment_success=true&orderId=${order.id}`,
          cancelUrl: `${window.location.origin}/checkout?payment_canceled=true`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Payment creation failed')
      }

      if (!data.checkoutUrl) {
        throw new Error('No checkout URL received')
      }

      localStorage.setItem('pendingGcashOrder', JSON.stringify({ orderId: order.id, total: computedTotal }))
      setGcashPaymentStatus('redirecting')
      setTimeout(() => { window.location.href = data.checkoutUrl }, 1000)

    } catch (err: any) {
      console.error('GCASH PAYMENT ERROR:', err)
      setGcashError(err?.message || 'Payment initialization failed')
      setGcashPaymentStatus('idle')
      alert(err?.message || 'Failed to initialize payment.')
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa] text-black pb-10">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/cart">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">Checkout</h1>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-7 space-y-5">
            {/* ADDRESS SECTION */}
            <div className="bg-white rounded-2xl border border-gray-200">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h2 className="font-semibold">Delivery Address</h2>
                  {selectedAddress && (
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedAddress.recipient_first_name} {selectedAddress.recipient_last_name}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowAddressModal(true)}
                  className="text-yellow-600 text-sm flex items-center gap-1"
                >
                  <Edit2 className="h-3 w-3" />
                  Change
                </button>
              </div>
              <div className="p-5">
                {selectedAddress ? (
                  <div className="flex gap-3">
                    <MapPin className="h-5 w-5 text-gray-400 mt-1" />
                    <div>
                      <p className="font-medium">
                        {selectedAddress.recipient_first_name} {selectedAddress.recipient_last_name}
                      </p>
                      <p className="text-sm text-gray-600">{formatAddress(selectedAddress)}</p>
                      <p className="text-sm text-gray-600">📞 {selectedAddress.phone_number}</p>
                      {selectedAddress.is_default && (
                        <span className="inline-block mt-2 bg-green-100 text-green-700 text-xs px-2 py-1 rounded">
                          Default Address
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddressModal(true)}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 text-gray-500 hover:border-yellow-400"
                  >
                    <Home className="h-8 w-8 mx-auto mb-2" />
                    Add Delivery Address
                  </button>
                )}
              </div>
            </div>

            {/* PAYMENT METHOD */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold mb-4">Payment Method</h2>
              <div className="space-y-3">
                <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${
                  selectedPayment === 'cod' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                }`}>
                  <input type="radio" checked={selectedPayment === 'cod'} onChange={() => setSelectedPayment('cod')} />
                  <div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Cash on Delivery</span>
                    </div>
                    <p className="text-sm text-gray-500">Pay upon receiving item</p>
                  </div>
                </label>

                <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${
                  selectedPayment === 'gcash' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                }`}>
                  <input type="radio" checked={selectedPayment === 'gcash'} onChange={() => setSelectedPayment('gcash')} />
                  <div>
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">GCash</span>
                    </div>
                    <p className="text-sm text-gray-500">Pay using GCash</p>
                  </div>
                </label>
              </div>
            </div>

            {/* ORDER ITEMS */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold mb-4">Order Items ({checkoutData?.items?.length || cartItems?.length || 0})</h2>
              <div className="space-y-4">
                {(checkoutData?.items || cartItems).map((item: CartItem) => (
                  <div key={item.id} className="flex gap-4">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="h-20 w-20 rounded-xl object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=No+Image'
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium line-clamp-2">{item.name}</p>
                      <p className="text-sm text-gray-500 mt-1">Qty: {item.quantity}</p>
                      <p className="text-xs text-gray-400">Price: {formatPrice(item.price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - ORDER SUMMARY */}
          <div className="lg:col-span-5">
            <div className="sticky top-24">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-xl font-bold">Order Summary</h3>
                  <button
                    onClick={() => setShowVoucherModal(true)}
                    className="flex items-center gap-1 text-sm text-yellow-600 hover:text-yellow-700 font-medium"
                  >
                    <Gift className="h-4 w-4" />
                    {appliedVoucher ? 'Change Voucher' : 'Add Voucher'}
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping Fee</span>
                    <span>
                      {freeShipping ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Free
                        </span>
                      ) : (
                        formatPrice(shippingFee)
                      )}
                    </span>
                  </div>
                  {voucherDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Voucher Discount</span>
                      <span>- {formatPrice(voucherDiscount)}</span>
                    </div>
                  )}
                </div>

                {/* Applied Voucher Display */}
                {appliedVoucher && (
                  <div className="mt-3 p-3 bg-green-50 rounded-xl">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        {getVoucherIcon(appliedVoucher.type)}
                        <span className="font-medium text-green-700">Voucher Applied</span>
                      </div>
                      <button onClick={handleRemoveVoucher} className="text-xs text-red-500 hover:text-red-600">
                        Remove
                      </button>
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      {getVoucherDisplay(appliedVoucher)} applied successfully!
                    </p>
                  </div>
                )}

                <div className="border-t border-gray-100 mt-5 pt-5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">Total</span>
                    <span className="text-2xl font-bold text-yellow-600">{formatPrice(total)}</span>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex gap-2 text-sm text-gray-600">
                    <Shield className="h-4 w-4" />
                    <span>Secure checkout protected</span>
                  </div>
                  <div className="flex gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Estimated delivery in 3-5 days</span>
                  </div>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={!selectedAddress || isProcessing}
                  className={`w-full mt-6 py-3 rounded-xl font-semibold transition ${
                    selectedAddress && !isProcessing
                      ? 'bg-yellow-400 hover:bg-yellow-500 text-black'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    `Place Order • ${formatPrice(total)}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ADDRESS MODAL */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold">Select Address</h3>
              <button onClick={() => setShowAddressModal(false)}>
                <XCircle className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4 max-h-125 overflow-y-auto">
              {addresses.length === 0 ? (
                <div className="text-center py-10">
                  <Home className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 mb-4">No saved addresses</p>
                  <button onClick={() => router.push('/profile?tab=addresses')} className="bg-black text-white px-4 py-2 rounded-lg">
                    Add Address
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <button
                      key={address.id}
                      onClick={() => {
                        setSelectedAddress(address)
                        setShowAddressModal(false)
                      }}
                      className={`w-full border-2 rounded-xl p-4 text-left transition ${
                        selectedAddress?.id === address.id ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{address.recipient_first_name} {address.recipient_last_name}</p>
                          <p className="text-sm text-gray-600 mt-1">{formatAddress(address)}</p>
                          <p className="text-sm text-gray-600">📞 {address.phone_number}</p>
                        </div>
                        {selectedAddress?.id === address.id && <CheckCircle2 className="h-5 w-5 text-yellow-500" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VOUCHER MODAL */}
      {showVoucherModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-yellow-600" />
                <h3 className="font-semibold">Apply Voucher</h3>
              </div>
              <button onClick={() => setShowVoucherModal(false)}>
                <XCircle className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4">
              {/* Enter voucher code */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Voucher Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="e.g., SAVE10, FREESHIP"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 font-mono"
                  />
                  <button
                    onClick={() => handleApplyVoucher(voucherCode)}
                    disabled={voucherLoading || !voucherCode.trim()}
                    className="px-4 py-2 bg-yellow-400 text-black rounded-xl font-medium hover:bg-yellow-500 transition disabled:opacity-50"
                  >
                    {voucherLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </button>
                </div>
                {voucherError && (
                  <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {voucherError}
                  </p>
                )}
              </div>

              {/* Available vouchers */}
              {userVouchers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet className="h-4 w-4 text-gray-500" />
                    <p className="text-sm font-medium text-gray-700">Your Available Vouchers</p>
                    <span className="text-xs text-gray-400">({userVouchers.length})</span>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {userVouchers.map((userVoucher) => {
                      const voucher = userVoucher.voucher
                      if (!voucher) return null
                      
                      const meetsMinSpend = voucher.min_spend === 0 || subtotal >= voucher.min_spend
                      
                      return (
                        <div
                          key={userVoucher.id}
                          className={`border rounded-xl p-3 transition ${
                            appliedVoucher?.id === voucher.id
                              ? 'border-green-400 bg-green-50'
                              : meetsMinSpend
                              ? 'border-gray-200 hover:border-yellow-300 cursor-pointer'
                              : 'border-gray-200 opacity-50'
                          }`}
                          onClick={() => meetsMinSpend && handleApplyVoucher(voucher.code)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="p-1 rounded-lg bg-yellow-100">
                                  {getVoucherIcon(voucher.type)}
                                </div>
                                <span className="text-xs font-bold text-yellow-700">
                                  {getVoucherDisplay(voucher)}
                                </span>
                                {appliedVoucher?.id === voucher.id && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                    Applied
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-xs text-gray-500">
                                Code: <span className="font-mono">{voucher.code}</span>
                              </p>
                              
                              {voucher.description && (
                                <p className="text-xs text-gray-400 mt-1">{voucher.description}</p>
                              )}
                              
                              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                                {voucher.min_spend > 0 && (
                                  <span>Min. Spend {formatPrice(voucher.min_spend)}</span>
                                )}
                                {voucher.max_discount && voucher.type === 'percentage' && (
                                  <span>Max {formatPrice(voucher.max_discount)}</span>
                                )}
                                <span>Expires: {new Date(voucher.valid_until).toLocaleDateString()}</span>
                              </div>
                              
                              {!meetsMinSpend && (
                                <p className="text-xs text-red-500 mt-1">
                                  Need {formatPrice(voucher.min_spend - subtotal)} more
                                </p>
                              )}
                            </div>
                            
                            {meetsMinSpend && appliedVoucher?.id !== voucher.id && (
                              <div className="ml-3">
                                <div className="text-yellow-600 text-sm font-medium">
                                  Apply →
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {userVouchers.length === 0 && !loadingVouchers && (
                <div className="text-center py-8">
                  <Gift className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No vouchers available</p>
                  <p className="text-xs text-gray-400 mt-1">
                    You haven't claimed any vouchers yet.
                  </p>
                  <button
                    onClick={() => router.push('/products')}
                    className="mt-4 text-yellow-600 text-sm hover:underline"
                  >
                    Browse vouchers →
                  </button>
                </div>
              )}

              {loadingVouchers && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GCASH MODAL */}
      {showGcashModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">GCash Payment</h3>
            {gcashPaymentStatus === 'idle' && (
              <>
                <div className="bg-blue-50 rounded-xl p-4 mb-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                    <p className="text-sm text-blue-700">You will be redirected to secure PayMongo checkout.</p>
                  </div>
                </div>
                <button onClick={initiateGcashPayment} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold">
                  Proceed to GCash
                </button>
              </>
            )}
            {(gcashPaymentStatus === 'processing' || gcashPaymentStatus === 'redirecting') && (
              <div className="text-center py-8">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-500 mb-4" />
                <p className="font-medium">Redirecting to GCash...</p>
              </div>
            )}
            {gcashError && (
              <div className="mt-4 text-center">
                <p className="text-red-500 text-sm">{gcashError}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}