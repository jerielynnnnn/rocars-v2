// app/admin/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDateTimePH, formatTimePH } from '@/lib/time'
import {
  Users,
  Package,
  ShoppingBag,
  Loader2,
  ArrowUp,
  ArrowDown,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Eye,
  Download,
  RefreshCw,
  AlertTriangle,
  CreditCard,
  Truck,
  Plus,
} from 'lucide-react'

interface DashboardStats {
  totalUsers: number
  totalProducts: number
  ordersToday: number
  ordersYesterday: number
  totalRevenue: number
  revenueYesterday: number
  pendingOrders: number
  completedOrders: number
  cancelledOrders: number
  lowStockProducts: number
  pendingRefunds: number
}

interface RecentOrder {
  id: number
  user_name: string
  total_amount: number
  order_status: string
  payment_status: string
  created_at: string
}

interface TopProduct {
  id: number
  name: string
  total_sold: number
  total_revenue: number
  image_url: string
}

interface RevenueData {
  date: string
  revenue: number
}

interface LowStockProduct {
  id: number
  name: string
  stock: number
  price: number
}

// Define the order item type with proper relations
interface OrderItemWithProduct {
  product_id: number
  quantity: number
  price: number
  products: {
    id: number
    name: string
    product_images: {
      image_url: string
    }[]
  }
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalProducts: 0,
    ordersToday: 0,
    ordersYesterday: 0,
    totalRevenue: 0,
    revenueYesterday: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    lowStockProducts: 0,
    pendingRefunds: 0,
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([])
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month')
  const [exporting, setExporting] = useState(false)

  async function getRefundedOrderIds() {
    const refundedOrderIds = new Set<number>()

    const { data: refundsData, error: refundsError } = await supabase
      .from('refunds')
      .select('order_id')
      .in('refund_status', ['approved', 'completed'])

    if (!refundsError) {
      for (const refund of refundsData || []) {
        if (refund.order_id) {
          refundedOrderIds.add(Number(refund.order_id))
        }
      }
    }

    const { data: fallbackRequests, error: fallbackError } = await supabase
      .from('cancellation_requests')
      .select('order_id, admin_notes')
      .eq('status', 'approved')

    if (!fallbackError) {
      for (const request of fallbackRequests || []) {
        if (
          request.order_id
          && String(request.admin_notes || '').match(/\[REFUND_STATUS:(approved|completed)\]/)
        ) {
          refundedOrderIds.add(Number(request.order_id))
        }
      }
    }

    return refundedOrderIds
  }

  async function fetchDashboardData() {
    try {
      // Get today's date range
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Fetch total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      // Fetch total products
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      // Fetch orders today
      const { count: ordersToday } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())

      // Fetch orders yesterday
      const { count: ordersYesterday } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString())

      const refundedOrderIds = await getRefundedOrderIds()

      // Fetch total revenue (paid orders minus approved/completed refunds)
      const { data: revenueData } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('payment_status', 'paid')

      const totalRevenue = revenueData
        ?.filter((order) => !refundedOrderIds.has(Number(order.id)))
        .reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0

