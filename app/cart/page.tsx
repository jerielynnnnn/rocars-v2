// app/cart/page.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { supabase } from '@/lib/supabase'
import { useVoucher } from '@/hooks/useVoucher'
import { 
  Minus, 
  Plus, 
  Trash2, 
  ShoppingBag, 
  ArrowLeft, 
  CreditCard, 
  LogIn,
  Truck,
  Home,
  PlusCircle,
  Edit2,
  CheckSquare,
  Square,
  Sparkles,
  CheckCircle,
  Gift,
  Percent,
  Wallet,
  XCircle,
  Loader2
} from 'lucide-react'

// Coordinates for Bacoor (origin)
const BACOOR_COORDINATES = {
  lat: 14.4595,
  lng: 120.9499
}

// Shipping rates per km
const SHIPPING_RATES = {
  base: 50,
  perKm: 12,
  minFee: 50,
  maxFee: 500
}

// Calculate distance using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

function calculateShippingFee(distance: number): number {
  if (distance <= 5) {
    return SHIPPING_RATES.base
  }
  const additional = (distance - 5) * SHIPPING_RATES.perKm
  const total = SHIPPING_RATES.base + additional
  return Math.min(Math.max(total, SHIPPING_RATES.minFee), SHIPPING_RATES.maxFee)
}

// City coordinates mapping (expanded)
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Bacoor': { lat: 14.4595, lng: 120.9499 },
  'Imus': { lat: 14.4297, lng: 120.9367 },
  'Dasmarinas': { lat: 14.3294, lng: 120.9367 },
  'Dasmarinas City': { lat: 14.3294, lng: 120.9367 },
  'General Trias': { lat: 14.3869, lng: 120.8817 },
  'Tanza': { lat: 14.3986, lng: 120.8533 },
  'Kawit': { lat: 14.4447, lng: 120.9017 },
  'Silang': { lat: 14.2306, lng: 120.9753 },
  'Tagaytay': { lat: 14.1167, lng: 120.9625 },
  'Trece Martires': { lat: 14.2833, lng: 120.8667 },
  'Carmona': { lat: 14.3167, lng: 121.0575 },
  'Naic': { lat: 14.3167, lng: 120.7667 },
  'Indang': { lat: 14.2000, lng: 120.8833 },
  'Alfonso': { lat: 14.1333, lng: 120.8500 },
  'General Mariano Alvarez': { lat: 14.3000, lng: 121.0000 },
  'GMA': { lat: 14.3000, lng: 121.0000 },
  'Noveleta': { lat: 14.4333, lng: 120.8833 },
  'Rosario': { lat: 14.4167, lng: 120.8500 },
  'Mendez': { lat: 14.1333, lng: 120.9000 },
  'Amadeo': { lat: 14.1667, lng: 120.9167 },
  'Magallanes': { lat: 14.1833, lng: 120.7500 },
  'Maragondon': { lat: 14.2667, lng: 120.7333 },
  'Ternate': { lat: 14.2833, lng: 120.7167 },
  'Manila': { lat: 14.5995, lng: 120.9842 },
  'Makati': { lat: 14.5547, lng: 121.0244 },
  'Taguig': { lat: 14.5243, lng: 121.0792 },
  'Quezon City': { lat: 14.6760, lng: 121.0437 },
  'QC': { lat: 14.6760, lng: 121.0437 },
  'Pasig': { lat: 14.5833, lng: 121.0833 },
  'Mandaluyong': { lat: 14.5833, lng: 121.0333 },
  'Caloocan': { lat: 14.6500, lng: 120.9667 },
  'Las Pinas': { lat: 14.4500, lng: 120.9833 },
  'Las Piñas': { lat: 14.4500, lng: 120.9833 },
  'Paranaque': { lat: 14.4793, lng: 121.0194 },
  'Parañaque': { lat: 14.4793, lng: 121.0194 },
  'Pasay': { lat: 14.5378, lng: 121.0014 },
  'Muntinlupa': { lat: 14.3833, lng: 121.0500 },
  'Marikina': { lat: 14.6500, lng: 121.1000 },
  'Valenzuela': { lat: 14.7000, lng: 120.9833 },
  'Malabon': { lat: 14.6667, lng: 120.9667 },
  'Navotas': { lat: 14.6667, lng: 120.9500 },
  'San Juan': { lat: 14.6000, lng: 121.0333 },
  'Pateros': { lat: 14.5500, lng: 121.0667 },
  'Santa Rosa': { lat: 14.3125, lng: 121.1114 },
  'Santa Rosa Laguna': { lat: 14.3125, lng: 121.1114 },
  'Biñan': { lat: 14.3333, lng: 121.0833 },
  'Cabuyao': { lat: 14.2750, lng: 121.1250 },
  'Calamba': { lat: 14.2167, lng: 121.1667 },
  'San Pedro': { lat: 14.3500, lng: 121.0333 },
  'Los Baños': { lat: 14.1833, lng: 121.2333 },
  'Batangas City': { lat: 13.7500, lng: 121.0500 },
  'Lipa': { lat: 13.9333, lng: 121.1667 },
  'Tanauan': { lat: 14.0833, lng: 121.1500 },
  'Antipolo': { lat: 14.5833, lng: 121.1667 },
  'Cainta': { lat: 14.5667, lng: 121.1167 },
  'Taytay': { lat: 14.5667, lng: 121.1333 },
  'Malolos': { lat: 14.8333, lng: 120.8167 },
  'Meycauayan': { lat: 14.7333, lng: 120.9500 },
  'San Jose Del Monte': { lat: 14.8000, lng: 121.0500 },
  'San Fernando': { lat: 15.0333, lng: 120.6833 },
  'Angeles': { lat: 15.1333, lng: 120.5833 },
  'Mabalacat': { lat: 15.2167, lng: 120.5667 },
}

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

