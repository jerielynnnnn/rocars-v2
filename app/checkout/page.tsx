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
  PlusCircle,
  Edit2,
  CheckCircle2,
  Gift,
  Percent,
  Tag,
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

  // Memoize clearCart to prevent unnecessary re-renders
  const handleClearCart = useCallback(async () => {
    try {
      await clearCart()
      localStorage.removeItem('checkoutSummary')
      localStorage.removeItem('pendingGcashOrder')
    } catch (error) {
      console.error('Error clearing cart:', error)
    }
  }, [clearCart])

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

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login?redirect=/checkout')
          return
        }
        setUserId(session.user.id)

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
          .eq('user_id', session.user.id)
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
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  const subtotal = Number(checkoutData?.subtotal || 0)
  const shippingFee = Number(checkoutData?.shippingFee || 0)
  const discount = Number(checkoutData?.voucherDiscount || 0)
  const freeShipping = checkoutData?.freeShipping || false
  const appliedVoucher = checkoutData?.appliedVoucher || null
  const finalShippingFee = freeShipping ? 0 : shippingFee
  const total = subtotal - discount + finalShippingFee

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
        return `${voucher.value}% OFF`
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

    const orderPayload: any = {
      user_id: userId,
      address_id: selectedAddress.id,
      order_status: paymentMethod === 'cod' ? 'pending' : 'pending_payment',
      payment_status: paymentStatus,
      subtotal: subtotal,
      shipping_fee: finalShippingFee,
      total_amount: total,
      payment_method: paymentMethod,
      notes: appliedVoucher ? `Voucher applied: ${appliedVoucher.code}` : null,
    }

    if (appliedVoucher) {
      orderPayload.voucher_id = appliedVoucher.id
      orderPayload.voucher_discount = discount
      orderPayload.voucher_code = appliedVoucher.code
      orderPayload.free_shipping = freeShipping
    }

    console.log('Creating order with payload:', orderPayload)

    const { data: order, error } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single()

    if (error) throw new Error(`Order creation failed: ${error.message}`)
    if (!order) throw new Error('No order data returned')

    const items = checkoutData?.items || cartItems
    for (const item of items) {
      if (!item.id || !item.quantity || !item.price) continue

      const { error: itemError } = await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: item.id,
          quantity: item.quantity,
          price: Number(item.price),
        })

      if (itemError) {
        console.error('ORDER ITEM INSERT ERROR:', itemError)
        throw new Error(itemError.message)
      }
    }

    // ============================================
    // FIX 1: CREATE PAYMENT RECORD FOR COD ORDERS
    // ============================================
    if (paymentMethod === 'cod') {
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          order_id: order.id,
          payment_provider: 'cod',
          transaction_id: `COD-${order.id}-${Date.now()}`,
          amount: total,
          payment_status: 'pending',
          created_at: new Date().toISOString()
        })

      if (paymentError) {
        console.error('Error creating COD payment record:', paymentError)
        // Don't throw - order is already created
      } else {
        console.log('✅ COD payment record created for order:', order.id)
      }
    }

    // ============================================
    // FIX 2: CREATE GCASH PAYMENT RECORD
    // ============================================
    if (paymentMethod === 'gcash') {
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          order_id: order.id,
          payment_provider: 'gcash',
          transaction_id: `GCASH-${order.id}-${Date.now()}`,
          amount: total,
          payment_status: 'pending',
          created_at: new Date().toISOString()
        })

      if (paymentError) {
        console.error('Error creating GCASH payment record:', paymentError)
      } else {
        console.log('✅ GCASH payment record created for order:', order.id)
      }
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
            discount_amount: discount,
            free_shipping: freeShipping,
          })
          .eq('id', existingUsage.id)
      }
    }

    // Insert notification
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: 'Order Created',
        message: `Your order #${order.id} was created successfully. Total: ${formatPrice(total)}`,
        is_read: false,
      })

    if (notifError) {
      console.error('Error creating notification:', notifError)
    }

    // ============================================
    // FIX 3: USE CORRECT TABLE NAME - order_status_history
    // ============================================
    const { error: historyError } = await supabase
      .from('order_status_history')  // ← Correct table name from your schema
      .insert({
        order_id: order.id,
        status: order.order_status,
        notes: paymentMethod === 'cod' ? 'Order placed with COD - pending payment collection' : 'Order placed - awaiting payment',
        created_at: new Date().toISOString(),
      })

    if (historyError) {
      console.error('Error creating status history:', historyError)
      // Don't throw - order was created successfully
    } else {
      console.log('✅ Status history created for order:', order.id)
    }

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

      const cleanSubtotal = Number(Number(subtotal).toFixed(2))
      const cleanShippingFee = Number(Number(finalShippingFee).toFixed(2))
      const cleanDiscount = Number(Number(discount).toFixed(2))

      const computedTotal = Number(
        (
          cleanSubtotal +
          cleanShippingFee -
          cleanDiscount
        ).toFixed(2)
      )

      if (isNaN(computedTotal) || computedTotal <= 0) {
        throw new Error(`Invalid computed total: ${computedTotal}`)
      }

      const amountInCentavos = Math.round(computedTotal * 100)

      if (!Number.isInteger(amountInCentavos)) {
        throw new Error('Invalid centavo conversion')
      }

      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      localStorage.setItem(
        'pendingGcashOrder',
        JSON.stringify({
          orderId: order.id,
          subtotal: cleanSubtotal,
          shippingFee: cleanShippingFee,
          discount: cleanDiscount,
          total: computedTotal,
          centavos: amountInCentavos,
        })
      )

      setGcashPaymentStatus('redirecting')

      setTimeout(() => {
        window.location.href = data.checkoutUrl
      }, 1000)

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
              <h2 className="font-semibold mb-4">Order Items</h2>
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
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
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
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span>{formatPrice(finalShippingFee)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>- {formatPrice(discount)}</span>
                    </div>
                  )}
                </div>

                {appliedVoucher && (
                  <div className="mt-3 p-3 bg-green-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      {getVoucherIcon(appliedVoucher.type)}
                      <span className="font-medium text-green-700">Voucher Applied</span>
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
            <div className="p-4 max-h-[500px] overflow-y-auto">
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