'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  Bell, 
  Package, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle, 
  DollarSign,
  ShoppingBag,
  Users,
  TrendingUp,
  Clock,
  ChevronRight,
  Filter,
  Trash2,
  Eye,
  EyeOff,
  Search,
  CreditCard
} from 'lucide-react'

interface Notification {
  id: number
  title: string
  message: string
  is_read: boolean
  created_at: string
  type?: 'order' | 'stock' | 'refund' | 'payment' | 'user' | 'system'
  action_url?: string
  action_label?: string
}

type FilterType = 'all' | 'order' | 'stock' | 'refund' | 'unread'

// Event to notify navbar about notification changes
const notifyNavbar = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('admin-notifications-updated'))
  }
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalUsers: 0
  })

  useEffect(() => {
    fetchAllData()
    fetchDashboardStats()
  }, [])

  useEffect(() => {
    filterNotifications()
  }, [notifications, selectedFilter, searchQuery])

  const fetchDashboardStats = async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { count: ordersToday } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data: revenueData } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('payment_status', 'paid')
        .gte('created_at', thirtyDaysAgo.toISOString())

      const totalRevenue = revenueData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0

      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      setStats({
        totalOrders: ordersToday || 0,
        totalRevenue: totalRevenue,
        totalUsers: totalUsers || 0
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchAllData = async () => {
    setLoading(true)
    
    try {
      // Fetch low stock count
      const { count: lowStock } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .lt('stock', 10)
        .eq('is_active', true)
      
      setLowStockCount(lowStock || 0)
      
      // Fetch pending orders with user info
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)
      
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          created_at,
          user_id,
          order_status,
          payment_method
        `)
        .in('order_status', ['pending_payment', 'pending'])
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20)
      
      // Fetch user profiles for orders
      const ordersWithUserNames = []
      if (orders) {
        for (const order of orders) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, username')
            .eq('id', order.user_id)
            .single()
          
          const userName = profile?.first_name 
            ? `${profile.first_name} ${profile.last_name || ''}`
            : profile?.username || 'Customer'
          
          ordersWithUserNames.push({
            ...order,
            user_name: userName
          })
        }
      }
      
      // Fetch unread admin notifications
      const { data: dbNotifs } = await supabase
        .from('notifications')
        .select('*')
        .is('user_id', null)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50)
      
      // Combine all notifications
      const combined: Notification[] = []
      
      // Add low stock notification if needed
      if (lowStock && lowStock > 0) {
        combined.push({
          id: -1,
          title: 'Low Stock Alert',
          message: `There ${lowStock === 1 ? 'is' : 'are'} ${lowStock} product${lowStock > 1 ? 's' : ''} with low inventory. Please restock soon.`,
          is_read: false,
          created_at: new Date().toISOString(),
          type: 'stock',
          action_url: '/admin/products',
          action_label: 'View Products'
        })
      }
      
      // Add pending order notifications
      ordersWithUserNames.forEach(order => {
        const paymentMethod = order.payment_method === 'cod' ? 'Cash on Delivery' : 
                             order.payment_method === 'gcash' ? 'GCash' : 'Bank Transfer'
        
        combined.push({
          id: -order.id,
          title: 'New Order',
          message: `Order #${order.id} from ${order.user_name} - ₱${order.total_amount.toLocaleString()} (${paymentMethod})`,
          is_read: false,
          created_at: order.created_at,
          type: 'order',
          action_url: `/admin/orders?order=${order.id}`,
          action_label: 'View Order'
        })
      })
      
      // Add database notifications
      dbNotifs?.forEach(notif => {
        combined.push({
          ...notif,
          type: 'system'
        })
      })
      
      // Sort by date (newest first)
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      setNotifications(combined)
      setFilteredNotifications(combined)
      
      notifyNavbar()
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterNotifications = () => {
    let filtered = [...notifications]
    
    if (selectedFilter !== 'all') {
      if (selectedFilter === 'unread') {
        filtered = filtered.filter(n => !n.is_read)
      } else {
        filtered = filtered.filter(n => n.type === selectedFilter)
      }
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(query) || 
        n.message.toLowerCase().includes(query)
      )
    }
    
    setFilteredNotifications(filtered)
  }

  const markAsRead = async (id: number) => {
    if (id > 0) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
    }
    
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, is_read: true } : notif
      )
    )
    
    notifyNavbar()
  }

  const markAsUnread = async (id: number) => {
    if (id > 0) {
      await supabase
        .from('notifications')
        .update({ is_read: false })
        .eq('id', id)
    }
    
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, is_read: false } : notif
      )
    )
    
    notifyNavbar()
  }

  const markAllAsRead = async () => {
    const dbNotifs = notifications.filter(n => n.id > 0 && !n.is_read)
    for (const notif of dbNotifs) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notif.id)
    }
    
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, is_read: true }))
    )
    
    notifyNavbar()
  }

  const deleteNotification = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (id > 0) {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
    }
    
    setNotifications(prev => prev.filter(n => n.id !== id))
    notifyNavbar()
  }

  const getIcon = (type?: string) => {
    switch (type) {
      case 'order':
        return <ShoppingBag className="w-5 h-5 text-black" />
      case 'stock':
        return <AlertTriangle className="w-5 h-5 text-black" />
      case 'refund':
        return <DollarSign className="w-5 h-5 text-black" />
      case 'payment':
        return <CreditCard className="w-5 h-5 text-black" />
      case 'user':
        return <Users className="w-5 h-5 text-black" />
      default:
        return <Bell className="w-5 h-5 text-black" />
    }
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  const filterOptions: { value: FilterType; label: string; icon: any }[] = [
    { value: 'all', label: 'All', icon: Bell },
    { value: 'unread', label: 'Unread', icon: Eye },
    { value: 'order', label: 'Orders', icon: ShoppingBag },
    { value: 'stock', label: 'Stock', icon: AlertTriangle },
    { value: 'refund', label: 'Refunds', icon: DollarSign },
  ]

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
          <h1 className="text-3xl font-bold text-black">Notifications</h1>
          <p className="text-gray-500 text-sm mt-1">
            {unreadCount > 0 
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition"
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button
            onClick={fetchAllData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 transition"
            >
              <CheckCircle className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards - Simple Black & White */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-black">{stats.totalOrders}</p>
              <p className="text-xs text-gray-500 mt-1">Orders Today</p>
            </div>
            <div className="p-2 rounded-lg bg-gray-100">
              <ShoppingBag className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-black">₱{stats.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Revenue (30d)</p>
            </div>
            <div className="p-2 rounded-lg bg-gray-100">
              <TrendingUp className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-black">{stats.totalUsers.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Total Users</p>
            </div>
            <div className="p-2 rounded-lg bg-gray-100">
              <Users className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-black">{lowStockCount}</p>
              <p className="text-xs text-gray-500 mt-1">Low Stock Items</p>
            </div>
            <div className="p-2 rounded-lg bg-gray-100">
              <AlertTriangle className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition"
          />
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
            {filterOptions.map((option) => {
              const Icon = option.icon
              const isActive = selectedFilter === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => setSelectedFilter(option.value)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-black text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {option.label}
                  {option.value === 'unread' && unreadCount > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                      isActive ? 'bg-white text-black' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {unreadCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Notifications List - Clean Layout */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No notifications found</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery ? 'Try adjusting your search or filters' : 'When important events happen, they\'ll appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`group p-5 transition-all duration-200 ${
                  !notif.is_read ? 'bg-gray-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className="p-2.5 rounded-xl bg-gray-100">
                      {getIcon(notif.type)}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={`font-semibold text-sm sm:text-base ${
                            !notif.is_read ? 'text-black' : 'text-gray-700'
                          }`}>
                            {notif.title}
                          </h3>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getTimeAgo(notif.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                          {notif.message}
                        </p>
                        
                        {/* Action Button */}
                        {notif.action_url && (
                          <Link
                            href={notif.action_url}
                            className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-black hover:text-gray-600 transition group/link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {notif.action_label || 'View Details'}
                            <ChevronRight className="w-4 h-4 transition-transform group-hover/link:translate-x-0.5" />
                          </Link>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        {!notif.is_read ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              markAsRead(notif.id)
                            }}
                            className="p-2 rounded-lg text-gray-400 hover:text-black hover:bg-gray-100 transition"
                            title="Mark as read"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              markAsUnread(notif.id)
                            }}
                            className="p-2 rounded-lg text-gray-400 hover:text-black hover:bg-gray-100 transition"
                            title="Mark as unread"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => deleteNotification(notif.id, e)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Footer */}
        {filteredNotifications.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400 text-center">
              Showing {filteredNotifications.length} of {notifications.length} notifications
            </p>
          </div>
        )}
      </div>
    </div>
  )
}