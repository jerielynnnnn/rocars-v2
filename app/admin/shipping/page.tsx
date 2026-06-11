// app/admin/shipping/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logAdminActivity } from '@/lib/admin-activity'
import { 
  Package, 
  Truck, 
  Mail, 
  RefreshCw, 
  X, 
  Copy,
  Clock,
  MapPin,
  User
} from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'

interface OrderForShipping {
  id: number
  user_id: string
  customer_name: string
  customer_email: string
  items: Array<{
    name: string
    quantity: number
    weight: number
  }>
  total_weight: number
  shipping_address: string
  order_status: string
  tracking_number: string | null
  carrier: string | null
  shipping_label_url: string | null
  created_at: string
}

// Philippine Courier Options
const philippineCouriers = [
  { value: 'jnt', label: 'J&T Express', trackingUrl: 'https://www.jtexpress.ph/track?trackingNumber=' },
  { value: 'lbc', label: 'LBC Express', trackingUrl: 'https://www.lbcexpress.com/tracking?tracking_number=' },
  { value: '2go', label: '2GO Express', trackingUrl: 'https://www.2go.com.ph/track?trackingNumber=' },
  { value: 'ninjavan', label: 'Ninja Van', trackingUrl: 'https://www.ninjavan.co/en-ph/tracking?trackingNumber=' },
  { value: 'dhl', label: 'DHL Express', trackingUrl: 'https://www.dhl.com/ph-en/home/tracking.html?tracking-id=' },
  { value: 'fedex', label: 'FedEx Philippines', trackingUrl: 'https://www.fedex.com/fedextrack/?trknbr=' },
  { value: 'ups', label: 'UPS Philippines', trackingUrl: 'https://www.ups.com/track?tracknum=' },
  { value: 'flash', label: 'Flash Express', trackingUrl: 'https://flashexpress.ph/tracking/?trackingNumber=' },
  { value: 'xend', label: 'Xend Express', trackingUrl: 'https://xend.com.ph/track?trackingNumber=' },
  { value: 'blackarrow', label: 'Black Arrow Express', trackingUrl: 'https://blackarrow.ph/tracking?trackingNumber=' },
]

