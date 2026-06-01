// app/admin/orders/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  DollarSign,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Download,
  ArrowRight
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
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setOrders(data || [])
      
      // Calculate stats
      const statsData = {
        total: data?.length || 0,
        pending: data?.filter((o: Order) => o.order_status === 'pending' || o.order_status === 'pending_payment').length || 0,
        processing: data?.filter((o: Order) => o.order_status === 'processing').length || 0,
        shipped: data?.filter((o: Order) => o.order_status === 'shipped').length || 0,
        delivered: data?.filter((o: Order) => o.order_status === 'delivered').length || 0,
        cancelled: data?.filter((o: Order) => o.order_status === 'cancelled').length || 0
      }
      setStats(statsData)
    } catch (error: any) {
      console.error('Error fetching orders:', error)
      setErrorMessage(error.message || 'Failed to fetch orders')
    } finally {
      setLoading(false)
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
      // Fetch order items with product details
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          products (
            name,
            sku,
            brand
          )
        `)
        .eq('order_id', order.id)
      
      if (itemsError) throw itemsError
      setOrderItems(items || [])
      
      // Fetch address
      if (order.address_id) {
        const { data: address, error: addressError } = await supabase
          .from('addresses')
          .select('*')
          .eq('id', order.address_id)
          .single()
        
        if (!addressError) {
          setOrderAddress(address)
        }
      }
      
      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, username, email, phone_number')
        .eq('id', order.user_id)
        .single()
      
      if (!profileError) {
        setOrderProfile(profile)
      }
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
      // First, check if user is admin
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Check admin status
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required')
      }

      // Prepare update data
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
      
      console.log('Updating order:', orderId, 'with data:', updateData)
      
      // Update order status
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
      
      if (updateError) {
        console.error('Update error details:', updateError)
        throw new Error(`Failed to update order: ${updateError.message}`)
      }
      
      // Add status history (if table exists)
      try {
        await supabase
          .from('order_status_history')
          .insert({
            order_id: orderId,
            status: newStatus,
            notes: `Order status updated to ${newStatus} by admin`,
            created_at: new Date().toISOString()
          })
      } catch (historyErr) {
        console.warn('Status history table might not exist:', historyErr)
      }
      
      // Get the user_id for this order
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('user_id')
        .eq('id', orderId)
        .single()
      
      if (fetchError) {
        console.warn('Could not fetch order user:', fetchError)
      } else if (orderData) {
        // Add notification for user (if table exists)
        try {
          await supabase
            .from('notifications')
            .insert({
              user_id: orderData.user_id,
              title: 'Order Status Updated',
              message: `Your order #${orderId} status has been updated to ${newStatus.replace('_', ' ')}.`,
              is_read: false,
              created_at: new Date().toISOString()
            })
        } catch (notifErr) {
          console.warn('Notifications table might not exist:', notifErr)
        }
      }
      
      // Refresh orders list
      await fetchOrders()
      
      // Update selected order if modal is open for this order
      if (selectedOrder && selectedOrder.id === orderId) {
        const { data: updatedOrder } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single()
        
        if (updatedOrder) {
          setSelectedOrder(updatedOrder)
        }
      }
      
      setSuccessMessage(`Order #${orderId} status updated to ${newStatus.replace('_', ' ')}`)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
      
    } catch (error: any) {
      console.error('Error updating order status:', error)
      setErrorMessage(error.message || 'Failed to update order status. Please try again.')
      
      // Clear error message after 5 seconds
      setTimeout(() => setErrorMessage(null), 5000)
    } finally {
      setUpdatingStatus(false)
    }
  }

  // NEW FUNCTION: Mark order as ready for shipping and go to shipping page
  const markReadyForShipping = async (orderId: number) => {
    setUpdatingStatus(true)
    setErrorMessage(null)
    
    try {
      // Update order status to 'processing' (ready for shipping)
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          order_status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
      
      if (updateError) throw updateError
      
      // Add to status history
      try {
        await supabase
          .from('order_status_history')
          .insert({
            order_id: orderId,
            status: 'processing',
            notes: 'Order marked as ready for shipping',
            created_at: new Date().toISOString()
          })
      } catch (historyErr) {
        console.warn('History error:', historyErr)
      }
      
      setSuccessMessage(`Order #${orderId} is now ready for shipping! Redirecting...`)
      
      // Refresh orders list
      await fetchOrders()
      
      // Close modal if open
      setShowModal(false)
      
      // Redirect to shipping page with this order highlighted
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

  // Pagination
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
          onClick={fetchOrders}
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
                {updatingStatus && (
                  <div className="mt-3 text-sm text-gray-500 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                    Updating status...
                  </div>
                )}
              </div>

              {/* NEW: Shipping Actions - Mark as Ready for Shipping */}
              {selectedOrder.order_status === 'pending_payment' && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Ready to Ship?
                  </h3>
                  <p className="text-sm text-blue-700 mb-3">
                    Once payment is confirmed, mark this order as ready for shipping. 
                    You'll be redirected to the shipping page to generate a tracking number.
                  </p>
                  <button
                    onClick={() => markReadyForShipping(selectedOrder.id)}
                    disabled={updatingStatus}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {updatingStatus ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Mark as Ready for Shipping
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* NEW: Already in Shipping - Show tracking if exists */}
              {selectedOrder.order_status === 'processing' && (
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                  <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Ready for Shipping
                  </h3>
                  <p className="text-sm text-purple-700 mb-3">
                    This order is ready to ship. Go to the shipping page to generate a tracking number.
                  </p>
                  <button
                    onClick={() => {
                      setShowModal(false)
                      router.push(`/admin/shipping?order=${selectedOrder.id}`)
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
                  >
                    Go to Shipping Page
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* NEW: Shipped Order - Show tracking info */}
              {selectedOrder.order_status === 'shipped' && selectedOrder.tracking_number && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Shipping Information
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-green-600">Tracking Number</p>
                      <code className="text-sm font-mono bg-white px-2 py-1 rounded border border-green-200">
                        {selectedOrder.tracking_number}
                      </code>
                    </div>
                    {selectedOrder.estimated_delivery_date && (
                      <div>
                        <p className="text-xs text-green-600">Estimated Delivery</p>
                        <p className="text-sm text-green-800">
                          {new Date(selectedOrder.estimated_delivery_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-green-600 mt-2">
                      Customer has been notified via email with tracking link
                    </p>
                  </div>
                </div>
              )}

              {/* Current Status Display */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">Current Status</h3>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedOrder.order_status)}
                </div>
              </div>

              {/* Customer Information */}
              {orderProfile && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="font-semibold text-black mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Customer Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Name</p>
                      <p className="text-sm text-black font-medium">
                        {orderProfile.first_name} {orderProfile.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm text-black flex items-center gap-1">
                        <Mail className="w-3 h-3 text-gray-400" />
                        {orderProfile.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="text-sm text-black flex items-center gap-1">
                        <Phone className="w-3 h-3 text-gray-400" />
                        {orderProfile.phone_number || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Username</p>
                      <p className="text-sm text-black">@{orderProfile.username}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Shipping Address */}
              {orderAddress && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="font-semibold text-black mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Shipping Address
                  </h3>
                  <p className="text-sm text-gray-700">
                    {orderAddress.recipient_first_name} {orderAddress.recipient_last_name}<br />
                    {orderAddress.street_address}, {orderAddress.barangay}<br />
                    {orderAddress.city}, {orderAddress.province} {orderAddress.zip_code}<br />
                    📞 {orderAddress.phone_number}
                  </p>
                </div>
              )}

              {/* Order Items */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-black mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Order Items
                </h3>
                <div className="space-y-3">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-black">{item.products?.name || `Product #${item.product_id}`}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity} × {formatPrice(item.price)}</p>
                      </div>
                      <p className="text-sm font-semibold text-black">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-black mb-3">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span>{formatPrice(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Shipping Fee</span>
                    <span>{selectedOrder.free_shipping ? 'Free' : formatPrice(selectedOrder.shipping_fee)}</span>
                  </div>
                  {selectedOrder.voucher_discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Voucher Discount</span>
                      <span>-{formatPrice(selectedOrder.voucher_discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span>{formatPrice(selectedOrder.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Order Timeline */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-black mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Order Timeline
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created</span>
                    <span className="text-gray-700">{formatDate(selectedOrder.created_at)}</span>
                  </div>
                  {selectedOrder.delivered_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Delivered</span>
                      <span className="text-green-600">{formatDate(selectedOrder.delivered_at)}</span>
                    </div>
                  )}
                  {selectedOrder.cancelled_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cancelled</span>
                      <span className="text-red-600">{formatDate(selectedOrder.cancelled_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}