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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

type OrderItem = {
  id: number
  quantity: number
  price: number
  product: {
    id: number
    name: string
    slug: string
  } | null
}

type Address = {
  recipient_first_name: string
  recipient_last_name: string
  city: string
  province: string
  barangay: string
  street_address: string
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

const statusStyles: Record<string, string> = {
  pending_payment: 'bg-yellow-100 text-yellow-700',
  pending: 'bg-orange-100 text-orange-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const ORDERS_PER_PAGE = 5

export default function OrdersPage() {
  const router = useRouter()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTab, setSelectedTab] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    try {
      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
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
            street_address
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
        console.error(error)
        return
      }

      setOrders((data as any) || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesTab =
        selectedTab === 'all'
          ? true
          : order.order_status === selectedTab

      const matchesSearch =
        order.id.toString().includes(search) ||
        order.payment_method
          ?.toLowerCase()
          .includes(search.toLowerCase())

      return matchesTab && matchesSearch
    })
  }, [orders, search, selectedTab])

  const totalPages = Math.ceil(
    filteredOrders.length / ORDERS_PER_PAGE
  )

  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE
  )

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(price)
  }

  const formatDate = (date: string) => {
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

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-black" />
      </main>
    )
  }

  return (
    <PageSection>
      <PageContainer size="xl">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-black">
              My Orders
            </h1>

            <p className="text-gray-500 mt-1">
              Track and manage your ROCARS orders.
            </p>
          </div>

          {/* SEARCH */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />

            <input
              type="text"
              placeholder="Search order ID or payment"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-3 overflow-x-auto pb-2 mb-6">
          {[
            'all',
            'pending_payment',
            'pending',
            'processing',
            'shipped',
            'delivered',
            'cancelled',
          ].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setSelectedTab(tab)
                setCurrentPage(1)
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                selectedTab === tab
                  ? 'bg-black text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-black'
              }`}
            >
              {tab.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {/* EMPTY STATE */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />

            <h2 className="text-xl font-semibold mb-2">
              No orders found
            </h2>

            <p className="text-gray-500 mb-6">
              You haven't placed any orders yet.
            </p>

            <Link
              href="/products"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-yellow-400 text-black font-semibold hover:bg-yellow-500 transition"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            {/* ORDERS */}
            <div className="space-y-5">
              {paginatedOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
                >
                  {/* TOP */}
                  <div className="border-b border-gray-100 px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="font-bold text-lg">
                          Order #{order.id}
                        </h2>

                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                            statusStyles[order.order_status] ||
                            'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {getStatusIcon(order.order_status)}

                          {order.order_status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />

                          {formatDate(order.created_at)}
                        </span>

                        <span className="flex items-center gap-1">
                          <CreditCard className="h-4 w-4" />

                          {order.payment_method?.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-sm text-gray-500">
                        Total Amount
                      </p>

                      <p className="text-2xl font-bold text-yellow-600">
                        {formatPrice(order.total_amount)}
                      </p>
                    </div>
                  </div>

                  {/* BODY */}
                  <div className="p-6">
                    <div className="grid lg:grid-cols-3 gap-6">
                      {/* ITEMS */}
                      <div className="lg:col-span-2">
                        <h3 className="font-semibold mb-4">
                          Items Ordered
                        </h3>

                        <div className="space-y-4">
                          {order.order_items?.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between border border-gray-100 rounded-xl p-4"
                            >
                              <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-xl bg-gray-100 flex items-center justify-center">
                                  <Package className="h-6 w-6 text-gray-400" />
                                </div>

                                <div>
                                  <h4 className="font-medium text-black">
                                    {item.product?.name || 'Product'}
                                  </h4>

                                  <p className="text-sm text-gray-500">
                                    Quantity: {item.quantity}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                <p className="font-semibold">
                                  {formatPrice(
                                    item.price * item.quantity
                                  )}
                                </p>

                                <p className="text-xs text-gray-500">
                                  {formatPrice(item.price)} each
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* SIDEBAR */}
                      <div>
                        <div className="border border-gray-100 rounded-2xl p-5 space-y-4 bg-gray-50">
                          <div>
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              Delivery Address
                            </h3>

                            {order.addresses ? (
                              <div className="text-sm text-gray-600 leading-relaxed">
                                <p className="font-medium text-black">
                                  {
                                    order.addresses
                                      .recipient_first_name
                                  }{' '}
                                  {
                                    order.addresses
                                      .recipient_last_name
                                  }
                                </p>

                                <p>
                                  {
                                    order.addresses.street_address
                                  }
                                  , {order.addresses.barangay}
                                </p>

                                <p>
                                  {order.addresses.city},{' '}
                                  {order.addresses.province}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">
                                No address available
                              </p>
                            )}
                          </div>

                          {order.tracking_number && (
                            <div>
                              <p className="text-sm font-medium text-black">
                                Tracking Number
                              </p>

                              <p className="text-sm text-gray-600 mt-1">
                                {order.tracking_number}
                              </p>
                            </div>
                          )}

                          {order.estimated_delivery_date && (
                            <div>
                              <p className="text-sm font-medium text-black">
                                Estimated Delivery
                              </p>

                              <p className="text-sm text-gray-600 mt-1">
                                {new Date(
                                  order.estimated_delivery_date
                                ).toLocaleDateString('en-PH')}
                              </p>
                            </div>
                          )}

                          <div className="pt-2">
                            <Link
                              href={`/order-confirmation?orderId=${order.id}`}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-black text-white py-3 font-medium hover:bg-gray-800 transition"
                            >
                              <Eye className="h-4 w-4" />
                              View Order
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10 flex-wrap">
                {/* PREVIOUS */}
                <button
                  onClick={() =>
                    setCurrentPage((prev) =>
                      Math.max(prev - 1, 1)
                    )
                  }
                  disabled={currentPage === 1}
                  className="h-11 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                {/* PAGE NUMBERS */}
                {Array.from({ length: totalPages }).map(
                  (_, index) => {
                    const page = index + 1

                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`h-11 w-11 rounded-xl font-semibold transition ${
                          currentPage === page
                            ? 'bg-black text-white'
                            : 'bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  }
                )}

                {/* NEXT */}
                <button
                  onClick={() =>
                    setCurrentPage((prev) =>
                      Math.min(prev + 1, totalPages)
                    )
                  }
                  disabled={currentPage === totalPages}
                  className="h-11 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </PageContainer>
    </PageSection>
  )
}