interface UserVoucher {
  id: number
  voucher_id: number
  voucher_code: string
  discount_amount: number
  free_shipping: boolean
  applied_at: string
  order_id: number | null
  vouchers?: {
    id: number
    code: string
    type: 'fixed' | 'percentage' | 'free_shipping'
    value: number
    min_spend: number
    max_discount: number | null
    description: string | null
    valid_until: string
    used_count?: number
  }
}

export default function CartPage() {
  const router = useRouter()
  const { cartItems, updateQuantity, removeFromCart, clearCart } = useCart()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [showVoucherModal, setShowVoucherModal] = useState(false)
  const [shippingFee, setShippingFee] = useState(0)
  const [distance, setDistance] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [selectAll, setSelectAll] = useState(true)
  const [userVouchers, setUserVouchers] = useState<UserVoucher[]>([])
  const [loadingVouchers, setLoadingVouchers] = useState(false)

  // Remove duplicate items
  const uniqueCartItems = cartItems.reduce((acc, current) => {
    const existing = acc.find(item => item.id === current.id)
    if (existing) {
      existing.quantity += current.quantity
    } else {
      acc.push({ ...current })
    }
    return acc
  }, [] as typeof cartItems)

  // Calculate subtotal only for selected items
  const subtotal = uniqueCartItems
    .filter(item => selectedItems.has(item.id))
    .reduce((sum, item) => sum + item.price * item.quantity, 0)

  // Use the voucher hook
  const {
    voucherCode,
    setVoucherCode,
    appliedVoucher,
    discount,
    freeShipping,
    error: voucherError,
    loading: voucherLoading,
    applyVoucher,
    removeVoucher,
    finalShippingFee,
    total: totalWithDiscount,
  } = useVoucher(subtotal, shippingFee)

  // Initialize selected items
  useEffect(() => {
    const allIds = new Set(uniqueCartItems.map(item => item.id))
    setSelectedItems(allIds)
    setSelectAll(true)
  }, [cartItems])

  useEffect(() => {
    checkAuth()
    loadAddresses()
  }, [])

  useEffect(() => {
    if (isLoggedIn && userId) {
      fetchUserVouchers()
    }
  }, [isLoggedIn, userId, subtotal])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setIsLoggedIn(!!session)
    if (session?.user) {
      setUserId(session.user.id)
    }
    setLoading(false)
  }

  const loadAddresses = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', session.user.id)
      .order('is_default', { ascending: false })

    if (!error && data && data.length > 0) {
      setAddresses(data)
      const defaultAddress = data.find(addr => addr.is_default)
      if (defaultAddress && defaultAddress.city) {
        setSelectedAddress(defaultAddress)
        calculateShippingFromAddress(defaultAddress)
      } else if (data[0] && data[0].city) {
        setSelectedAddress(data[0])
        calculateShippingFromAddress(data[0])
      }
    }
  }

  const fetchUserVouchers = async () => {
    if (!userId) return
    setLoadingVouchers(true)
    try {
      const { data, error } = await supabase
        .from('voucher_usage')
        .select(`
          *,
          vouchers (*)
        `)
        .eq('user_id', userId)
        .is('order_id', null)
        .order('applied_at', { ascending: false })

      if (error) throw error

      const now = new Date()
      const validVouchers = (data || []).filter((v: any) => {
        if (!v.vouchers) return false
        const validUntil = new Date(v.vouchers.valid_until)
        return validUntil > now
      })

      setUserVouchers(validVouchers)
    } catch (error) {
      console.error('Error fetching user vouchers:', error)
    } finally {
      setLoadingVouchers(false)
    }
  }

  const calculateShippingFromAddress = (address: Address) => {
    if (!address || !address.city) {
      setDistance(15)
      setShippingFee(calculateShippingFee(15))
      return
    }

    const cityName = address.city.split(',')[0]?.trim() || ''
    const coordinates = CITY_COORDINATES[cityName]
    
    if (coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number') {
      const dist = calculateDistance(
        BACOOR_COORDINATES.lat, 
        BACOOR_COORDINATES.lng,
        coordinates.lat, 
        coordinates.lng
      )
      setDistance(Math.round(dist))
      const fee = calculateShippingFee(dist)
      setShippingFee(Math.round(fee))
    } else {
      console.warn(`City not found in coordinates mapping: ${cityName}, using default distance`)
      setDistance(15)
      setShippingFee(calculateShippingFee(15))
    }
  }

  const handleAddressSelect = (address: Address) => {
    setSelectedAddress(address)
    calculateShippingFromAddress(address)
    setShowAddressModal(false)
  }

  const handleAddNewAddress = () => {
    router.push('/profile?tab=addresses')
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const toggleItemSelection = (itemId: number) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
    setSelectAll(newSelected.size === uniqueCartItems.length && uniqueCartItems.length > 0)
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set())
      setSelectAll(false)
    } else {
      const allIds = new Set(uniqueCartItems.map(item => item.id))
      setSelectedItems(allIds)
      setSelectAll(true)
    }
  }

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      alert('Please enter a voucher code')
      return
    }
    const success = await applyVoucher(voucherCode)
    if (!success && voucherError) {
      alert(voucherError)
    } else if (success) {
      setShowVoucherModal(false)
    }
  }

  const handleApplyUserVoucher = async (userVoucher: UserVoucher) => {
    if (!userVoucher.vouchers) return
    
    const voucher = userVoucher.vouchers
    
    const now = new Date()
    const validUntil = new Date(voucher.valid_until)
    if (validUntil < now) {
      alert('This voucher has expired')
      await fetchUserVouchers()
      return
    }

    if (voucher.min_spend > 0 && subtotal < voucher.min_spend) {
      alert(`Minimum spend of ${formatPrice(voucher.min_spend)} required for this voucher`)
      return
    }

    const success = await applyVoucher(voucher.code)
    if (success) {
      setShowVoucherModal(false)
    } else {
      alert(voucherError || 'Failed to apply voucher')
    }
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
        return <Gift className="h-4 w-4" />
    }
  }

  const handleProceedToCheckout = () => {
    if (!isLoggedIn) {
      router.push('/login')
      return
    }
    
    if (!selectedAddress) {
      alert('Please select a delivery address')
      return
    }
    
    if (selectedItems.size === 0) {
      alert('Please select at least one item to checkout')
      return
    }
    
    const itemsToCheckout = uniqueCartItems.filter(item => selectedItems.has(item.id))
    const checkoutData = {
      items: itemsToCheckout,
      subtotal: subtotal,
      shippingFee: finalShippingFee,
      voucherDiscount: discount,
      freeShipping: freeShipping,
      appliedVoucher: appliedVoucher,
      address: selectedAddress,
      distance: distance,
      total: totalWithDiscount,
    }
    localStorage.setItem('checkoutSummary', JSON.stringify(checkoutData))
    
    router.push('/checkout')
  }

  const formatAddressDisplay = (address: Address) => {
    const parts = [
      address.street_address,
      address.barangay,
      address.city,
      address.province
    ].filter(Boolean)
    return parts.join(', ')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8f9fa]">
        <div className="mx-auto max-w-7xl px-4 py-24 text-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </main>
    )
  }

  if (uniqueCartItems.length === 0) {
    return (
      <main className="min-h-screen bg-[#f8f9fa]">
        <div className="mx-auto max-w-7xl px-4 py-24 text-center">
          <div className="mx-auto max-w-md">
            <ShoppingBag className="mx-auto h-24 w-24 text-gray-300" />
            <h1 className="mt-6 text-2xl font-bold text-black">Your cart is empty</h1>
            <p className="mt-2 text-gray-500">Looks like you haven't added any items yet.</p>
            <Link
              href="/"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-black px-6 py-3 text-white transition hover:bg-yellow-500 hover:text-black"
            >
              <ArrowLeft className="h-4 w-4" />
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa] py-8">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-500 transition hover:text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Continue Shopping
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-black"
            >
              {selectAll ? (
                <CheckSquare className="h-4 w-4 text-yellow-500" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {selectAll ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={clearCart}
              className="text-sm text-red-500 transition hover:text-red-600"
            >
              Clear Cart
            </button>
          </div>
        </div>

        <h1 className="mb-8 text-3xl font-bold text-black">Shopping Cart</h1>
        <p className="text-sm text-gray-500 mb-4">
          {selectedItems.size} of {uniqueCartItems.length} items selected
        </p>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white">
              {uniqueCartItems.map((item) => (
                <div
                  key={`cart-item-${item.id}`}
                  className={`flex flex-col gap-4 border-b border-gray-100 p-5 last:border-0 sm:flex-row sm:items-center transition ${
                    selectedItems.has(item.id) ? 'bg-white' : 'bg-gray-50 opacity-70'
                  }`}
                >
                  <button
                    onClick={() => toggleItemSelection(item.id)}
                    className="shrink-0"
                  >
                    {selectedItems.has(item.id) ? (
                      <CheckSquare className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400" />
                    )}
                  </button>

                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=No+Image'
                      }}
                    />
                  </div>

                  <div className="flex-1">
                    <h3 className="font-medium text-black">{item.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {formatPrice(item.price)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 transition hover:bg-gray-50"
                      disabled={!selectedItems.has(item.id)}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 transition hover:bg-gray-50"
                      disabled={!selectedItems.has(item.id)}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-6 sm:justify-end">
                    <span className="font-semibold text-black">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-gray-400 transition hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          {selectedItems.size > 0 ? (
            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-6">
                
                {/* Delivery Address Section */}
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-gray-500" />
                      <span className="font-semibold text-black">Delivery Address</span>
                    </div>
                    <button
                      onClick={() => setShowAddressModal(true)}
                      className="text-xs text-yellow-600 hover:text-yellow-700 flex items-center gap-1"
                    >
                      {selectedAddress ? <Edit2 className="h-3 w-3" /> : <PlusCircle className="h-3 w-3" />}
                      {selectedAddress ? 'Change' : 'Add Address'}
                    </button>
                  </div>
                  
                  {selectedAddress ? (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="font-medium text-black">
                        {selectedAddress.recipient_first_name} {selectedAddress.recipient_last_name}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatAddressDisplay(selectedAddress)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {selectedAddress.zip_code}
                      </p>
                      <p className="text-sm text-gray-600">
                        📞 {selectedAddress.phone_number}
                      </p>
                      {selectedAddress.is_default && (
                        <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Default Address
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddressModal(true)}
                      className="w-full text-center py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-yellow-400 hover:text-yellow-600 transition"
                    >
                      <PlusCircle className="h-8 w-8 mx-auto mb-2" />
                      <span className="text-sm">Add delivery address</span>
                    </button>
                  )}
                </div>

                {/* Delivery Info */}
                {selectedAddress && (
                  <div className="mb-4 pb-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-black">Delivery</p>
                        <p className="text-sm text-gray-500 mt-1">Standard delivery</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-green-600">
                          {distance <= 10 ? '1-2 days' : distance <= 30 ? '2-3 days' : '3-5 days'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <Truck className="h-3 w-3" />
                      <span>{distance} km from Bacoor • {freeShipping ? 'Free Shipping' : formatPrice(shippingFee)}</span>
                    </div>
                  </div>
                )}

                {/* Order Summary Details */}
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold">Order Summary</h2>
                  <button
                    onClick={() => setShowVoucherModal(true)}
                    className="flex items-center gap-1 text-sm text-yellow-600 hover:text-yellow-700"
                  >
                    <Gift className="h-4 w-4" />
                    {appliedVoucher ? 'Change Voucher' : 'Add Voucher'}
                  </button>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Product subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  
                  {selectedAddress && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping fee</span>
                      <span className="font-medium">
                        {freeShipping ? formatPrice(0) : formatPrice(shippingFee)}
                      </span>
                    </div>
                  )}
                  
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Voucher discount</span>
                      <span>- {formatPrice(discount)}</span>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="border-t border-gray-100 pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">Total</span>
                    <span className="font-bold text-2xl text-yellow-600">
                      {formatPrice(totalWithDiscount)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">({selectedItems.size} items selected)</p>
                </div>

                {/* Applied Voucher Display */}
                {appliedVoucher && (
                  <div className="mt-4 p-3 bg-green-50 rounded-xl">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        {getVoucherIcon(appliedVoucher.type)}
                        <span className="font-medium text-green-700">Voucher Applied</span>
                      </div>
                      <button onClick={removeVoucher} className="text-xs text-red-500 hover:text-red-600">
                        Remove
                      </button>
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      {getVoucherDisplay(appliedVoucher)} applied successfully!
                    </p>
                  </div>
                )}

                {/* Checkout Button */}
                {!isLoggedIn ? (
                  <button
                    onClick={() => router.push('/login')}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 py-3 font-semibold text-white transition hover:bg-yellow-500 hover:text-black"
                  >
                    <LogIn className="h-5 w-5" />
                    Login to Checkout
                  </button>
                ) : (
                  <button
                    onClick={handleProceedToCheckout}
                    disabled={!selectedAddress}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 font-semibold text-white transition hover:bg-yellow-500 hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CreditCard className="h-5 w-5" />
                    Proceed to Checkout
                  </button>
                )}

                {isLoggedIn && !selectedAddress && (
                  <p className="mt-2 text-center text-xs text-red-500">
                    Please add a delivery address to continue
                  </p>
                )}

                <p className="mt-4 text-center text-xs text-gray-400">
                  Secure checkout powered by ROCARS
                </p>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-6 text-center">
                <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No items selected</p>
                <p className="text-sm text-gray-400 mt-1">Please select items to checkout</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Address Selection Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-lg">Select Delivery Address</h3>
              <button
                onClick={() => setShowAddressModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              {addresses.length === 0 ? (
                <div className="text-center py-8">
                  <Home className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">No saved addresses yet</p>
                  <button
                    onClick={handleAddNewAddress}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add New Address
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <button
                      key={address.id}
                      onClick={() => handleAddressSelect(address)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition ${
                        selectedAddress?.id === address.id
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            {address.recipient_first_name} {address.recipient_last_name}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {address.street_address}, {address.barangay}
                          </p>
                          <p className="text-sm text-gray-600">
                            {address.city}, {address.province} {address.zip_code}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            📞 {address.phone_number}
                          </p>
                        </div>
                        {address.is_default && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  
                  <button
                    onClick={handleAddNewAddress}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-yellow-400 hover:text-yellow-600 transition"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add New Address
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Voucher Modal */}
      {showVoucherModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-yellow-500" />
                <h3 className="font-semibold">Apply Voucher</h3>
              </div>
              <button onClick={() => setShowVoucherModal(false)}>
                <XCircle className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4">
              {/* Manual Voucher Entry */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Voucher Code
                </label>
                <div className="flex gap-2">
                  <input
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="Enter code (e.g., SAVE10)"
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-yellow-400"
                    disabled={!!appliedVoucher}
                  />
                  {appliedVoucher ? (
                    <button
                      onClick={removeVoucher}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 rounded-xl font-medium"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={handleApplyVoucher}
                      disabled={voucherLoading}
                      className="bg-yellow-400 hover:bg-yellow-500 text-black px-4 rounded-xl font-medium disabled:opacity-50"
                    >
                      {voucherLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                    </button>
                  )}
                </div>
                {voucherError && <p className="text-xs text-red-500 mt-2">{voucherError}</p>}
              </div>

              {/* My Vouchers Section */}
              {userVouchers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet className="h-4 w-4 text-gray-500" />
                    <h4 className="text-sm font-medium text-gray-700">My Vouchers</h4>
                    <span className="text-xs text-gray-400">({userVouchers.length} available)</span>
                  </div>
                  
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {userVouchers.map((userVoucher) => {
                      const voucher = userVoucher.vouchers
                      if (!voucher) return null
                      
                      const isExpired = new Date(voucher.valid_until) < new Date()
                      const meetsMinSpend = voucher.min_spend === 0 || subtotal >= voucher.min_spend
                      const isApplicable = !isExpired && meetsMinSpend
                      
                      return (
                        <div
                          key={userVoucher.id}
                          className={`border rounded-xl p-3 transition ${
                            appliedVoucher?.id === voucher.id
                              ? 'border-green-400 bg-green-50'
                              : isApplicable
                              ? 'border-gray-200 hover:border-yellow-300 cursor-pointer'
                              : 'border-gray-200 opacity-50'
                          }`}
                          onClick={() => isApplicable && handleApplyUserVoucher(userVoucher)}
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
                                  Need {formatPrice(voucher.min_spend - subtotal)} more to use this voucher
                                </p>
                              )}
                            </div>
                            
                            {isApplicable && appliedVoucher?.id !== voucher.id && (
                              <div className="ml-3">
                                <button className="text-yellow-600 text-sm font-medium hover:text-yellow-700">
                                  Apply
                                </button>
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
                  <Link href="/vouchers" className="text-xs text-yellow-600 hover:underline mt-1 inline-block">
                    Browse vouchers →
                  </Link>
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
    </main>
  )
}