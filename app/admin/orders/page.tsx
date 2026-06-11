// app/admin/orders/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { isAdminLikeRole } from '@/lib/admin-role'
import { logAdminActivity } from '@/lib/admin-activity'
import {
  Package,
  Search,
  Filter,
  Eye,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  User,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ArrowRight,
  MessageSquare,
} from 'lucide-react'

interface Order {
  id: number
  user_id: string
  address_id: number
  order_status: string
  payment_status: string
  subtotal: number
  shipping_fee: number
  total_amount: number
  payment_method: string
  notes: string | null
  created_at: string
  tracking_number: string | null
  estimated_delivery_date: string | null
  delivered_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  voucher_code: string | null
  voucher_discount: number
  free_shipping: boolean
}

interface OrderItem {
  id: number
  order_id: number
  product_id: number
  quantity: number
  price: number
  products?: {
    name: string
    sku: string
    brand: string
  }
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
}

interface Profile {
  id: string
  first_name: string
  last_name: string
  username: string
  email: string
  phone_number: string | null
}

interface CancellationRequest {
  id: number
  order_id: number
  user_id: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
  processed_at: string | null
  processed_by: string | null
  orders?: {
    id: number
    total_amount: number
    payment_status: string
    order_status: string
    user_id: string
  }
  profiles?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
}

type OrderStatus = 'pending_payment' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'

const statusColors: Record<OrderStatus, { bg: string; text: string; border: string }> = {
  pending_payment: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  pending: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  processing: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  shipped: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  delivered: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  refunded: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
}

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' }
]

