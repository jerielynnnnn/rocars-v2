// app/orders/page.tsx (Updated with cancellation requests)
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PageContainer from '@/components/layout/PageContainer'
import PageSection from '@/components/layout/PageSection'
import {
  ShoppingBag,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Loader2,
  Eye,
  Calendar,
  CreditCard,
  MapPin,
  Filter,
  ChevronDown,
  Bell,
  AlertCircle,
  Send,
  RefreshCw,
} from 'lucide-react'

type OrderItem = {
  id: number
  quantity: number
  price: number
  product: {
    id: number
    name: string
    slug: string
    image?: string
  } | null
}

type Address = {
  recipient_first_name: string
  recipient_last_name: string
  city: string
  province: string
  barangay: string
  street_address: string
  phone_number?: string
}

type CancellationRequest = {
  id: number
  order_id: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
  processed_at: string | null
}

type Order = {
  id: number
  order_status: string
  payment_status: string
  total_amount: number
  payment_method: string
  created_at: string
  tracking_number: string | null
  estimated_delivery_date: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  cancellation_request?: CancellationRequest
  order_items: OrderItem[]
  addresses: Address | null
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  pending_payment: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending Payment' },
  pending: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Pending' },
  processing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Processing' },
  shipped: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Shipped' },
  delivered: { bg: 'bg-green-100', text: 'text-green-700', label: 'Delivered' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
}

const statusOrder = [
  'all',
  'pending_payment',
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]

// Orders that can be requested for cancellation
const CANCELLABLE_STATUSES = ['pending_payment', 'pending', 'processing']

export default function OrdersPage() {
  const router = useRouter()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTab, setSelectedTab] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [dateRange, setDateRange] = useState<'all' | 'week' | 'month' | 'year'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest')
  const [newNotification, setNewNotification] = useState<string | null>(null)
  
  // Cancellation request modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [cancellationError, setCancellationError] = useState<string | null>(null)
  const [existingRequest, setExistingRequest] = useState<CancellationRequest | null>(null)

  useEffect(() => {
    let isMounted = true
    let ordersChannel: any = null
    let notificationsChannel: any = null

    const initialize = async () => {
      await loadOrders()
      if (isMounted) {
        const channels = await setupRealtimeSubscription()
        ordersChannel = channels?.ordersChannel
        notificationsChannel = channels?.notificationsChannel
      }
    }

    initialize()

    return () => {
      isMounted = false
      if (ordersChannel) {
        supabase.removeChannel(ordersChannel)
      }
      if (notificationsChannel) {
        supabase.removeChannel(notificationsChannel)
      }
    }
  }, [])

  const setupRealtimeSubscription = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) return null

    const ordersChannel = supabase.channel('orders-changes')
    const notificationsChannel = supabase.channel('notifications-changes')

    ordersChannel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${session.user.id}`,
      },
      (payload) => {
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === payload.new.id 
              ? { ...order, ...payload.new }
              : order
          )
        )
        
        const newStatus = payload.new.order_status
        const oldStatus = payload.old?.order_status
        
        if (newStatus !== oldStatus) {
          const statusMessage = newStatus === 'cancelled' 
            ? `Order #${payload.new.id} has been cancelled`
            : `Order #${payload.new.id} status updated to ${statusStyles[newStatus]?.label || newStatus}`
          setNewNotification(statusMessage)
          setTimeout(() => setNewNotification(null), 5000)
        }
      }
    )

    notificationsChannel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${session.user.id}`,
      },
      (payload) => {
        setNewNotification(payload.new.message)
        setTimeout(() => setNewNotification(null), 5000)
      }
    )

    ordersChannel.subscribe()
    notificationsChannel.subscribe()

    return { ordersChannel, notificationsChannel }
  }

  const loadOrders = async () => {
    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login?redirect=/orders')
        return
      }

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          addresses (
            recipient_first_name,
            recipient_last_name,
            city,
            province,
            barangay,
            street_address,
            phone_number
          ),
          order_items (
            id,
            quantity,
            price,
            product:products (
              id,
              name,
              slug
            )
          )
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      // Fetch cancellation requests for these orders
      const orderIds = (ordersData || []).map((o: any) => o.id)
      if (orderIds.length > 0) {
        const { data: requestsData } = await supabase
          .from('cancellation_requests')
          .select('*')
          .in('order_id', orderIds)
          .eq('user_id', session.user.id)

        // Merge cancellation requests into orders
        const ordersWithRequests = (ordersData || []).map((order: any) => ({
          ...order,
          cancellation_request: requestsData?.find((r: any) => r.order_id === order.id)
        }))
        
        setOrders(ordersWithRequests as any)
      } else {
        setOrders((ordersData as any) || [])
      }
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  // Submit cancellation request (instead of direct cancellation)
  const submitCancellationRequest = async () => {
    if (!selectedOrderId) return
    
    const finalReason = cancellationReason === 'Other' ? customReason : cancellationReason
    if (!finalReason.trim()) {
      setCancellationError('Please provide a reason for cancellation')
      return
    }

    setSubmittingRequest(true)
    setCancellationError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Create cancellation request
      const { error: insertError } = await supabase
        .from('cancellation_requests')
        .insert({
          order_id: selectedOrderId,
          user_id: session.user.id,
          reason: finalReason,
          status: 'pending',
          created_at: new Date().toISOString()
        })

      if (insertError) throw insertError

      // Create notification for user
      await supabase.from('notifications').insert({
        user_id: session.user.id,
        title: 'Cancellation Request Submitted',
        message: `Your cancellation request for order #${selectedOrderId} has been submitted. You will be notified once reviewed.`,
        type: 'cancellation_request',
        metadata: { order_id: selectedOrderId },
      })

      // Close modal and refresh orders
      setCancelModalOpen(false)
      setSelectedOrderId(null)
      setCancellationReason('')
      setCustomReason('')
      
      setNewNotification(`Cancellation request for order #${selectedOrderId} has been submitted for admin review`)
      setTimeout(() => setNewNotification(null), 5000)
      
      await loadOrders()
    } catch (error: any) {
      console.error('Error submitting cancellation request:', error)
      setCancellationError(error.message || 'Failed to submit cancellation request. Please try again.')
    } finally {
      setSubmittingRequest(false)
    }
  }

  const openCancelModal = async (orderId: number) => {
    setSelectedOrderId(orderId)
    setCancellationReason('')
    setCustomReason('')
    setCancellationError(null)
    setExistingRequest(null)
    
    // Check if there's already a pending request
    const { data: existing } = await supabase
      .from('cancellation_requests')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .maybeSingle()
    
    if (existing) {
      setExistingRequest(existing)
    }
    
    setCancelModalOpen(true)
  }

  const closeCancelModal = () => {
    setCancelModalOpen(false)
    setSelectedOrderId(null)
    setCancellationReason('')
    setCustomReason('')
    setCancellationError(null)
    setExistingRequest(null)
  }

  // Check if an order can be requested for cancellation
  const canRequestCancellation = (orderStatus: string) => {
    return CANCELLABLE_STATUSES.includes(orderStatus) && orderStatus !== 'cancelled'
  }

  // Get cancellation request status badge
  const getRequestStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">Pending Review</span>
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Approved - Cancelled</span>
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">Rejected</span>
      default:
        return null
    }
  }

  // Filter and search orders
  const filteredOrders = useMemo(() => {
    let filtered = [...orders]

    if (selectedTab !== 'all') {
      filtered = filtered.filter((order) => order.order_status === selectedTab)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((order) => {
        if (order.id.toString().includes(query)) return true
        if (order.payment_method?.toLowerCase().includes(query)) return true
        
        const hasProductMatch = order.order_items?.some((item) =>
          item.product?.name?.toLowerCase().includes(query)
        )
        if (hasProductMatch) return true
        
        const statusLabel = statusStyles[order.order_status]?.label.toLowerCase() || ''
        if (statusLabel.includes(query)) return true
        
        return false
      })
    }

    if (dateRange !== 'all') {
      const now = new Date()
      const cutoffDate = new Date()
      
      switch (dateRange) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7)
          break
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1)
          break
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1)
          break
      }
      
      filtered = filtered.filter((order) => {
        const orderDate = new Date(order.created_at)
        return orderDate >= cutoffDate
      })
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'highest':
          return b.total_amount - a.total_amount
        case 'lowest':
          return a.total_amount - b.total_amount
        default:
          return 0
      }
    })

    return filtered
  }, [orders, searchQuery, selectedTab, dateRange, sortBy])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return <Clock className="h-4 w-4" />
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'processing':
        return <Package className="h-4 w-4" />
      case 'shipped':
        return <Truck className="h-4 w-4" />
      case 'delivered':
        return <CheckCircle className="h-4 w-4" />
      case 'cancelled':
        return <XCircle className="h-4 w-4" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedTab('all')
    setDateRange('all')
    setSortBy('newest')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-500">Loading your orders...</p>
        </div>
      </main>
    )
  }

  return (
    <PageSection>
      <PageContainer size="xl">
        {/* Cancellation Request Modal */}
        {cancelModalOpen && selectedOrderId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Request Cancellation</h2>
                <button
                  onClick={closeCancelModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              
              {existingRequest ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                    <div className="flex items-start gap-2">
                      <RefreshCw className="h-5 w-5 text-yellow-600 mt-0.5 animate-spin" />
                      <div>
                        <p className="font-medium text-yellow-800">Cancellation Request Pending</p>
                        <p className="text-sm text-yellow-700 mt-1">
                          You already submitted a cancellation request for this order on {formatDateTime(existingRequest.created_at)}.
                          Please wait for admin approval.
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={closeCancelModal}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium">Important:</p>
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                          <li>Cancellation requests require admin approval</li>
                          <li>If approved and paid, refund will be processed within 3-5 business days</li>
                          <li>You'll be notified once your request is reviewed</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for cancellation <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    >
                      <option value="">Select a reason</option>
                      <option value="Changed my mind">Changed my mind</option>
                      <option value="Found better price elsewhere">Found better price elsewhere</option>
                      <option value="Ordered by mistake">Ordered by mistake</option>
                      <option value="Long delivery time">Long delivery time</option>
                      <option value="Payment issue">Payment issue</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {cancellationReason === 'Other' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Please specify
                      </label>
                      <textarea
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        placeholder="Please provide more details..."
                      />
                    </div>
                  )}

                  {cancellationError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{cancellationError}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={closeCancelModal}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitCancellationRequest}
                      disabled={submittingRequest || !cancellationReason}
                      className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {submittingRequest ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Submit Request
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Notification Banner */}
        {newNotification && (
          <div className="mb-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <span>{newNotification}</span>
            </div>
            <button onClick={() => setNewNotification(null)}>
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-500 mt-1">Track and manage your orders</p>
        </div>

        {/* Search and Filter Bar */}
        <div className="space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by order ID, product name, or payment method..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition"
            >
              <Filter className="h-5 w-5" />
              <span>Filters</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {(searchQuery || selectedTab !== 'all' || dateRange !== 'all' || sortBy !== 'newest') && (
              <button
                onClick={clearFilters}
                className="px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition font-medium"
              >
                Clear All Filters
              </button>
            )}
          </div>

          {showFilters && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  >
                    <option value="all">All Time</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="year">Last Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="highest">Highest Amount</option>
                    <option value="lowest">Lowest Amount</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {statusOrder.map((tab) => {
            const count = tab === 'all' 
              ? orders.length 
              : orders.filter(o => o.order_status === tab).length
            
            const statusInfo = tab !== 'all' ? statusStyles[tab] : null
            
            return (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition flex items-center gap-2 ${
                  selectedTab === tab
                    ? 'bg-black text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-400'
                }`}
              >
                {tab === 'all' ? 'All Orders' : statusInfo?.label || tab.replace('_', ' ')}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedTab === tab 
                    ? 'bg-white/20 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            {searchQuery || selectedTab !== 'all' || dateRange !== 'all' ? (
              <>
                <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No matching orders</h2>
                <button onClick={clearFilters} className="mt-4 px-6 py-2 bg-yellow-400 text-black rounded-lg">
                  Clear Filters
                </button>
              </>
            ) : (
              <>
                <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
                <Link href="/products" className="inline-block mt-4 px-6 py-2 bg-yellow-400 text-black rounded-lg">
                  Start Shopping
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map((order) => {
              const canRequest = canRequestCancellation(order.order_status)
              const hasPendingRequest = order.cancellation_request?.status === 'pending'
              
              return (
                <div key={order.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* Order Header */}
                  <div className="border-b border-gray-100 px-6 py-4 bg-gray-50/50">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="font-bold text-lg">Order #{order.id}</h2>
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusStyles[order.order_status]?.bg} ${statusStyles[order.order_status]?.text}`}>
                            {getStatusIcon(order.order_status)}
                            {statusStyles[order.order_status]?.label}
                          </span>
                          {hasPendingRequest && getRequestStatusBadge('pending')}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            {formatDateTime(order.created_at)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <CreditCard className="h-4 w-4" />
                            {order.payment_method === 'gcash' ? 'GCash' : 
                             order.payment_method === 'cod' ? 'Cash on Delivery' : 
                             order.payment_method?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="text-left lg:text-right">
                        <p className="text-sm text-gray-500">Total Amount</p>
                        <p className="text-2xl font-bold text-yellow-600">{formatPrice(order.total_amount)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Order Body */}
                  <div className="p-6">
                    <div className="grid lg:grid-cols-3 gap-6">
                      {/* Order Items */}
                      <div className="lg:col-span-2">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Items Ordered ({order.order_items?.length || 0})
                        </h3>
                        <div className="space-y-3">
                          {order.order_items?.map((item) => (
                            <div key={item.id} className="flex justify-between items-center border-b border-gray-100 pb-3">
                              <div>
                                <p className="font-medium">{item.product?.name || 'Product'}</p>
                                <p className="text-sm text-gray-500">Qty: {item.quantity} × {formatPrice(item.price)}</p>
                              </div>
                              <p className="font-semibold">{formatPrice(item.price * item.quantity)}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="space-y-3">
                        <Link
                          href={`/order-confirmation?orderId=${order.id}`}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-black text-white py-2.5 font-medium hover:bg-gray-800 transition"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </Link>
                        
                        {canRequest && !hasPendingRequest && (
                          <button
                            onClick={() => openCancelModal(order.id)}
                            className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white text-red-600 py-2.5 font-medium hover:bg-red-50 transition"
                          >
                            <XCircle className="h-4 w-4" />
                            Request Cancellation
                          </button>
                        )}

                        {hasPendingRequest && (
                          <div className="text-center text-sm text-yellow-600 bg-yellow-50 p-2 rounded-lg">
                            <RefreshCw className="h-4 w-4 inline mr-1 animate-spin" />
                            Cancellation request pending admin approval
                          </div>
                        )}

                        {order.order_status === 'delivered' && (
                          <button className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white text-gray-700 py-2.5 font-medium hover:bg-gray-50 transition">
                            <ShoppingBag className="h-4 w-4" />
                            Reorder
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </PageContainer>
    </PageSection>
  )
}