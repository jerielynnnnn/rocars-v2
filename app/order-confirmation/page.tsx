// app/order-confirmation/page.tsx
'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/context/CartContext'
import { formatDatePH, formatLongDateTimePH, formatShortDatePH } from '@/lib/time'
import PageContainer from '@/components/layout/PageContainer'
import PageSection from '@/components/layout/PageSection'
import {
  CheckCircle2,
  ArrowLeft,
  Printer,
  MapPin,
  CreditCard,
  Package,
  Smartphone,
  Truck,
  User,
  Receipt,
  Store,
  Download,
  X,
  Calendar,
  Clock,
} from 'lucide-react'

interface OrderItem {
  id: number
  product_id: number
  quantity: number
  price: number
  products: {
    name: string
    slug: string
    brand?: string
  }
}

interface Order {
  id: number
  created_at: string
  order_status: string
  payment_status: string
  subtotal: number
  shipping_fee: number
  total_amount: number
  payment_method: string
  payment_transaction_id: string | null
  voucher_discount?: number
  voucher_code?: string | null
  free_shipping?: boolean
  tracking_number: string | null
  estimated_delivery_date: string | null
  carrier: string | null
  addresses: {
    recipient_first_name: string
    recipient_last_name: string
    phone_number: string
    street_address: string
    barangay: string
    city: string
    province: string
    zip_code: string
  }
  order_items: OrderItem[]
}

function OrderConfirmationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')

  const { clearCart } = useCart()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [cartCleared, setCartCleared] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  const fetchOrder = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          addresses (
            recipient_first_name,
            recipient_last_name,
            phone_number,
            street_address,
            barangay,
            city,
            province,
            zip_code
          ),
          order_items (
            id,
            product_id,
            quantity,
            price,
            products:product_id (
              name,
              slug,
              brand
            )
          )
        `)
        .eq('id', parseInt(id))
        .single()

      if (error) throw error

      setOrder(data as Order)

      if (!cartCleared) {
        await clearCart()
        setCartCleared(true)
      }
    } catch (error) {
      console.error('ORDER FETCH ERROR:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }, [cartCleared, clearCart, router])

  useEffect(() => {
    if (!orderId) {
      router.push('/')
      return
    }

    fetchOrder(orderId)
  }, [fetchOrder, orderId, router])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const formatDate = (date: string) => {
    return formatLongDateTimePH(date)
  }

  const formatShortDate = (date: string) => {
    return formatShortDatePH(date)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadReceipt = () => {
    const receiptContent = document.getElementById('receipt-content-print')
    if (!receiptContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>ROCARS Order Receipt #${order?.id}</title>
          <style>
            body {
              font-family: Arial, Helvetica, sans-serif;
              padding: 40px;
              margin: 0;
              color: #000;
            }
            .receipt-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
            }
            .text-center { text-align: center; }
            .border-b { border-bottom: 1px solid #ddd; }
            .mb-6 { margin-bottom: 24px; }
            .pb-6 { padding-bottom: 24px; }
            .mt-2 { margin-top: 8px; }
            .mt-4 { margin-top: 16px; }
            .mb-8 { margin-bottom: 32px; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
            .gap-6 { gap: 24px; }
            .space-y-3 > * + * { margin-top: 12px; }
            .bg-gray-50 { background-color: #f9fafb; }
            .p-4 { padding: 16px; }
            .rounded-lg { border-radius: 8px; }
            .font-bold { font-weight: bold; }
            .text-sm { font-size: 14px; }
            .text-xs { font-size: 12px; }
            .text-gray-500 { color: #6b7280; }
            .text-gray-600 { color: #4b5563; }
            .text-gray-900 { color: #111827; }
            .text-green-600 { color: #059669; }
            .text-yellow-600 { color: #d97706; }
            .border { border: 1px solid #e5e7eb; }
            .overflow-hidden { overflow: hidden; }
            .w-full { width: 100%; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .p-3 { padding: 12px; }
            .bg-gray-100 { background-color: #f3f4f6; }
            .border-t { border-top: 1px solid #e5e7eb; }
            .pt-2 { padding-top: 8px; }
            .pt-6 { padding-top: 24px; }
            .mt-12 { margin-top: 48px; }
            .uppercase { text-transform: uppercase; }
            .tracking-wide { letter-spacing: 0.025em; }
            .font-mono { font-family: monospace; }
            .font-medium { font-weight: 500; }
            .font-semibold { font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            ${receiptContent.innerHTML}
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const getPaymentMethodDisplay = (method: string) => {
    switch (method) {
      case 'gcash':
        return { name: 'GCash', icon: Smartphone, color: 'text-blue-600' }
      case 'cod':
        return { name: 'Cash on Delivery', icon: Truck, color: 'text-green-600' }
      default:
        return { name: method, icon: CreditCard, color: 'text-gray-600' }
    }
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
        return <CheckCircle2 className="h-4 w-4" />
      case 'cancelled':
        return <X className="h-4 w-4" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
        <div className="h-12 w-12 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin"></div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Order not found.</p>
      </div>
    )
  }

  const paymentInfo = getPaymentMethodDisplay(order.payment_method)

  return (
    <>
      {/* PRINT STYLES */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-content-print,
          #receipt-content-print * {
            visibility: visible;
          }
          #receipt-content-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20px;
            color: black;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 8mm;
          }
        }
      `}</style>

      <PageSection>
        <PageContainer size="lg">
          {/* HEADER ACTIONS */}
          <div className="no-print flex items-center justify-between mb-6 flex-wrap gap-4">
            <Link
              href="/orders"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Orders
            </Link>

            <button
              onClick={() => setShowReceiptModal(true)}
              className="px-5 py-2.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 transition flex items-center gap-2 font-medium"
            >
              <Receipt className="h-4 w-4" />
              View Receipt
            </button>
          </div>

          {/* DELIVERY STATUS - MOVED ABOVE ORDER CONFIRMED HEADER */}
          {order.tracking_number && (
            <div className="no-print bg-white rounded-[32px] border border-gray-200 shadow-sm p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-100 rounded-full">
                  <Truck className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Delivery Status</h2>
                  <p className="text-sm text-gray-500">Track your package in real-time</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Status Progress Bar */}
                <div className="relative pt-2">
                  <div className="flex justify-between mb-2">
                    {['pending', 'processing', 'shipped', 'delivered'].map((status) => {
                      const statusOrder = ['pending', 'processing', 'shipped', 'delivered']
                      const currentIndex = statusOrder.indexOf(order.order_status)
                      const isCompleted = statusOrder.indexOf(status) <= currentIndex
                      
                      return (
                        <div key={status} className="flex flex-col items-center flex-1">
                          <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center border-2
                            ${isCompleted ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-white border-gray-300 text-gray-400'}
                          `}>
                            {status === 'pending' && <Clock className="h-5 w-5" />}
                            {status === 'processing' && <Package className="h-5 w-5" />}
                            {status === 'shipped' && <Truck className="h-5 w-5" />}
                            {status === 'delivered' && <CheckCircle2 className="h-5 w-5" />}
                          </div>
                          <span className="text-xs mt-2 font-medium capitalize">{status.replace('_', ' ')}</span>
                          {isCompleted && status !== 'delivered' && (
                            <span className="text-[10px] text-green-600 mt-0.5">Complete</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="absolute top-6 left-0 w-full h-0.5 bg-gray-200 -z-10" 
                       style={{ transform: 'translateY(-50%)' }} />
                </div>

                {/* Tracking Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tracking Number</p>
                    <p className="font-mono font-semibold text-gray-900 bg-gray-50 p-2 rounded-lg inline-block text-sm">
                      {order.tracking_number}
                    </p>
                    {order.carrier && (
                      <p className="text-xs text-gray-500 mt-1">
                        Carrier: {order.carrier}
                      </p>
                    )}
                  </div>

                  {order.estimated_delivery_date && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Estimated Delivery Date</p>
                      <p className="font-semibold text-gray-900 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {formatDatePH(order.estimated_delivery_date)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUCCESS HEADER */}
          <div className="no-print bg-white rounded-[32px] shadow-sm border border-gray-200 p-8 text-center mb-6">
            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-yellow-100">
              <CheckCircle2 className="h-12 w-12 text-yellow-500" />
            </div>

            <h1 className="text-4xl font-bold text-gray-900">
              Order Confirmed
            </h1>

            <p className="mt-3 text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Thank you for shopping with ROCARS. Your order has been placed
              successfully and is now being prepared for processing and shipment.
            </p>

            <div className="mt-6 flex justify-center gap-4">
              <Link
                href="/orders"
                className="px-6 py-3 rounded-2xl bg-yellow-400 hover:bg-yellow-300 transition font-semibold text-black"
              >
                View My Orders
              </Link>
              <Link
                href="/shop"
                className="px-6 py-3 rounded-2xl border border-gray-300 hover:bg-gray-50 transition font-semibold text-gray-700"
              >
                Continue Shopping
              </Link>
            </div>
          </div>

          {/* MAIN CONTENT (Screen View) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
            {/* LEFT SIDE */}
            <div className="lg:col-span-2 space-y-6">
              {/* ORDER ITEMS */}
              <div className="bg-white rounded-[28px] border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Package className="h-5 w-5 text-yellow-500" />
                  <h2 className="text-xl font-bold text-gray-900">
                    Order Items
                  </h2>
                </div>

                <div className="space-y-5">
                  {order.order_items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 border-b border-gray-100 pb-5 last:border-none last:pb-0"
                    >
                      <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-gray-900 text-base">
                              {item.products?.name}
                            </h3>
                            {item.products?.brand && (
                              <p className="text-sm text-gray-500 mt-1">
                                Brand: {item.products.brand}
                              </p>
                            )}
                            <p className="text-sm text-gray-500 mt-1">
                              Quantity: {item.quantity} × {formatPrice(item.price)}
                            </p>
                          </div>

                          <p className="font-bold text-gray-900 text-lg">
                            {formatPrice(item.price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SHIPPING ADDRESS */}
              <div className="bg-white rounded-[28px] border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <MapPin className="h-5 w-5 text-yellow-500" />
                  <h2 className="text-xl font-bold text-gray-900">
                    Shipping Address
                  </h2>
                </div>

                {order.addresses && (
                  <div className="text-sm text-gray-700 space-y-2 leading-relaxed">
                    <p className="font-semibold text-gray-900 text-base">
                      {order.addresses.recipient_first_name}{' '}
                      {order.addresses.recipient_last_name}
                    </p>
                    <p>{order.addresses.street_address}</p>
                    <p>
                      {order.addresses.barangay}, {order.addresses.city}
                    </p>
                    <p>
                      {order.addresses.province}, {order.addresses.zip_code}
                    </p>
                    <p>{order.addresses.phone_number}</p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="space-y-6">
              {/* ORDER DETAILS */}
              <div className="bg-white rounded-[28px] border border-gray-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-5">
                  Order Details
                </h2>

                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-gray-500">Order Number</p>
                    <p className="font-semibold text-gray-900 text-base">
                      #{order.id}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500">Order Date</p>
                    <p className="font-semibold text-gray-900">
                      {formatDate(order.created_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500 mb-2">Status</p>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold capitalize">
                      {getStatusIcon(order.order_status)}
                      <span>{order.order_status.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PAYMENT METHOD */}
              <div className="bg-white rounded-[28px] border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <paymentInfo.icon className={`h-5 w-5 ${paymentInfo.color}`} />
                  <h2 className="text-xl font-bold text-gray-900">
                    Payment Method
                  </h2>
                </div>

                <div className="text-sm text-gray-700">
                  <p className="font-semibold text-base">
                    {paymentInfo.name}
                  </p>
                  {order.payment_transaction_id && (
                    <p className="text-xs text-gray-500 mt-1">
                      Transaction ID: {order.payment_transaction_id}
                    </p>
                  )}
                </div>
              </div>

              {/* ORDER SUMMARY */}
              <div className="bg-white rounded-[28px] border border-gray-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-5">
                  Order Summary
                </h2>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Shipping Fee</span>
                    <span>
                      {order.shipping_fee === 0
                        ? 'Free'
                        : formatPrice(order.shipping_fee)}
                    </span>
                  </div>

                  {order.voucher_discount && order.voucher_discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Voucher Discount ({order.voucher_code})</span>
                      <span>-{formatPrice(order.voucher_discount)}</span>
                    </div>
                  )}

                  <div className="pt-3 border-t flex justify-between items-center">
                    <span className="font-bold text-gray-900 text-base">
                      Total
                    </span>
                    <span className="text-2xl font-bold text-yellow-500">
                      {formatPrice(order.total_amount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RECEIPT MODAL - Same as before */}
          {showReceiptModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
                  <h2 className="text-xl font-bold">Order Receipt</h2>
                  <button
                    onClick={() => setShowReceiptModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div id="receipt-content-print" className="p-6">
                  {/* Receipt Content */}
                  <div className="max-w-3xl mx-auto bg-white">
                    {/* Store Header */}
                    <div className="text-center border-b-2 border-gray-200 pb-6 mb-6">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Store className="h-8 w-8 text-yellow-500" />
                        <h1 className="text-3xl font-bold text-gray-900">ROCARS</h1>
                      </div>
                      <p className="text-gray-500 text-sm">
                        Premium Automotive Parts & Accessories
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        www.rocars.com | support@rocars.com | (02) 1234 5678
                      </p>
                      <div className="mt-3">
                        <p className="text-lg font-semibold text-gray-800">OFFICIAL ORDER RECEIPT</p>
                        <p className="text-xs text-gray-400">Tax Invoice / Proof of Purchase</p>
                      </div>
                    </div>

                    {/* Receipt Info Grid */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Order Number</p>
                          <p className="font-mono font-bold text-gray-900">#{order.id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Order Date</p>
                          <p className="text-sm text-gray-900">{formatShortDate(order.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Order Status</p>
                          <p className="text-sm font-medium text-green-600 capitalize">
                            {order.order_status.replace('_', ' ')}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Payment Method</p>
                          <p className="text-sm font-semibold text-gray-900">{paymentInfo.name}</p>
                          {order.payment_transaction_id && (
                            <p className="text-xs text-gray-400 font-mono mt-0.5">
                              Ref: {order.payment_transaction_id.slice(-8)}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Payment Status</p>
                          <p className="text-sm font-medium capitalize">
                            {order.payment_status === 'paid' ? 'Paid' : 
                             order.payment_status === 'unpaid' ? 'Pending Payment' : 
                             order.payment_status}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Customer Information */}
                    <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <User className="h-4 w-4 text-gray-500" />
                        <h2 className="font-bold text-gray-800">Customer Information</h2>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">Recipient Name</p>
                          <p className="font-medium">
                            {order.addresses.recipient_first_name} {order.addresses.recipient_last_name}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Contact Number</p>
                          <p>{order.addresses.phone_number}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-500 text-xs">Delivery Address</p>
                          <p className="text-sm">
                            {order.addresses.street_address}, {order.addresses.barangay}
                            <br />
                            {order.addresses.city}, {order.addresses.province} {order.addresses.zip_code}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Tracking Information in Receipt */}
                    {order.tracking_number && (
                      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <Truck className="h-4 w-4 text-gray-500" />
                          <h2 className="font-bold text-gray-800">Shipment Tracking</h2>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-gray-500 text-xs">Tracking Number</p>
                            <p className="font-mono font-medium text-sm">{order.tracking_number}</p>
                          </div>
                          {order.carrier && (
                            <div>
                              <p className="text-gray-500 text-xs">Carrier</p>
                              <p className="text-sm">{order.carrier}</p>
                            </div>
                          )}
                          {order.estimated_delivery_date && (
                            <div>
                              <p className="text-gray-500 text-xs">Estimated Delivery</p>
                              <p className="text-sm font-medium">
                                {formatDatePH(order.estimated_delivery_date)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Order Items Table */}
                    <div className="mb-8">
                      <h2 className="font-bold text-gray-800 mb-3">Order Items</h2>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left p-3 text-xs uppercase tracking-wide text-gray-600">Product</th>
                              <th className="text-center p-3 text-xs uppercase tracking-wide text-gray-600">Brand</th>
                              <th className="text-center p-3 text-xs uppercase tracking-wide text-gray-600">Qty</th>
                              <th className="text-center p-3 text-xs uppercase tracking-wide text-gray-600">Unit Price</th>
                              <th className="text-right p-3 text-xs uppercase tracking-wide text-gray-600">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.order_items.map((item, idx) => (
                              <tr key={item.id} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                <td className="p-3 font-medium text-gray-900">
                                  {item.products?.name}
                                </td>
                                <td className="p-3 text-center text-gray-600">
                                  {item.products?.brand || 'ROCARS'}
                                </td>
                                <td className="p-3 text-center text-gray-600">
                                  {item.quantity}
                                </td>
                                <td className="p-3 text-center text-gray-600">
                                  {formatPrice(item.price)}
                                </td>
                                <td className="p-3 text-right font-semibold text-gray-900">
                                  {formatPrice(item.price * item.quantity)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Totals Section */}
                    <div className="flex justify-end mb-8">
                      <div className="w-80 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Subtotal</span>
                          <span className="font-medium">{formatPrice(order.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Shipping Fee</span>
                          <span className="font-medium">
                            {order.shipping_fee === 0 ? 'FREE' : formatPrice(order.shipping_fee)}
                          </span>
                        </div>
                        {order.voucher_discount && order.voucher_discount > 0 && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Discount Applied</span>
                            <span>-{formatPrice(order.voucher_discount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t-2 border-gray-200 text-lg">
                          <span className="font-bold text-gray-900">TOTAL AMOUNT</span>
                          <span className="font-bold text-yellow-600 text-xl">
                            {formatPrice(order.total_amount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Notes */}
                    <div className="text-center pt-6 border-t-2 border-gray-200">
                      <p className="text-sm text-gray-700 font-medium">
                        Thank you for choosing ROCARS!
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        For inquiries about your order, please contact our customer support at support@rocars.com or call (02) 1234 5678
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        This is a system-generated receipt and does not require a signature.
                      </p>
                      <div className="mt-4">
                        <p className="text-[10px] text-gray-300">
                          ROCARS Auto Parts & Accessories | Business ID: ROC-2024-001
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end gap-3">
                  <button
                    onClick={() => setShowReceiptModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleDownloadReceipt}
                    className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 rounded-lg font-semibold transition flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Receipt
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition flex items-center gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Print Receipt
                  </button>
                </div>
              </div>
            </div>
          )}
        </PageContainer>
      </PageSection>
    </>
  )
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">Loading your order confirmation...</div>}>
      <OrderConfirmationContent />
    </Suspense>
  )
}
