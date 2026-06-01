// app/orders/page.tsx (User Orders Page)
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

type Order = {
  id: number
  order_status: string
  payment_status: string
  total_amount: number
  payment_method: string
  created_at: string
  tracking_number: string | null
  estimated_delivery_date: string | null
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
      // Cleanup channels
      if (ordersChannel) {
        supabase.removeChannel(ordersChannel)
      }
      if (notificationsChannel) {
        supabase.removeChannel(notificationsChannel)
      }
    }
  }, [])

  const setupRealtimeSubscription = async () => {
    // Get session first
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) return null

    // Create channels
    const ordersChannel = supabase.channel('orders-changes')
    const notificationsChannel = supabase.channel('notifications-changes')

    // Set up event listeners for orders channel BEFORE subscribing
    ordersChannel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${session.user.id}`,
      },
      (payload) => {
        // Update the order in the local state
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === payload.new.id 
              ? { ...order, ...payload.new }
              : order
          )
        )
        
        // Show notification for status change
        const newStatus = payload.new.order_status
        const oldStatus = payload.old?.order_status
        
        if (newStatus !== oldStatus) {
          setNewNotification(`Order #${payload.new.id} status updated to ${statusStyles[newStatus]?.label || newStatus}`)
          setTimeout(() => setNewNotification(null), 5000)
        }
      }
    )

    // Set up event listeners for notifications channel BEFORE subscribing
    notificationsChannel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${session.user.id}`,
      },
      (payload) => {
        // Show notification popup
        setNewNotification(payload.new.message)
        setTimeout(() => setNewNotification(null), 5000)
      }
    )

    // NOW subscribe to both channels after setting up listeners
    ordersChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Orders channel subscribed successfully')
      }
    })

    notificationsChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Notifications channel subscribed successfully')
      }
    })

    return { ordersChannel, notificationsChannel }
  }

  const loadOrders = async () => {
    try {
      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login?redirect=/orders')
        return
      }

      const { data, error } = await supabase
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

      if (error) {
        console.error('Error loading orders:', error)
        return
      }

      setOrders((data as any) || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
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
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
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

          {/* Advanced Filters */}
          {showFilters && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
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

                <div className="flex items-end">
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-semibold text-gray-900">{filteredOrders.length}</span> of{' '}
                    <span className="font-semibold text-gray-900">{orders.length}</span> orders
                  </div>
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
                <p className="text-gray-500 mb-6">
                  We couldn't find any orders matching your filters.
                </p>
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-yellow-400 text-black font-semibold hover:bg-yellow-500 transition"
                >
                  Clear Filters
                </button>
              </>
            ) : (
              <>
                <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
                <p className="text-gray-500 mb-6">
                  You haven't placed any orders. Start shopping today!
                </p>
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-yellow-400 text-black font-semibold hover:bg-yellow-500 transition"
                >
                  Start Shopping
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Order Header */}
                <div className="border-b border-gray-100 px-6 py-4 bg-gray-50/50">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="font-bold text-lg text-gray-900">
                          Order #{order.id}
                        </h2>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                            statusStyles[order.order_status]?.bg || 'bg-gray-100'
                          } ${statusStyles[order.order_status]?.text || 'text-gray-700'}`}
                        >
                          {getStatusIcon(order.order_status)}
                          {statusStyles[order.order_status]?.label || order.order_status.replace('_', ' ')}
                        </span>
                        {order.payment_status === 'paid' && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3" />
                            Paid
                          </span>
                        )}
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
                      <p className="text-2xl font-bold text-yellow-600">
                        {formatPrice(order.total_amount)}
                      </p>
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

                      <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                        {order.order_items?.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between border border-gray-100 rounded-xl p-3 hover:bg-gray-50 transition"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Package className="h-5 w-5 text-gray-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-gray-900 text-sm truncate">
                                  {item.product?.name || 'Product'}
                                </h4>
                                <p className="text-xs text-gray-500">
                                  Qty: {item.quantity} × {formatPrice(item.price)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <p className="font-semibold text-gray-900">
                                {formatPrice(item.price * item.quantity)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Order Details Sidebar */}
                    <div className="space-y-4">
                      {/* Delivery Address */}
                      <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4" />
                          Delivery Address
                        </h3>

                        {order.addresses ? (
                          <div className="text-sm text-gray-600 space-y-1">
                            <p className="font-medium text-gray-900">
                              {order.addresses.recipient_first_name} {order.addresses.recipient_last_name}
                            </p>
                            <p>
                              {order.addresses.street_address}, {order.addresses.barangay}
                            </p>
                            <p>
                              {order.addresses.city}, {order.addresses.province}
                            </p>
                            {order.addresses.phone_number && (
                              <p className="text-xs text-gray-500 mt-1">
                                📞 {order.addresses.phone_number}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No address available</p>
                        )}
                      </div>

                      {/* Tracking Info */}
                      {order.tracking_number && (
                        <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                          <h3 className="font-semibold mb-2 text-sm">Tracking Information</h3>
                          <p className="text-sm font-mono text-gray-700">{order.tracking_number}</p>
                        </div>
                      )}

                      {/* Estimated Delivery */}
                      {order.estimated_delivery_date && (
                        <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                          <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            Estimated Delivery
                          </h3>
                          <p className="text-sm text-gray-700">
                            {new Date(order.estimated_delivery_date).toLocaleDateString('en-PH', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <Link
                          href={`/order-confirmation?orderId=${order.id}`}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-black text-white py-2.5 font-medium hover:bg-gray-800 transition text-sm"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </Link>
                        {order.order_status === 'delivered' && (
                          <button
                            onClick={() => {/* Implement reorder */}}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white text-gray-700 py-2.5 font-medium hover:bg-gray-50 transition text-sm"
                          >
                            <ShoppingBag className="h-4 w-4" />
                            Reorder
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageContainer>
    </PageSection>
  )
}