export default function AdminShippingPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderIdParam = searchParams.get('order')
  
  const [orders, setOrders] = useState<OrderForShipping[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCarrier, setSelectedCarrier] = useState<string>('jnt')
  const [generatingForOrder, setGeneratingForOrder] = useState<number | null>(null)
  const [manualTracking, setManualTracking] = useState<{ [key: number]: string }>({})
  const [showManualInput, setShowManualInput] = useState<number | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OrderForShipping | null>(null)
  const [showAddressModal, setShowAddressModal] = useState(false)

  // Fetch orders ready for shipping
  const fetchReadyOrders = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Staff authentication required')
      }

      const response = await fetch('/api/admin/shipping', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch shipping orders')
      }

      const formattedOrders = (result.orders || []) as OrderForShipping[]

      setOrders(formattedOrders)
      
      if (orderIdParam) {
        const orderExists = formattedOrders.find(o => o.id === parseInt(orderIdParam))
        if (orderExists) {
          setTimeout(() => {
            const element = document.getElementById(`order-${orderIdParam}`)
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            element?.classList.add('ring-2', 'ring-black', 'ring-offset-2')
            setTimeout(() => {
              element?.classList.remove('ring-2', 'ring-black', 'ring-offset-2')
            }, 2000)
          }, 100)
        }
      }
      
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  // Generate tracking number
  const generateTrackingNumber = (carrier: string): string => {
    const prefixes: { [key: string]: string } = {
      'jnt': 'JNT',
      'lbc': 'LBC',
      '2go': '2GO',
      'ninjavan': 'NV',
      'dhl': 'DHL',
      'fedex': 'FDX',
      'ups': 'UPS',
      'flash': 'FLASH',
      'xend': 'XEND',
      'blackarrow': 'BA'
    }
    const prefix = prefixes[carrier] || 'TRK'
    const timestamp = Date.now().toString().slice(-8)
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `${prefix}-${timestamp}-${random}`
  }

  const getTrackingUrl = (carrier: string, trackingNumber: string): string => {
    const courier = philippineCouriers.find(c => c.value === carrier)
    if (courier) {
      return `${courier.trackingUrl}${trackingNumber}`
    }
    return '#'
  }

  // Generate shipping label - FIXED with proper error handling
  const generateShippingLabel = async (orderId: number) => {
    setGeneratingForOrder(orderId)
    const order = orders.find(o => o.id === orderId)
    
    try {
      const trackingNumber = generateTrackingNumber(selectedCarrier)
      const courier = philippineCouriers.find(c => c.value === selectedCarrier)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Staff authentication required')
      }

      const response = await fetch('/api/admin/shipping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderId,
          trackingNumber,
          carrier: selectedCarrier,
          courierLabel: courier?.label,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update shipping')
      }

      await logAdminActivity({
        action: 'UPDATE_SHIPPING',
        target_type: 'order',
        target_id: orderId,
        details: { carrier: selectedCarrier, tracking_number: trackingNumber, method: 'generated' },
      })

      await fetchReadyOrders()
      
      alert(`Order #${orderId} marked as SHIPPED!\nCourier: ${courier?.label}\nTracking: ${trackingNumber}\n\nCustomer has been notified.`)
      return

      console.log('Attempting to update order:', orderId)
      console.log('Update data:', {
        tracking_number: trackingNumber,
        carrier: selectedCarrier,
        order_status: 'shipped',
        updated_at: new Date().toISOString(),
        estimated_delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      })

      // Update the order with tracking info
      const { error: updateError, data: updatedOrder } = await supabase
        .from('orders')
        .update({
          tracking_number: trackingNumber,
          carrier: selectedCarrier,
          order_status: 'shipped',
          updated_at: new Date().toISOString(),
          estimated_delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', orderId)
        .select()

      if (updateError) {
        console.error('Supabase update error details:', {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        })
        throw new Error(`Database update failed: ${updateError.message}`)
      }

      console.log('Order updated successfully:', updatedOrder)

      // Add to status history
      const { error: historyError } = await supabase
        .from('order_status_history')
        .insert({
          order_id: orderId,
          status: 'shipped',
          notes: `Shipped via ${courier?.label}. Tracking: ${trackingNumber}`,
          created_at: new Date().toISOString()
        })

      if (historyError) {
        console.warn('Could not add to status history:', historyError.message)
        // Don't throw error for history - it's not critical
      }

      // Add notification for customer
      if (order?.user_id) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: order.user_id,
            title: 'Your Order Has Shipped! 🚚',
            message: `Order #${orderId} has been shipped via ${courier?.label}. Tracking: ${trackingNumber}`,
            is_read: false,
            created_at: new Date().toISOString()
          })

        if (notifError) {
          console.warn('Could not add notification:', notifError.message)
          // Don't throw error for notification - it's not critical
        }
      }

      await logAdminActivity({
        action: 'UPDATE_SHIPPING',
        target_type: 'order',
        target_id: orderId,
        details: { carrier: selectedCarrier, tracking_number: trackingNumber, method: 'generated' },
      })

      await fetchReadyOrders()
      
      alert(`✅ Order #${orderId} marked as SHIPPED!\nCourier: ${courier?.label}\nTracking: ${trackingNumber}\n\nCustomer has been notified.`)
      
    } catch (error: any) {
      console.error('Failed to generate label - Full error:', error)
      
      // Show specific error message
      if (error?.message) {
        alert(`❌ Failed to generate tracking: ${error.message}`)
      } else {
        alert('❌ Failed to generate tracking. Please enter tracking number manually.')
      }
      
      setShowManualInput(orderId)
    } finally {
      setGeneratingForOrder(null)
    }
  }

  // Manual tracking entry
  const manualTrackingEntry = async (orderId: number) => {
    const trackingNumber = manualTracking[orderId]
    if (!trackingNumber) {
      alert('Please enter a tracking number')
      return
    }

    const order = orders.find(o => o.id === orderId)
    const courier = philippineCouriers.find(c => c.value === selectedCarrier)

    try {
      console.log('Manually updating order:', orderId, 'with tracking:', trackingNumber)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Staff authentication required')
      }

      const response = await fetch('/api/admin/shipping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderId,
          trackingNumber,
          carrier: selectedCarrier,
          courierLabel: courier?.label,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update shipping')
      }

      await logAdminActivity({
        action: 'UPDATE_SHIPPING',
        target_type: 'order',
        target_id: orderId,
        details: { carrier: selectedCarrier, tracking_number: trackingNumber, method: 'manual' },
      })

      await fetchReadyOrders()
      setShowManualInput(null)
      setManualTracking({})
      alert(`Order #${orderId} marked as SHIPPED with tracking #${trackingNumber}!`)
      return

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          tracking_number: trackingNumber,
          carrier: selectedCarrier,
          order_status: 'shipped',
          updated_at: new Date().toISOString(),
          estimated_delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', orderId)

      if (updateError) {
        console.error('Manual update error:', updateError)
        throw new Error(updateError.message)
      }

      // Add to status history
      await supabase
        .from('order_status_history')
        .insert({
          order_id: orderId,
          status: 'shipped',
          notes: `Shipped via ${courier?.label}. Tracking: ${trackingNumber}`,
          created_at: new Date().toISOString()
        })

      // Add notification
      if (order?.user_id) {
        await supabase
          .from('notifications')
          .insert({
            user_id: order.user_id,
            title: 'Your Order Has Shipped! 🚚',
            message: `Order #${orderId} has been shipped via ${courier?.label}. Tracking: ${trackingNumber}`,
            is_read: false,
            created_at: new Date().toISOString()
          })
      }

      await logAdminActivity({
        action: 'UPDATE_SHIPPING',
        target_type: 'order',
        target_id: orderId,
        details: { carrier: selectedCarrier, tracking_number: trackingNumber, method: 'manual' },
      })

      await fetchReadyOrders()
      setShowManualInput(null)
      setManualTracking({})
      alert(`✅ Order #${orderId} marked as SHIPPED with tracking #${trackingNumber}!`)
      
    } catch (error: any) {
      console.error('Error saving tracking number:', error)
      alert(`Failed to save tracking number: ${error?.message || 'Unknown error'}`)
    }
  }

  const copyTrackingNumber = (trackingNumber: string) => {
    navigator.clipboard.writeText(trackingNumber)
    alert('Tracking number copied to clipboard!')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  useEffect(() => {
    fetchReadyOrders()

    const subscription = supabase
      .channel('shipping-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => {
          fetchReadyOrders()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

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
          <h1 className="text-3xl font-bold text-black">Shipping</h1>
          <p className="text-gray-500 text-sm mt-1">Generate tracking numbers and ship orders</p>
        </div>
        <div className="flex gap-3">
          <select 
            value={selectedCarrier}
            onChange={(e) => setSelectedCarrier(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black bg-white"
          >
            {philippineCouriers.map(courier => (
              <option key={courier.value} value={courier.value}>{courier.label}</option>
            ))}
          </select>
          
          <button
            onClick={fetchReadyOrders}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-2xl font-bold text-black">{orders.length}</p>
          <p className="text-xs text-gray-500">Ready to Ship</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-2xl font-bold text-black">
            {orders.filter(o => o.order_status === 'processing').length}
          </p>
          <p className="text-xs text-gray-500">Awaiting Label</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-2xl font-bold text-black">
            {orders.filter(o => o.tracking_number).length}
          </p>
          <p className="text-xs text-gray-500">With Tracking</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-2xl font-bold text-black">
            {orders.reduce((sum, o) => sum + o.items.length, 0)}
          </p>
          <p className="text-xs text-gray-500">Total Items</p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No orders ready for shipping</p>
            <p className="text-sm text-gray-400 mt-1">Orders will appear here when marked as &quot;processing&quot;</p>
            <button
              onClick={() => router.push('/admin/orders')}
              className="mt-4 px-4 py-2 rounded-xl bg-black text-white text-sm hover:bg-gray-800 transition"
            >
              Go to Orders
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Order ID</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Customer</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Items</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Weight</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Tracking #</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <tr key={order.id} id={`order-${order.id}`} className="hover:bg-gray-50 transition">
                      <td className="p-4">
                        <span className="font-mono text-sm text-black">#{order.id}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-700">{order.customer_name}</div>
                            <div className="text-xs text-gray-400">{order.customer_email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            setSelectedOrder(order)
                            setShowAddressModal(true)
                          }}
                          className="text-sm text-gray-600 hover:text-black underline"
                        >
                          {order.items.length} item(s)
                        </button>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-gray-600">{order.total_weight} kg</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          order.order_status === 'processing' 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {order.order_status === 'processing' ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <Truck className="w-3 h-3" />
                          )}
                          {order.order_status === 'processing' ? 'Processing' : 'Shipped'}
                        </span>
                       </td>
                      <td className="p-4">
                        {order.tracking_number ? (
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {order.tracking_number}
                            </code>
                            <button
                              onClick={() => copyTrackingNumber(order.tracking_number!)}
                              className="text-gray-400 hover:text-black transition"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Not generated</span>
                        )}
                       </td>
                      <td className="p-4">
                        {!order.tracking_number ? (
                          showManualInput === order.id ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Enter tracking #"
                                value={manualTracking[order.id] || ''}
                                onChange={(e) => setManualTracking({ ...manualTracking, [order.id]: e.target.value })}
                                className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-black"
                                autoFocus
                              />
                              <button
                                onClick={() => manualTrackingEntry(order.id)}
                                className="px-2 py-1 bg-black text-white rounded-lg text-sm hover:bg-gray-800"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setShowManualInput(null)}
                                className="px-2 py-1 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => generateShippingLabel(order.id)}
                              disabled={generatingForOrder === order.id}
                              className="flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-lg text-sm disabled:opacity-50 hover:bg-gray-800 transition"
                            >
                              {generatingForOrder === order.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Truck className="w-4 h-4" />
                              )}
                              Generate
                            </button>
                          )
                        ) : (
                          <div className="flex gap-2">
                            <a 
                              href={getTrackingUrl(order.carrier || selectedCarrier, order.tracking_number)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 text-sm hover:underline"
                            >
                              Track
                            </a>
                            <button
                              onClick={async () => {
                                if (order.user_id) {
                                  try {
                                    await supabase
                                      .from('notifications')
                                      .insert({
                                        user_id: order.user_id,
                                        title: 'Tracking Update',
                                        message: `Track your order #${order.id}: ${getTrackingUrl(order.carrier || selectedCarrier, order.tracking_number!)}`,
                                        is_read: false,
                                          created_at: new Date().toISOString()
                                        })
                                    await logAdminActivity({
                                      action: 'SEND_TRACKING_NOTIFICATION',
                                      target_type: 'order',
                                      target_id: order.id,
                                      details: { tracking_number: order.tracking_number },
                                    })
                                    alert('Tracking link sent to customer!')
                                  } catch (err) {
                                    alert('Could not send notification. Customer may need to check their email.')
                                  }
                                }
                              }}
                              className="text-gray-500 text-sm hover:text-black"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-500">
                {orders.length} order(s) ready for shipment
              </p>
            </div>
          </>
        )}
      </div>

      {/* Order Details Modal */}
      {showAddressModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-black">Order #{selectedOrder.id}</h2>
              <button
                onClick={() => setShowAddressModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-black mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="text-sm text-black font-medium">{selectedOrder.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm text-black">{selectedOrder.customer_email}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-black mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Shipping Address
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {selectedOrder.shipping_address}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-black mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Order Items
                </h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-black">{item.name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity} · {item.weight} kg each</p>
                      </div>
                      <p className="text-sm text-gray-600">{item.quantity} item(s)</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-black mb-3">Shipping Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Order Date</span>
                    <span className="text-gray-700">{formatDate(selectedOrder.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Weight</span>
                    <span className="text-gray-700">{selectedOrder.total_weight} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className="text-gray-700 capitalize">{selectedOrder.order_status}</span>
                  </div>
                  {selectedOrder.tracking_number && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tracking Number</span>
                      <code className="text-xs bg-white px-2 py-1 rounded">{selectedOrder.tracking_number}</code>
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
