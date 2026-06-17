'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  AlertTriangle,
  Bell,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  CreditCard,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ShoppingBag,
  Star,
  Trash2,
} from 'lucide-react'

interface AdminNotification {
  id: string
  type: 'low_stock' | 'new_order' | 'pending_refund' | 'pending_review'
  title: string
  message: string
  is_read: boolean
  created_at: string
  link: string
  metadata?: Record<string, unknown>
}

interface LowStockProduct {
  id: number
  name: string
  stock: number
}

interface PendingOrder {
  id: number
  total_amount: number
  created_at: string
}

type FilterType = 'all' | 'unread' | AdminNotification['type']

const ADMIN_DISMISSED_NOTIFS_KEY = 'rocars_dismissed_admin_notifications'
const ITEMS_PER_PAGE = 10

const notifyNavbar = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('admin-notifications-updated'))
  }
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const getDismissedIds = () => {
    if (typeof window === 'undefined') return new Set<string>()

    try {
      return new Set(JSON.parse(localStorage.getItem(ADMIN_DISMISSED_NOTIFS_KEY) || '[]') as string[])
    } catch {
      return new Set<string>()
    }
  }

  const dismissIds = (ids: string[]) => {
    const dismissedIds = getDismissedIds()
    ids.forEach(id => dismissedIds.add(id))
    localStorage.setItem(ADMIN_DISMISSED_NOTIFS_KEY, JSON.stringify([...dismissedIds]))
  }

  const isTemporaryNotification = (id: string) => id.startsWith('lowstock-') || id.startsWith('order-')

  const fetchAllData = useCallback(async () => {
    setLoading(true)

    try {
      const dismissedIds = getDismissedIds()
      const { data: { session } } = await supabase.auth.getSession()
      const combined: AdminNotification[] = []

      if (session?.access_token) {
        const response = await fetch('/api/admin/notifications', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })
        const result = await response.json()

        if (response.ok && Array.isArray(result.notifications)) {
          combined.push(...(result.notifications as AdminNotification[]))
        } else if (!response.ok) {
          console.error('Error fetching admin notifications:', result.error)
        }
      }

      const { data: lowStockProducts } = await supabase
        .from('products')
        .select('id, name, stock')
        .lt('stock', 10)
        .eq('is_active', true)

      ;((lowStockProducts || []) as LowStockProduct[]).forEach(product => {
        const id = `lowstock-${product.id}`
        const exists = combined.some(notification =>
          notification.id === id || notification.metadata?.product_id === product.id
        )

        if (!exists && !dismissedIds.has(id)) {
          combined.push({
            id,
            type: 'low_stock',
            title: 'Low Stock Alert',
            message: `${product.name} has only ${product.stock} items left in stock`,
            created_at: new Date().toISOString(),
            is_read: false,
            link: `/admin/products?edit=${product.id}`,
            metadata: { product_id: product.id, stock: product.stock },
          })
        }
      })

      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('id, total_amount, created_at')
        .eq('order_status', 'pending_payment')
        .order('created_at', { ascending: false })
        .limit(20)

      ;((pendingOrders || []) as PendingOrder[]).forEach(order => {
        const id = `order-${order.id}`
        const exists = combined.some(notification =>
          notification.id === id || notification.metadata?.order_id === order.id
        )

        if (!exists && !dismissedIds.has(id)) {
          combined.push({
            id,
            type: 'new_order',
            title: 'New Order Received',
            message: `Order #${order.id} - PHP ${Number(order.total_amount || 0).toLocaleString()} needs processing`,
            created_at: order.created_at,
            is_read: false,
            link: `/admin/orders?view=${order.id}`,
            metadata: { order_id: order.id, total_amount: order.total_amount },
          })
        }
      })

      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setNotifications(combined)
      notifyNavbar()
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const filteredNotifications = useMemo(() => {
    let filtered = [...notifications]

    if (selectedFilter === 'unread') {
      filtered = filtered.filter(notification => !notification.is_read)
    } else if (selectedFilter !== 'all') {
      filtered = filtered.filter(notification => notification.type === selectedFilter)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(notification =>
        notification.title.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [notifications, searchQuery, selectedFilter])

  const markAsRead = async (id: string) => {
    if (isTemporaryNotification(id)) {
      dismissIds([id])
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ notificationId: id }),
      })
    }

    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, is_read: true } : notification
      )
    )
    notifyNavbar()
  }

  const markAllAsRead = async () => {
    const temporaryIds = notifications
      .filter(notification => isTemporaryNotification(notification.id))
      .map(notification => notification.id)

    if (temporaryIds.length > 0) {
      dismissIds(temporaryIds)
    }

    const hasDatabaseUnread = notifications.some(notification =>
      !isTemporaryNotification(notification.id) && !notification.is_read
    )

    if (hasDatabaseUnread) {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ markAll: true }),
      })
    }

    setNotifications(prev => prev.map(notification => ({ ...notification, is_read: true })))
    notifyNavbar()
  }

  const deleteNotification = async (id: string) => {
    if (isTemporaryNotification(id)) {
      dismissIds([id])
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/admin/notifications', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ notificationId: id }),
      })
    }

    setNotifications(prev => prev.filter(notification => notification.id !== id))
    notifyNavbar()
  }

  const getIcon = (type: AdminNotification['type']) => {
    switch (type) {
      case 'low_stock':
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      case 'new_order':
        return <ShoppingBag className="h-5 w-5 text-green-600" />
      case 'pending_refund':
        return <CreditCard className="h-5 w-5 text-purple-500" />
      case 'pending_review':
        return <Star className="h-5 w-5 text-blue-500" />
      default:
        return <Bell className="h-5 w-5 text-gray-500" />
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => fetchAllData())

    const channel = supabase
      .channel('admin-notifications-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_notifications' },
        () => void fetchAllData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => void fetchAllData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => void fetchAllData()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchAllData])

  const unreadCount = notifications.filter(notification => !notification.is_read).length
  const lowStockCount = notifications.filter(notification => notification.type === 'low_stock').length
  const orderCount = notifications.filter(notification => notification.type === 'new_order').length
  const refundCount = notifications.filter(notification => notification.type === 'pending_refund').length
  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / ITEMS_PER_PAGE))
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )
  const pageStart = filteredNotifications.length === 0
    ? 0
    : (currentPage - 1) * ITEMS_PER_PAGE + 1
  const pageEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredNotifications.length)

  const filterOptions: { value: FilterType; label: string; icon: typeof Bell }[] = [
    { value: 'all', label: 'All', icon: Bell },
    { value: 'unread', label: 'Unread', icon: Eye },
    { value: 'new_order', label: 'Orders', icon: ShoppingBag },
    { value: 'low_stock', label: 'Stock', icon: AlertTriangle },
    { value: 'pending_refund', label: 'Refunds', icon: CreditCard },
  ]

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-black" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-600 transition hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button
            onClick={() => void fetchAllData()}
            className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-600 transition hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => void markAllAsRead()}
              className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 font-semibold text-white transition hover:bg-gray-800"
            >
              <CheckCircle className="h-4 w-4" />
              Mark all as read
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-black">{notifications.length}</p>
          <p className="mt-1 text-xs text-gray-500">Total Alerts</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-black">{orderCount}</p>
          <p className="mt-1 text-xs text-gray-500">Order Alerts</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-black">{lowStockCount}</p>
          <p className="mt-1 text-xs text-gray-500">Low Stock Items</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-black">{refundCount}</p>
          <p className="mt-1 text-xs text-gray-500">Refund Alerts</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setCurrentPage(1)
            }}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-gray-700 placeholder-gray-400 transition focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            {filterOptions.map(option => {
              const Icon = option.icon
              const isActive = selectedFilter === option.value

              return (
                <button
                  key={option.value}
                  onClick={() => {
                    setSelectedFilter(option.value)
                    setCurrentPage(1)
                  }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-black text-white'
                      : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {filteredNotifications.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <Bell className="h-10 w-10 text-gray-400" />
            </div>
            <p className="font-medium text-gray-500">No notifications found</p>
            <p className="mt-1 text-sm text-gray-400">
              {searchQuery ? 'Try adjusting your search or filters' : 'When important events happen, they will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {paginatedNotifications.map(notification => (
              <div
                key={notification.id}
                className={`p-5 transition ${notification.is_read ? 'hover:bg-gray-50' : 'bg-gray-50'}`}
              >
                <div className="flex gap-4">
                  <div className="shrink-0 rounded-xl bg-gray-100 p-2.5">
                    {getIcon(notification.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-black">{notification.title}</h3>
                          {!notification.is_read && (
                            <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-black">
                              New
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500">{notification.message}</p>
                        <p className="mt-2 text-xs text-gray-400">
                          {new Date(notification.created_at).toLocaleString('en-PH')}
                        </p>
                        {notification.link && (
                          <Link
                            href={notification.link}
                            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-black hover:text-gray-600"
                          >
                            View details
                          </Link>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {!notification.is_read && (
                          <button
                            onClick={() => void markAsRead(notification.id)}
                            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-black"
                            title="Mark as read"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => void deleteNotification(notification.id)}
                          className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredNotifications.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Showing {pageStart} to {pageEnd} of {filteredNotifications.length} notifications
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium transition hover:border-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <span className="px-2 text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium transition hover:border-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