      // Fetch revenue yesterday (paid orders minus approved/completed refunds)
      const { data: revenueYesterdayData } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('payment_status', 'paid')
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString())

      const revenueYesterday = revenueYesterdayData
        ?.filter((order) => !refundedOrderIds.has(Number(order.id)))
        .reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0

      // Fetch order status counts
      const { count: pendingOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('order_status', ['pending_payment', 'pending'])

      const { count: completedOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'delivered')
        .eq('payment_status', 'paid')

      const { count: cancelledOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'cancelled')

      // Fetch low stock products
      const { count: lowStockProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .lt('stock', 10)
        .eq('is_active', true)

      // Fetch pending refunds
      const { count: pendingRefunds } = await supabase
        .from('refunds')
        .select('*', { count: 'exact', head: true })
        .eq('refund_status', 'pending')

      setStats({
        totalUsers: totalUsers || 0,
        totalProducts: totalProducts || 0,
        ordersToday: ordersToday || 0,
        ordersYesterday: ordersYesterday || 0,
        totalRevenue: totalRevenue,
        revenueYesterday: revenueYesterday,
        pendingOrders: pendingOrders || 0,
        completedOrders: completedOrders || 0,
        cancelledOrders: cancelledOrders || 0,
        lowStockProducts: lowStockProducts || 0,
        pendingRefunds: pendingRefunds || 0,
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchRecentOrders() {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          order_status,
          payment_status,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      // Fetch user names for each order
      const ordersWithNames = await Promise.all(
        (orders || []).map(async (order) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, username')
            .eq('id', order.user_id)
            .single()

          const userName = profile?.first_name
            ? `${profile.first_name} ${profile.last_name || ''}`
            : profile?.username || 'Customer'

          return {
            ...order,
            user_name: userName,
          }
        })
      )

      setRecentOrders(ordersWithNames)
    } catch (error) {
      console.error('Error fetching recent orders:', error)
    }
  }

  async function fetchTopProducts() {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          product_id,
          quantity,
          price,
          products (
            id,
            name,
            product_images (
              image_url
            )
          )
        `) as { data: OrderItemWithProduct[] | null; error: unknown }

      if (error) throw error

      // Aggregate product sales
      const productSales = new Map<number, { name: string; total_sold: number; total_revenue: number; image_url: string }>()
      
      for (const item of data || []) {
        const productId = item.product_id
        const product = item.products
        const productName = product?.name
        const productImage = product?.product_images?.[0]?.image_url
        
        if (productSales.has(productId)) {
          const existing = productSales.get(productId)!
          existing.total_sold += item.quantity
          existing.total_revenue += item.quantity * item.price
        } else {
          productSales.set(productId, {
            name: productName || `Product #${productId}`,
            total_sold: item.quantity,
            total_revenue: item.quantity * item.price,
            image_url: productImage || '/placeholder.png',
          })
        }
      }

      const topProductsList = Array.from(productSales.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.total_sold - a.total_sold)
        .slice(0, 5)

      setTopProducts(topProductsList)
    } catch (error) {
      console.error('Error fetching top products:', error)
    }
  }

  async function fetchRevenueData() {
    try {
      const startDate = new Date()
      
      switch (timeRange) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1)
          break
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
      }

      const refundedOrderIds = await getRefundedOrderIds()

      const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, created_at')
        .eq('payment_status', 'paid')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      // Group by date
      const revenueByDate = new Map<string, number>()
      
      for (const order of data || []) {
        if (refundedOrderIds.has(Number(order.id))) continue

        const date = new Date(order.created_at).toISOString().split('T')[0]
        const currentRevenue = revenueByDate.get(date) || 0
        revenueByDate.set(date, currentRevenue + (order.total_amount || 0))
      }

      const revenueArray = Array.from(revenueByDate.entries()).map(([date, revenue]) => ({
        date,
        revenue,
      }))

      setRevenueData(revenueArray)
    } catch (error) {
      console.error('Error fetching revenue data:', error)
    }
  }

  async function fetchLowStockProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock, price')
        .eq('is_active', true)
        .lte('stock', 10)
        .order('stock', { ascending: true })
        .limit(6)

      if (error) throw error

      setLowStockProducts(data || [])
    } catch (error) {
      console.error('Error fetching low stock products:', error)
      setLowStockProducts([])
    }
  }

  async function fetchAllData() {
    setRefreshing(true)
    await Promise.all([
      fetchDashboardData(),
      fetchRecentOrders(),
      fetchTopProducts(),
      fetchRevenueData(),
      fetchLowStockProducts(),
    ])
    setLastUpdated(new Date())
    setRefreshing(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAllData()

    // Set up real-time subscriptions
    const ordersChannel = supabase
      .channel('dashboard-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchAllData()
        }
      )
      .subscribe()

    const productsChannel = supabase
      .channel('dashboard-products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          fetchDashboardData()
          fetchTopProducts()
          fetchLowStockProducts()
        }
      )
      .subscribe()

    const profilesChannel = supabase
      .channel('dashboard-profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchDashboardData()
      )
      .subscribe()

    const refundsChannel = supabase
      .channel('dashboard-refunds')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'refunds' },
        () => fetchDashboardData()
      )
      .subscribe()

    return () => {
      ordersChannel.unsubscribe()
      productsChannel.unsubscribe()
      profilesChannel.unsubscribe()
      refundsChannel.unsubscribe()
    }
  }, [timeRange])

  const exportDashboardData = async () => {
    setExporting(true)
    try {
      // Fetch all orders for export
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          order_status,
          payment_status,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false })

      // Fetch all products
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price, stock, is_active')
        .eq('is_active', true)

      // Prepare export data
      const exportData = {
        exportDate: new Date().toISOString(),
        summary: {
          totalUsers: stats.totalUsers,
          totalProducts: stats.totalProducts,
          totalRevenue: stats.totalRevenue,
          pendingOrders: stats.pendingOrders,
          completedOrders: stats.completedOrders,
          cancelledOrders: stats.cancelledOrders,
          lowStockProducts: stats.lowStockProducts,
          pendingRefunds: stats.pendingRefunds,
        },
        recentOrders: recentOrders,
        topProducts: topProducts,
        revenueData: revenueData,
      }

      // Create CSV for orders
      const ordersCSV = [
        ['Order ID', 'Customer', 'Amount', 'Status', 'Payment Status', 'Date'],
        ...(orders || []).map(order => [
          order.id,
          order.user_id,
          order.total_amount,
          order.order_status,
          order.payment_status,
          new Date(order.created_at).toLocaleString()
        ])
      ].map(row => row.join(',')).join('\n')

      // Create CSV for products
      const productsCSV = [
        ['Product ID', 'Name', 'Price', 'Stock', 'Status'],
        ...(products || []).map(product => [
          product.id,
          product.name,
          product.price,
          product.stock,
          product.is_active ? 'Active' : 'Inactive'
        ])
      ].map(row => row.join(',')).join('\n')

      // Create JSON export
      const jsonStr = JSON.stringify(exportData, null, 2)
      const csvOrdersBlob = new Blob([ordersCSV], { type: 'text/csv' })
      const csvProductsBlob = new Blob([productsCSV], { type: 'text/csv' })
      const jsonBlob = new Blob([jsonStr], { type: 'application/json' })

      // Download files
      const timestamp = new Date().toISOString().split('T')[0]
      
      // Create download links
      const ordersLink = document.createElement('a')
      ordersLink.href = URL.createObjectURL(csvOrdersBlob)
      ordersLink.download = `dashboard_orders_${timestamp}.csv`
      ordersLink.click()

      const productsLink = document.createElement('a')
      productsLink.href = URL.createObjectURL(csvProductsBlob)
      productsLink.download = `dashboard_products_${timestamp}.csv`
      productsLink.click()

      const jsonLink = document.createElement('a')
      jsonLink.href = URL.createObjectURL(jsonBlob)
      jsonLink.download = `dashboard_full_${timestamp}.json`
      jsonLink.click()

      // Cleanup
      URL.revokeObjectURL(ordersLink.href)
      URL.revokeObjectURL(productsLink.href)
      URL.revokeObjectURL(jsonLink.href)

    } catch (error) {
      console.error('Error exporting dashboard data:', error)
      alert('Failed to export data. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-700'
      case 'shipped':
        return 'bg-blue-100 text-blue-700'
      case 'pending':
      case 'pending_payment':
        return 'bg-yellow-100 text-yellow-700'
      case 'cancelled':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return formatDateTimePH(dateString)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
      </div>
    )
  }

  const orderChange = stats.ordersToday - stats.ordersYesterday
  const orderChangePercent = stats.ordersYesterday > 0 
    ? (orderChange / stats.ordersYesterday) * 100 
    : orderChange > 0 ? 100 : 0

  const revenueChange = stats.totalRevenue - stats.revenueYesterday
  const revenueChangePercent = stats.revenueYesterday > 0 
    ? (revenueChange / stats.revenueYesterday) * 100 
    : revenueChange > 0 ? 100 : 0

  const actionQueue = [
    {
      label: 'Orders to process',
      value: stats.pendingOrders,
      href: '/admin/orders',
      icon: Clock,
      tone: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    },
    {
      label: 'Payment checks',
      value: recentOrders.filter((order) => order.payment_status !== 'paid').length,
      href: '/admin/payments',
      icon: CreditCard,
      tone: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      label: 'Shipping follow-ups',
      value: recentOrders.filter((order) => ['processing', 'shipped'].includes(order.order_status)).length,
      href: '/admin/shipping',
      icon: Truck,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      label: 'Low stock',
      value: stats.lowStockProducts,
      href: '/admin/products',
      icon: AlertTriangle,
      tone: 'bg-red-50 text-red-700 border-red-200',
    },
  ]

  const averageOrderValue = stats.completedOrders > 0
    ? stats.totalRevenue / stats.completedOrders
    : 0

  const fulfilmentRate = stats.completedOrders + stats.cancelledOrders + stats.pendingOrders > 0
    ? (stats.completedOrders / (stats.completedOrders + stats.cancelledOrders + stats.pendingOrders)) * 100
    : 0

  return (
    <div className="space-y-8">
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Overview of your store&apos;s performance
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400">
            Last updated: {formatTimePH(lastUpdated)}
          </div>
          <button
            onClick={fetchAllData}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm">Refresh</span>
          </button>
          <button
            onClick={exportDashboardData}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">{exporting ? 'Exporting...' : 'Export Data'}</span>
          </button>
        </div>
      </div>

      {/* Ecommerce Command Center */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Action Queue</h2>
              <p className="text-sm text-gray-500">Fast view of store work that needs attention.</p>
            </div>
            <Link href="/admin/orders" className="text-sm font-medium text-black hover:underline">
              View orders
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {actionQueue.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${item.tone}`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5" />
                    <span className="text-2xl font-bold">{item.value}</span>
                  </div>
                  <p className="mt-3 text-sm font-medium">{item.label}</p>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-black p-5 text-white shadow-sm">
          <h2 className="text-lg font-semibold">Store Health</h2>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-gray-300">Fulfillment rate</span>
                <span>{fulfilmentRate.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/20">
                <div className="h-2 rounded-full bg-yellow-400" style={{ width: `${Math.min(fulfilmentRate, 100)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs text-gray-300">Avg order value</p>
                <p className="mt-1 text-lg font-bold">{formatCurrency(averageOrderValue)}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs text-gray-300">Pending refunds</p>
                <p className="mt-1 text-lg font-bold">{stats.pendingRefunds}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</h3>
          <p className="text-sm text-gray-500 mt-1">Total Users</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-50 rounded-xl">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.totalProducts.toLocaleString()}</h3>
          <p className="text-sm text-gray-500 mt-1">Active Products</p>
          {stats.lowStockProducts > 0 && (
            <p className="text-xs text-red-500 mt-1">{stats.lowStockProducts} low stock items</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-50 rounded-xl">
              <ShoppingBag className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.ordersToday.toLocaleString()}</h3>
          <p className="text-sm text-gray-500 mt-1">Orders Today</p>
          <div className={`flex items-center gap-1 mt-2 text-xs ${orderChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {orderChange >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            <span>{Math.abs(orderChangePercent).toFixed(1)}% from yesterday</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-50 rounded-xl">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</h3>
          <p className="text-sm text-gray-500 mt-1">Total Revenue</p>
          <div className={`flex items-center gap-1 mt-2 text-xs ${revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {revenueChange >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            <span>{Math.abs(revenueChangePercent).toFixed(1)}% from yesterday</span>
          </div>
        </div>
      </div>

      {/* Quick Actions and Low Stock */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          <div className="mt-4 grid gap-3">
            <Link href="/admin/products/new" className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium transition hover:border-black hover:bg-gray-50">
              <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add product</span>
              <span>Go</span>
            </Link>
            <Link href="/admin/vouchers" className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium transition hover:border-black hover:bg-gray-50">
              <span className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Manage vouchers</span>
              <span>Go</span>
            </Link>
            <Link href="/admin/notifications" className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium transition hover:border-black hover:bg-gray-50">
              <span className="flex items-center gap-2"><Eye className="h-4 w-4" /> Send notification</span>
              <span>Go</span>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Low Stock Watchlist</h2>
              <p className="text-sm text-gray-500">Restock these products before they block sales.</p>
            </div>
            <Link href="/admin/products" className="text-sm font-medium text-black hover:underline">
              Manage inventory
            </Link>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">Inventory looks healthy right now.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {lowStockProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/admin/products/${product.id}`}
                  className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 transition hover:border-red-200 hover:bg-red-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(product.price)}</p>
                  </div>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                    {product.stock} left
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium">Pending Orders</p>
              <p className="text-3xl font-bold text-yellow-700 mt-1">{stats.pendingOrders}</p>
            </div>
            <Clock className="w-10 h-10 text-yellow-500 opacity-50" />
          </div>
        </div>

        <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Completed Orders</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{stats.completedOrders}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500 opacity-50" />
          </div>
        </div>

        <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Cancelled Orders</p>
              <p className="text-3xl font-bold text-red-700 mt-1">{stats.cancelledOrders}</p>
            </div>
            <XCircle className="w-10 h-10 text-red-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Revenue Chart Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Revenue Overview</h2>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as 'week' | 'month' | 'year')}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-black"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last 12 Months</option>
          </select>
        </div>

        {revenueData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            No revenue data available
          </div>
        ) : (
          <div className="h-80">
            <RevenueChart data={revenueData} />
          </div>
        )}
      </div>

      {/* Recent Orders & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
          
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No recent orders</div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => window.location.href = `/admin/orders?order=${order.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">#{order.id}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.order_status)}`}>
                        {order.order_status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{order.user_name}</p>
                    <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(order.total_amount)}</p>
                    <p className="text-xs text-gray-400">{order.payment_status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h2>
          
          {topProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No product sales data</div>
          ) : (
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                    {index + 1}
                  </div>
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-12 h-12 rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.png'
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{product.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Sold: {product.total_sold}</span>
                      <span>•</span>
                      <span>{formatCurrency(product.total_revenue)}</span>
                    </div>
                  </div>
                  <div className="w-16 h-16">
                    <OrdersChart product={product} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Revenue Chart Component
function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1)
  
  return (
    <div className="h-full w-full">
      <div className="flex h-64 items-end gap-2">
        {data.map((item, index) => {
          const height = (item.revenue / maxRevenue) * 100
          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-1">
              <div className="relative group w-full">
                <div
                  className="bg-gray-200 hover:bg-black transition-all duration-300 rounded-t-lg"
                  style={{ height: `${height}%`, minHeight: '4px' }}
                >
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
                    {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 }).format(item.revenue)}
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-500 rotate-45 origin-left">
                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Orders Chart Component (Pie chart for product sales)
function OrdersChart({ product }: { product: TopProduct }) {
  // Calculate percentage (assuming max 100 units for visualization)
  const maxUnits = Math.max(...[product.total_sold, 100])
  const percentage = (product.total_sold / maxUnits) * 100
  const circumference = 251.2 // 2 * PI * 40
  const dashArray = (percentage / 100) * circumference
  
  return (
    <div className="relative w-full h-full">
      <svg viewBox="0 0 100 100" className="transform -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="12"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#000"
          strokeWidth="12"
          strokeDasharray={`${dashArray} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold">{product.total_sold}</span>
      </div>
    </div>
  )
}