export default function AdminOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [orderAddress, setOrderAddress] = useState<Address | null>(null)
  const [orderProfile, setOrderProfile] = useState<Profile | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0
  })

  // Cancellation Requests State
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequest[]>([])
  const [showCancellationModal, setShowCancellationModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<CancellationRequest | null>(null)
  const [processingRequest, setProcessingRequest] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')

  const itemsPerPage = 10

  useEffect(() => {
    fetchOrders()
  }, [])

  useEffect(() => {
    filterOrders()
  }, [orders, searchQuery, statusFilter])

  const fetchOrders = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Staff authentication required')
      }

      const response = await fetch('/api/admin/orders', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch orders')
      }

      const fetchedOrders = (result.orders || []) as Order[]

      setOrders(fetchedOrders)
      setCancellationRequests(result.cancellationRequests || [])
      
      const statsData = {
        total: fetchedOrders.length,
        pending: fetchedOrders.filter((o) => o.order_status === 'pending' || o.order_status === 'pending_payment').length,
        processing: fetchedOrders.filter((o) => o.order_status === 'processing').length,
        shipped: fetchedOrders.filter((o) => o.order_status === 'shipped').length,
        delivered: fetchedOrders.filter((o) => o.order_status === 'delivered').length,
        cancelled: fetchedOrders.filter((o) => o.order_status === 'cancelled').length
      }
      setStats(statsData)
    } catch (error: any) {
      console.error('Error fetching orders:', error)
      setErrorMessage(error.message || 'Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }

const processCancellationRequest = async (
  requestId: number,
  action: 'approve' | 'reject'
) => {
  setProcessingRequest(true)
  setErrorMessage(null)
  setSuccessMessage(null)

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('Admin authentication required')
    }

    const response = await fetch('/api/admin/process-cancellation-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        requestId,
        action,
        adminNotes: adminNotes || null,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(
        result.details?.message ||
        result.error ||
        'Failed to process cancellation request'
      )
    }

    await logAdminActivity({
      action: action === 'approve' ? 'APPROVE_CANCELLATION_REQUEST' : 'REJECT_CANCELLATION_REQUEST',
      target_type: 'cancellation_request',
      target_id: requestId,
      details: { admin_notes: adminNotes || null },
    })

    await fetchOrders()

    setShowCancellationModal(false)
    setSelectedRequest(null)
    setAdminNotes('')
    setSuccessMessage(
      action === 'approve' && result.refundId
        ? `Request approved. Refund request #${result.refundId} was created for processing.`
        : `Request ${action === 'approve' ? 'approved' : 'rejected'} successfully`
    )
    setTimeout(() => setSuccessMessage(null), 3000)
  } catch (error: any) {
    console.error(error)
    setErrorMessage(error.message || 'Failed to process cancellation request')
  } finally {
    setProcessingRequest(false)
  }
}

  const filterOrders = () => {
    let filtered = [...orders]
    
    if (searchQuery) {
      filtered = filtered.filter(order => 
        order.id.toString().includes(searchQuery) ||
        order.user_id.includes(searchQuery)
      )
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.order_status === statusFilter)
    }
    
    setFilteredOrders(filtered)
    setCurrentPage(1)
  }

  const fetchOrderDetails = async (order: Order) => {
    setSelectedOrder(order)
    setShowModal(true)
    setErrorMessage(null)
    
    try {
      setOrderItems([])
      setOrderAddress(null)
      setOrderProfile(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Staff authentication required')
      }

      const response = await fetch(`/api/admin/orders?orderId=${order.id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch order details')
      }

      setSelectedOrder(result.order || order)
      setOrderItems(result.items || [])
      setOrderAddress(result.address || null)
      setOrderProfile(result.profile || null)
    } catch (error: any) {
      console.error('Error fetching order details:', error)
      setErrorMessage(error.message || 'Failed to fetch order details')
    }
  }

  const updateOrderStatus = async (orderId: number, newStatus: OrderStatus) => {
    setUpdatingStatus(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!isAdminLikeRole(profile?.role)) {
        throw new Error('Unauthorized: Staff access required')
      }

      const updateData: any = { 
        order_status: newStatus,
        updated_at: new Date().toISOString()
      }
      
      if (newStatus === 'delivered') {
        updateData.delivered_at = new Date().toISOString()
      }
      if (newStatus === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString()
      }
      
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
      
      if (updateError) throw new Error(`Failed to update order: ${updateError.message}`)
      
      const { data: orderData } = await supabase
        .from('orders')
        .select('user_id')
        .eq('id', orderId)
        .single()
      
      if (orderData) {
        await supabase
          .from('notifications')
          .insert({
            user_id: orderData.user_id,
            title: 'Order Status Updated',
            message: `Your order #${orderId} status has been updated to ${newStatus.replace('_', ' ')}.`,
            is_read: false,
            created_at: new Date().toISOString()
          })
      }

      await logAdminActivity({
        action: 'UPDATE_ORDER_STATUS',
        target_type: 'order',
        target_id: orderId,
        details: { order_status: newStatus },
      })
      
      await fetchOrders()
      
      if (selectedOrder && selectedOrder.id === orderId) {
        const { data: updatedOrder } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single()
        
        if (updatedOrder) setSelectedOrder(updatedOrder)
      }
      
      setSuccessMessage(`Order #${orderId} status updated to ${newStatus.replace('_', ' ')}`)
      setTimeout(() => setSuccessMessage(null), 3000)
      
    } catch (error: any) {
      console.error('Error updating order status:', error)
      setErrorMessage(error.message || 'Failed to update order status')
      setTimeout(() => setErrorMessage(null), 5000)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const markReadyForShipping = async (orderId: number) => {
    setUpdatingStatus(true)
    setErrorMessage(null)
    
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          order_status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
      
      if (updateError) throw updateError

      await logAdminActivity({
        action: 'MARK_ORDER_READY_FOR_SHIPPING',
        target_type: 'order',
        target_id: orderId,
        details: { order_status: 'processing' },
      })
      
      setSuccessMessage(`Order #${orderId} is now ready for shipping! Redirecting...`)
      await fetchOrders()
      setShowModal(false)
      
      setTimeout(() => {
        router.push(`/admin/shipping?order=${orderId}`)
      }, 1500)
      
    } catch (error: any) {
      console.error('Error marking order for shipping:', error)
      setErrorMessage(error.message || 'Failed to mark order for shipping')
      setTimeout(() => setErrorMessage(null), 5000)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(price)
  }

  const getStatusBadge = (status: string) => {
    const colors = statusColors[status as OrderStatus] || statusColors.pending
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
        {status === 'pending_payment' && <Clock className="w-3 h-3" />}
        {status === 'processing' && <Package className="w-3 h-3" />}
        {status === 'shipped' && <Truck className="w-3 h-3" />}
        {status === 'delivered' && <CheckCircle className="w-3 h-3" />}
        {status === 'cancelled' && <XCircle className="w-3 h-3" />}
        {status === 'pending' && <Clock className="w-3 h-3" />}
        {status === 'refunded' && <RefreshCw className="w-3 h-3" />}
        {status.replace('_', ' ')}
      </span>
    )
  }

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-black">Orders</h1>
          <p className="text-gray-500 text-sm mt-1">Manage and track customer orders</p>
        </div>
        <button
          onClick={() => {
            fetchOrders()
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-700 text-sm">{errorMessage}</p>
          <button 
            onClick={() => setErrorMessage(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-700 text-sm">{successMessage}</p>
          <button 
            onClick={() => setSuccessMessage(null)}
            className="ml-auto text-green-600 hover:text-green-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pending Cancellation Requests Section */}
      {cancellationRequests.length > 0 && (
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 overflow-hidden">
          <div className="bg-yellow-100 px-6 py-4 border-b border-yellow-200">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-yellow-700" />
              <h2 className="font-semibold text-yellow-800">Pending Cancellation Requests</h2>
              <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-medium">
                {cancellationRequests.length}
              </span>
            </div>
          </div>
          <div className="divide-y divide-yellow-100">
            {cancellationRequests.map((request) => (
              <div key={request.id} className="p-4 hover:bg-yellow-100/50 transition">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm font-semibold bg-white px-2 py-0.5 rounded">
                        Order #{request.order_id}
                      </span>
                      <span className="text-xs text-yellow-600">
                        Requested: {new Date(request.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Reason:</span> {request.reason}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Amount: {formatPrice(request.orders?.total_amount || 0)}</span>
                      <span className={`px-2 py-0.5 rounded-full ${
                        request.orders?.payment_status === 'paid' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {request.orders?.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                      {request.orders?.payment_status === 'paid' && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Refund needed if approved
                        </span>
                      )}
                      <span>Customer: {request.profiles?.first_name} {request.profiles?.last_name}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedRequest(request)
                      setAdminNotes('')
                      setShowCancellationModal(true)
                    }}
                    className="ml-4 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Review Request
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-2xl font-bold text-black">{stats.total}</p>
          <p className="text-xs text-gray-500">Total Orders</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
          <p className="text-xs text-yellow-600">Pending</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-2xl font-bold text-blue-700">{stats.processing}</p>
          <p className="text-xs text-blue-600">Processing</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
          <p className="text-2xl font-bold text-purple-700">{stats.shipped}</p>
          <p className="text-xs text-purple-600">Shipped</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-2xl font-bold text-green-700">{stats.delivered}</p>
          <p className="text-xs text-green-600">Delivered</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-2xl font-bold text-red-700">{stats.cancelled}</p>
          <p className="text-xs text-red-600">Cancelled</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Order ID or Customer ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-11 pr-8 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition appearance-none"
          >
            <option value="all">All Status</option>
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No orders found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Order ID</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Customer</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Date</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Total</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Payment</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition">
                      <td className="p-4">
                        <span className="font-mono text-sm text-black">#{order.id}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{order.user_id.slice(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-black">{formatPrice(order.total_amount)}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-gray-400" />
                          <span className="text-sm text-gray-600 capitalize">
                            {order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(order.order_status)}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => fetchOrderDetails(order)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-black transition text-sm"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Order Details Modal */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-black">Order #{selectedOrder.id}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 transition"
              >
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Status Update */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-black mb-3">Update Order Status</h3>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => updateOrderStatus(selectedOrder.id, option.value)}
                      disabled={updatingStatus}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        selectedOrder.order_status === option.value
                          ? 'bg-black text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-black hover:bg-gray-50'
                      } ${updatingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Information */}
              {orderProfile && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="font-semibold text-black mb-3">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Name</p>
                      <p className="text-sm font-medium">{orderProfile.first_name} {orderProfile.last_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm">{orderProfile.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="text-sm">{orderProfile.phone_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Username</p>
                      <p className="text-sm">@{orderProfile.username}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-black mb-3">Order Items</h3>
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium">{item.products?.name || `Product #${item.product_id}`}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity} × {formatPrice(item.price)}</p>
                      </div>
                      <p className="font-semibold">{formatPrice(item.quantity * item.price)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-black mb-3">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatPrice(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>{selectedOrder.free_shipping ? 'Free' : formatPrice(selectedOrder.shipping_fee)}</span>
                  </div>
                  {selectedOrder.voucher_discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatPrice(selectedOrder.voucher_discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Total</span>
                    <span>{formatPrice(selectedOrder.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Cancellation Request Modal */}
      {showCancellationModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-black">Review Cancellation Request</h2>
              <button
                onClick={() => {
                  setShowCancellationModal(false)
                  setSelectedRequest(null)
                  setAdminNotes('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Order #</span>
                  <span className="font-mono font-medium">{selectedRequest.order_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Customer</span>
                  <span>{selectedRequest.profiles?.first_name} {selectedRequest.profiles?.last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Amount</span>
                  <span className="font-semibold">{formatPrice(selectedRequest.orders?.total_amount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Payment Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    selectedRequest.orders?.payment_status === 'paid' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {selectedRequest.orders?.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                  </span>
                </div>
                {selectedRequest.orders?.payment_status === 'paid' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    This order is already paid. Approving the cancellation will create a pending refund request for the refund team.
                  </div>
                )}
                <div className="pt-2 border-t">
                  <p className="text-sm text-gray-500 mb-1">Cancellation Reason</p>
                  <p className="text-sm bg-white p-2 rounded border">{selectedRequest.reason}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes (optional)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Add notes for the customer..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCancellationModal(false)
                    setSelectedRequest(null)
                    setAdminNotes('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => processCancellationRequest(selectedRequest.id, 'reject')}
                  disabled={processingRequest}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => processCancellationRequest(selectedRequest.id, 'approve')}
                  disabled={processingRequest}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {selectedRequest.orders?.payment_status === 'paid' ? 'Approve & Start Refund' : 'Approve & Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
