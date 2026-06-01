'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Package, Truck, CheckCircle, Clock, MapPin, 
  Calendar, ArrowLeft, RefreshCw
} from 'lucide-react'

interface TrackingEvent {
  status: string
  location: string
  timestamp: string
  description: string
}

export default function TrackOrderPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchOrderDetails()
  }, [orderId])

  const fetchOrderDetails = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (name, product_images (image_url))
          ),
          address:addresses (*)
        `)
        .eq('id', orderId)
        .single()

      if (error) throw error
      setOrder(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getTrackingEvents = (status: string): TrackingEvent[] => {
    const events: TrackingEvent[] = [
      {
        status: 'Order Placed',
        location: 'Online',
        timestamp: order?.created_at,
        description: 'Your order has been confirmed'
      }
    ]

    if (status === 'processing' || status === 'shipped' || status === 'delivered') {
      events.push({
        status: 'Processing',
        location: 'Warehouse',
        timestamp: order?.created_at,
        description: 'Your order is being prepared'
      })
    }

    if (status === 'shipped' || status === 'delivered') {
      events.push({
        status: 'Shipped',
        location: 'Sorting Facility',
        timestamp: order?.created_at,
        description: 'Your order has been shipped'
      })
    }

    if (status === 'delivered') {
      events.push({
        status: 'Delivered',
        location: order?.address?.city,
        timestamp: order?.created_at,
        description: 'Your order has been delivered'
      })
    }

    return events
  }

  const getStatusIcon = (status: string, currentStatus: string) => {
    const statusMap: Record<string, any> = {
      'Order Placed': Clock,
      'Processing': Package,
      'Shipped': Truck,
      'Delivered': CheckCircle
    }
    const Icon = statusMap[status]
    const isCompleted = getStatusIndex(status) <= getStatusIndex(currentStatus)
    
    return (
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
        isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
      }`}>
        <Icon className="w-5 h-5" />
      </div>
    )
  }

  const getStatusIndex = (status: string) => {
    const orderMap: Record<string, number> = {
      'Order Placed': 0,
      'Processing': 1,
      'Shipped': 2,
      'Delivered': 3
    }
    return orderMap[status] || 0
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Processing...'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">
            {error || 'Order not found'}
          </div>
        </div>
      </div>
    )
  }

  const trackingEvents = getTrackingEvents(order.order_status)
  const currentStatus = order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-black mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Orders
        </button>

        {/* Order Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold">Track Your Order</h1>
              <p className="text-gray-600">Order #{order.id}</p>
            </div>
            <button
              onClick={fetchOrderDetails}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Order Date</p>
                <p className="font-medium">{formatDate(order.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Delivery Address</p>
                <p className="font-medium">
                  {order.address?.street}, {order.address?.city}, {order.address?.province}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tracking Timeline */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-6">Order Status Timeline</h2>
          <div className="relative">
            {trackingEvents.map((event, index) => {
              const isLast = index === trackingEvents.length - 1
              const isCompleted = getStatusIndex(event.status) <= getStatusIndex(currentStatus)
              
              return (
                <div key={index} className="flex gap-4 mb-8 relative">
                  {/* Line connector */}
                  {!isLast && (
                    <div className={`absolute left-5 top-10 w-0.5 h-12 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                  
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {getStatusIcon(event.status, currentStatus)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{event.status}</h3>
                        <p className="text-sm text-gray-600">{event.description}</p>
                        {event.location && (
                          <p className="text-xs text-gray-500 mt-1">Location: {event.location}</p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{formatDate(event.timestamp)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
          <div className="space-y-3">
            {order.order_items?.map((item: any) => (
              <div key={item.id} className="flex gap-4 py-3 border-b border-gray-100">
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={item.product?.product_images?.[0]?.image_url || '/placeholder-product.jpg'}
                    alt={item.product?.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{item.product?.name}</p>
                  <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                  <p className="text-sm font-medium">
                    {new Intl.NumberFormat('en-PH', {
                      style: 'currency',
                      currency: 'PHP'
                    }).format(item.price)}
                  </p>
                </div>
              </div>
            ))}
            
            <div className="pt-3">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>
                  {new Intl.NumberFormat('en-PH', {
                    style: 'currency',
                    currency: 'PHP'
                  }).format(order.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Shipping Fee</span>
                <span>
                  {new Intl.NumberFormat('en-PH', {
                    style: 'currency',
                    currency: 'PHP'
                  }).format(order.shipping_fee)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t">
                <span>Total</span>
                <span>
                  {new Intl.NumberFormat('en-PH', {
                    style: 'currency',
                    currency: 'PHP'
                  }).format(order.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}