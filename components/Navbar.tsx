'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'

import {
  Home,
  ShoppingCart,
  Heart,
  User,
  Menu,
  X,
  LogOut,
  Ticket,
  ChevronDown,
  UserCircle,
  Package,
  Bell,
  LayoutDashboard,
  Gift,
  Users,
  ShoppingBag,
  CreditCard,
  RefreshCw,
  Star,
  Tags,
  Truck,
  Settings,
  CheckCheck,
  AlertTriangle,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useCart } from '@/context/CartContext'
import { canAccessAdminPath, isAdminLikeRole, STAFF_DEFAULT_ADMIN_PATH } from '@/lib/admin-role'

// ============================================
// TYPES
// ============================================

interface Notification {
  id: number
  title: string
  message: string
  is_read: boolean
  created_at: string
  user_id: string
  type?: string
  link?: string
}

interface AdminNotification {
  id: string
  type: 'low_stock' | 'new_order' | 'pending_refund' | 'pending_review'
  title: string
  message: string
  created_at: string
  is_read: boolean
  link: string
  metadata?: Record<string, unknown>
}

interface ProfileRealtimePayload {
  role: string | null
  avatar_url: string | null
  first_name: string | null
  last_name: string | null
  username: string | null
}

interface LowStockProduct {
  id: string
  name: string
  stock: number
}

interface PendingOrder {
  id: string
  total_amount: number
  created_at: string
}

const ADMIN_DISMISSED_NOTIFS_KEY = 'rocars_dismissed_admin_notifications'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { cartCount, clearCart } = useCart()

  const [session, setSession] = useState<Session | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [wishlistCount, setWishlistCount] = useState(0)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [notifCount, setNotifCount] = useState(0)
  const [adminNotifCount, setAdminNotifCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)
  const [showAdminNotifications, setShowAdminNotifications] = useState(false)
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([])
  const [loadingAdminNotifs, setLoadingAdminNotifs] = useState(false)

  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifMenuRef = useRef<HTMLDivElement>(null)
  const adminNotifMenuRef = useRef<HTMLDivElement>(null)

  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isAdmin = userRole === 'admin'
  const isStaff = isAdminLikeRole(userRole)
  const isOnAdminRoute = pathname?.startsWith('/admin')
  const adminHomeHref = isAdmin ? '/admin/dashboard' : STAFF_DEFAULT_ADMIN_PATH

  const getDismissedAdminNotificationIds = () => {
    if (typeof window === 'undefined') return new Set<string>()

    try {
      return new Set(JSON.parse(localStorage.getItem(ADMIN_DISMISSED_NOTIFS_KEY) || '[]') as string[])
    } catch {
      return new Set<string>()
    }
  }

  const dismissAdminNotificationIds = (ids: string[]) => {
    if (typeof window === 'undefined') return

    const dismissedIds = getDismissedAdminNotificationIds()
    ids.forEach((id) => dismissedIds.add(id))
    localStorage.setItem(ADMIN_DISMISSED_NOTIFS_KEY, JSON.stringify([...dismissedIds]))
  }

  // Fetch user profile
  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, avatar_url, first_name, last_name, username')
      .eq('id', userId)
      .single()

    if (!error && data) {
      setUserRole(data.role)
      setUserAvatar(data.avatar_url)
      const displayName = data.first_name
        ? `${data.first_name} ${data.last_name || ''}`.trim()
        : data.username || 'User'
      setUserName(displayName)
    }
  }

  // Fetch wishlist count
  const fetchWishlistCount = async (userId: string) => {
    const { count, error } = await supabase
      .from('wishlists')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    setWishlistCount(!error && count !== null ? count : 0)
  }

  // Fetch user notifications
  const fetchNotifications = async (userId: string) => {
    setLoadingNotifs(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!error && data) {
        setNotifications(data as Notification[])
        const unreadCount = data.filter((n: Notification) => !n.is_read).length
        setNotifCount(unreadCount)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoadingNotifs(false)
    }
  }

  // Fetch admin notifications from database
  const fetchAdminNotifications = async () => {
    if (!isStaff) return

    setLoadingAdminNotifs(true)
    try {
      const notificationsList: AdminNotification[] = []
      const dismissedIds = getDismissedAdminNotificationIds()
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      if (currentSession?.access_token) {
        const response = await fetch('/api/admin/notifications', {
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
        })
        const result = await response.json()

        if (response.ok && result.notifications) {
          result.notifications.forEach((notif: AdminNotification) => {
            notificationsList.push({
              id: notif.id,
              type: notif.type,
              title: notif.title,
              message: notif.message,
              created_at: notif.created_at,
              is_read: notif.is_read,
              link: notif.link,
              metadata: notif.metadata
            })
          })
        }
      }

      // Fetch low stock products for real-time alerts
      const { data: lowStockProducts } = await supabase
        .from('products')
        .select('id, name, stock')
        .lt('stock', 10)
        .eq('is_active', true)

      if (lowStockProducts && lowStockProducts.length > 0) {
        (lowStockProducts as LowStockProduct[]).forEach(product => {
          // Check if notification already exists
          const exists = notificationsList.some(n => 
            n.metadata?.product_id === product.id || n.id === `lowstock-${product.id}`
          )
          if (!exists && !dismissedIds.has(`lowstock-${product.id}`)) {
            notificationsList.push({
              id: `lowstock-${product.id}`,
              type: 'low_stock',
              title: 'Low Stock Alert',
              message: `${product.name} has only ${product.stock} items left in stock`,
              created_at: new Date().toISOString(),
              is_read: false,
              link: `/admin/products?edit=${product.id}`,
              metadata: { product_id: product.id, stock: product.stock }
            })
          }
        })
      }

      // Fetch pending orders
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('id, total_amount, created_at')
        .eq('order_status', 'pending_payment')
        .order('created_at', { ascending: false })
        .limit(5)

      if (pendingOrders && pendingOrders.length > 0) {
        (pendingOrders as PendingOrder[]).forEach(order => {
          const exists = notificationsList.some(n => 
            n.metadata?.order_id === order.id || n.id === `order-${order.id}`
          )
          if (!exists && !dismissedIds.has(`order-${order.id}`)) {
            notificationsList.push({
              id: `order-${order.id}`,
              type: 'new_order',
              title: 'New Order Received',
              message: `Order #${order.id} - ₱${order.total_amount?.toLocaleString()} needs processing`,
              created_at: order.created_at,
              is_read: false,
              link: `/admin/orders?view=${order.id}`,
              metadata: { order_id: order.id, total_amount: order.total_amount }
            })
          }
        })
      }

      // Sort by date (newest first)
      notificationsList.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setAdminNotifications(notificationsList)
      const unreadCount = notificationsList.filter(n => !n.is_read).length
      setAdminNotifCount(unreadCount)
    } catch (error) {
      console.error('Error fetching admin notifications:', error)
    } finally {
      setLoadingAdminNotifs(false)
    }
  }

  // Mark single admin notification as read
  const markAdminNotificationAsRead = async (notificationId: string) => {
    // Check if it's a database notification or temporary one
    if (!notificationId.startsWith('lowstock-') && !notificationId.startsWith('order-')) {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        await fetch('/api/admin/notifications', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentSession?.access_token}`,
          },
          body: JSON.stringify({ notificationId }),
        })
      } catch (error) {
        console.error('Error marking admin notification as read:', error)
      }
    } else {
      dismissAdminNotificationIds([notificationId])
    }
    
    setAdminNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId
          ? { ...notif, is_read: true }
          : notif
      )
    )
    setAdminNotifCount(prev => Math.max(0, prev - 1))
  }

  // Mark all admin notifications as read
  const markAllAdminNotificationsAsRead = async () => {
    try {
      // Update database notifications
      const dbNotifications = adminNotifications.filter(n => 
        !n.id.startsWith('lowstock-') && !n.id.startsWith('order-') && !n.is_read
      )

      const tempNotificationIds = adminNotifications
        .filter(n => n.id.startsWith('lowstock-') || n.id.startsWith('order-'))
        .map(n => n.id)

      if (tempNotificationIds.length > 0) {
        dismissAdminNotificationIds(tempNotificationIds)
      }

      if (dbNotifications.length > 0) {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        await fetch('/api/admin/notifications', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentSession?.access_token}`,
          },
          body: JSON.stringify({ markAll: true }),
        })
      }
      
      setAdminNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      )
      setAdminNotifCount(0)
    } catch (error) {
      console.error('Error marking all admin notifications as read:', error)
    }
  }

  // Mark single user notification as read
  const markAsRead = async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      if (!error) {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId
              ? { ...notif, is_read: true }
              : notif
          )
        )
        setNotifCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  // Mark all user notifications as read
  const markAllAsRead = async () => {
    if (!session?.user?.id) return

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false)

      if (!error) {
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, is_read: true }))
        )
        setNotifCount(0)
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }
    
    if (notification.link) {
      router.push(notification.link)
    } else if (notification.type === 'order_update' || notification.title.includes('Order')) {
      router.push('/orders')
    } else if (notification.type === 'voucher_received') {
      router.push('/my-vouchers')
    } else if (notification.type === 'review_reply') {
      router.push('/reviews')
    }
    
    setShowNotifications(false)
  }

  // Handle admin notification click
  const handleAdminNotificationClick = async (notification: AdminNotification) => {
    if (!notification.is_read) {
      await markAdminNotificationAsRead(notification.id)
    }
    
    if (notification.link) {
      router.push(notification.link)
    }
    
    setShowAdminNotifications(false)
  }

  // Handle admin route redirect
  useEffect(() => {
    if (!isLoading && isOnAdminRoute && !isStaff) {
      router.push('/')
    }
  }, [isOnAdminRoute, isStaff, isLoading, router])

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true)
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      setSession(currentSession)

      if (currentSession?.user) {
        await fetchUserProfile(currentSession.user.id)
        await fetchWishlistCount(currentSession.user.id)
        await fetchNotifications(currentSession.user.id)
      } else {
        resetUserState()
      }
      setIsLoading(false)
    }

    loadUserData()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession)
        if (newSession?.user) {
          await fetchUserProfile(newSession.user.id)
          await fetchWishlistCount(newSession.user.id)
          await fetchNotifications(newSession.user.id)
        } else {
          resetUserState()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Fetch admin notifications when role changes
  useEffect(() => {
    if (isStaff) {
      void Promise.resolve().then(() => fetchAdminNotifications())

      // Subscribe to real-time changes
      const channel = supabase
        .channel('admin-notifications-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'admin_notifications' },
          () => fetchAdminNotifications()
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders' },
          () => fetchAdminNotifications()
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'products', filter: 'stock=lt.10' },
          () => fetchAdminNotifications()
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [isStaff])

  // Subscribe to real-time user notifications
  useEffect(() => {
    if (!session?.user?.id) return

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification
          setNotifications(prev => [newNotification, ...prev])
          setNotifCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.user?.id])

  // Profile real-time updates
  useEffect(() => {
    if (!session?.user?.id) return

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`
        },
        (payload) => {
          if (payload.new) {
            const profile = payload.new as ProfileRealtimePayload
            setUserAvatar(profile.avatar_url)
            const displayName = profile.first_name
              ? `${profile.first_name} ${profile.last_name || ''}`.trim()
              : profile.username || 'User'
            setUserName(displayName)
            setUserRole(profile.role)
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session?.user?.id])

  function resetUserState() {
    setUserRole(null)
    setUserAvatar(null)
    setUserName('')
    setWishlistCount(0)
    setNotifCount(0)
    setAdminNotifCount(0)
    setNotifications([])
    setAdminNotifications([])
  }

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      if (adminNotifMenuRef.current && !adminNotifMenuRef.current.contains(event.target as Node)) {
        setShowAdminNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try {
      localStorage.removeItem('cart')
      localStorage.removeItem('checkoutSummary')
      localStorage.removeItem('userOrders')
      localStorage.removeItem('userAddresses')
      localStorage.removeItem('pendingGcashOrder')
      localStorage.removeItem('currentPaymentIntentId')
      localStorage.removeItem('gcashReferenceNumber')

      if (clearCart) clearCart()

      await supabase.auth.signOut()

      setSession(null)
      resetUserState()
      setShowUserMenu(false)
      setShowNotifications(false)
      setShowAdminNotifications(false)
      setMobileMenuOpen(false)

      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
      window.location.href = '/'
    }
  }

  const isLoggedIn = !!session

  const handleProtectedAction = (action: () => void) => {
    if (!isLoggedIn) {
      router.push('/login')
      return
    }
    action()
  }

  const getAdminNotificationIcon = (type: AdminNotification['type']) => {
    switch (type) {
      case 'low_stock':
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />
      case 'new_order':
        return <Package className="h-4 w-4 text-green-400" />
      case 'pending_refund':
        return <CreditCard className="h-4 w-4 text-red-400" />
      case 'pending_review':
        return <Star className="h-4 w-4 text-purple-400" />
      default:
        return <Bell className="h-4 w-4 text-gray-400" />
    }
  }

  if (isAuthPage) return null

  if (isLoading) {
    return (
      <>
        <nav className="fixed top-0 left-0 z-50 w-full bg-black border-b border-yellow-500/20 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3 group">
                <img src="/logo.png" alt="ROCARS" className="w-10 h-10 object-contain transition-transform group-hover:scale-105" />
                <div className="hidden sm:block">
                  <h1 className="text-white font-bold text-lg tracking-wide">ROCARS</h1>
                  <p className="text-[10px] text-yellow-400 uppercase tracking-[0.25em]">AUTO PARTS</p>
                </div>
              </Link>
              <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        </nav>
        <div className="h-24" />
      </>
    )
  }

  const adminNavItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Products', href: '/admin/products', icon: ShoppingBag },
    { name: 'Orders', href: '/admin/orders', icon: Package },
    { name: 'Payments', href: '/admin/payments', icon: CreditCard },
    { name: 'Refunds', href: '/admin/refunds', icon: RefreshCw },
    { name: 'Reviews', href: '/admin/reviews', icon: Star },
    { name: 'Categories', href: '/admin/categories', icon: Tags },
    { name: 'Vouchers', href: '/admin/vouchers', icon: Gift },
    { name: 'Shipping', href: '/admin/shipping', icon: Truck },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ]
  const visibleAdminNavItems = adminNavItems.filter((item) => canAccessAdminPath(userRole, item.href))

  // ===================== SHOW ADMIN/STAFF NAVBAR =====================
  if (isOnAdminRoute) {
    if (!isStaff) return null
    
    return (
      <>
        <nav className="fixed top-0 left-0 z-50 w-full bg-black border-b border-yellow-500/20 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
            <div className="flex items-center justify-between gap-4">
              <Link href={adminHomeHref} className="flex items-center gap-3 shrink-0 group">
                <img src="/logo.png" alt="ROCARS" className="w-8 h-8 object-contain transition-transform group-hover:scale-105" />
                <div className="hidden sm:block">
                  <h1 className="text-white font-bold text-sm tracking-wide">ROCARS</h1>
                  <p className="text-[8px] text-yellow-400 uppercase tracking-[0.25em]">
                    {isAdmin ? 'ADMIN PANEL' : 'STAFF PANEL'}
                  </p>
                </div>
              </Link>

              <div className="hidden lg:flex items-center gap-1">
                {visibleAdminNavItems.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 group
                        ${isActive 
                          ? 'text-yellow-400' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      <item.icon className={`w-5 h-5 ${isActive ? 'text-yellow-400' : 'text-gray-500 group-hover:text-white'}`} />
                      <span className="text-[10px]">{item.name}</span>
                      {isActive && (
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-yellow-400 rounded-full" />
                      )}
                    </Link>
                  )
                })}
              </div>

              <div className="flex items-center gap-2">
                {/* Admin Notifications Dropdown */}
                <div className="relative" ref={adminNotifMenuRef}>
                  <button
                    onClick={() => setShowAdminNotifications(!showAdminNotifications)}
                    className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:border-yellow-400 hover:bg-white/10 transition"
                  >
                    <Bell className="h-4 w-4 text-gray-300" />
                    {adminNotifCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                        {adminNotifCount > 9 ? '9+' : adminNotifCount}
                      </span>
                    )}
                  </button>

                  {showAdminNotifications && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right rounded-xl border border-white/10 bg-black shadow-2xl z-50">
                      <div className="p-4 border-b border-white/10">
                        <div className="flex justify-between items-center">
                          <h3 className="text-white font-semibold">System Alerts</h3>
                          <div className="flex gap-2">
                            {adminNotifCount > 0 && (
                              <button
                                onClick={markAllAdminNotificationsAsRead}
                                className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                              >
                                <CheckCheck className="w-3 h-3" />
                                Mark all read
                              </button>
                            )}
                            {isAdmin && (
                              <Link
                                href="/admin/notifications"
                                onClick={() => setShowAdminNotifications(false)}
                                className="text-xs text-gray-400 hover:text-white"
                              >
                                View all
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="max-h-96 overflow-y-auto">
                        {loadingAdminNotifs ? (
                          <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-yellow-400 border-t-transparent mx-auto"></div>
                            <p className="text-xs text-gray-500 mt-2">Loading...</p>
                          </div>
                        ) : adminNotifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No system alerts</p>
                            <p className="text-xs text-gray-600 mt-1">All systems operational</p>
                          </div>
                        ) : (
                          adminNotifications.slice(0, 5).map((notif) => (
                            <div
                              key={notif.id}
                              className={`p-4 border-b border-white/10 transition cursor-pointer ${
                                !notif.is_read ? 'bg-white/5 hover:bg-white/10' : 'hover:bg-white/5'
                              }`}
                              onClick={() => handleAdminNotificationClick(notif)}
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                  {getAdminNotificationIcon(notif.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white">
                                    {notif.title}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1 break-words line-clamp-2">
                                    {notif.message}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-2">
                                    {new Date(notif.created_at).toLocaleDateString('en-PH', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {isAdmin && adminNotifications.length > 5 && (
                        <div className="p-3 border-t border-white/10">
                          <Link
                            href="/admin/notifications"
                            onClick={() => setShowAdminNotifications(false)}
                            className="block text-center text-xs text-yellow-400 hover:text-yellow-300"
                          >
                            View all {adminNotifications.length} notifications
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Admin/Staff User Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 hover:border-yellow-400 hover:bg-white/10 transition"
                  >
                    {userAvatar ? (
                      <img src={userAvatar} alt="Profile" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-gray-300" />
                    )}
                    <span className="hidden md:inline text-sm font-medium text-gray-300">
                      {userName || session?.user?.email?.split('@')[0]}
                    </span>
                    <ChevronDown className="h-3 w-3 text-gray-400 hidden md:block" />
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-white/10 bg-black shadow-2xl z-50">
                      <div className="p-2">
                        <div className="border-b border-white/10 px-3 py-2 mb-2">
                          <p className="text-xs text-gray-400">
                            {isAdmin ? 'Admin Access' : 'Staff Access'}
                          </p>
                          <p className="text-sm font-medium text-white truncate">
                            {userName || session?.user?.email?.split('@')[0]}
                          </p>
                          <p className="text-xs text-yellow-400 mt-1 capitalize">
                            {isAdmin ? 'Administrator' : 'Staff Member'}
                          </p>
                        </div>

                        {isAdmin && (
                          <Link href="/admin/staff" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition">
                            <UserCircle className="h-4 w-4" /> Staff Page
                          </Link>
                        )}

                        <Link href={adminHomeHref} onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition">
                          <LayoutDashboard className="h-4 w-4" /> {isAdmin ? 'Dashboard' : 'Staff Panel'}
                        </Link>

                        <Link href="/" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition">
                          <Home className="h-4 w-4" /> View Store
                        </Link>

                        <div className="border-t border-white/10 my-2"></div>

                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition"
                        >
                          <LogOut className="h-4 w-4" /> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:border-yellow-400 hover:bg-white/10 transition"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
                </button>
              </div>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-yellow-500/20 bg-black py-4 px-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {visibleAdminNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex flex-col items-center gap-2 p-3 text-gray-300 hover:bg-white/10 rounded-lg transition"
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-xs">{item.name}</span>
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    href="/admin/staff"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex flex-col items-center gap-2 p-3 text-gray-300 hover:bg-white/10 rounded-lg transition"
                  >
                    <UserCircle className="w-5 h-5" />
                    <span className="text-xs">Staff Page</span>
                  </Link>
                )}
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex flex-col items-center gap-2 p-3 text-gray-300 hover:bg-white/10 rounded-lg transition"
                >
                  <Home className="w-5 h-5" />
                  <span className="text-xs">View Store</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex flex-col items-center gap-2 p-3 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-xs">Logout</span>
                </button>
              </div>
            </div>
          )}
        </nav>
        <div className="h-16" />
      </>
    )
  }

  // ===================== REGULAR USER NAVBAR =====================
  return (
    <>
      <nav className="fixed top-0 left-0 z-50 w-full bg-black border-b border-yellow-500/20 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-3 shrink-0 group">
              <img src="/logo.png" alt="ROCARS" className="w-10 h-10 object-contain transition-transform group-hover:scale-105" />
              <div className="hidden sm:block">
                <h1 className="text-white font-bold text-lg tracking-wide">ROCARS</h1>
                <p className="text-[10px] text-yellow-400 uppercase tracking-[0.25em]">AUTO PARTS</p>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <Link href="/" className="text-gray-300 hover:text-white transition-colors">Home</Link>
              <Link href="/products" className="text-gray-300 hover:text-white transition-colors">Products</Link>
              <Link href="/support" className="text-gray-300 hover:text-white transition-colors">Support</Link>
              <Link href="/shipping" className="text-gray-300 hover:text-white transition-colors">Shipping</Link>
              <Link href="/about" className="text-gray-300 hover:text-white transition-colors">About</Link>
            </div>

            <div className="flex items-center gap-2">
              {isStaff && (
                <Link
                  href={adminHomeHref}
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-400/10 hover:bg-yellow-400/20 transition"
                  title={isAdmin ? "Admin Dashboard" : "Staff Panel"}
                >
                  <LayoutDashboard className="h-5 w-5 text-yellow-400" />
                </Link>
              )}

              <button
                onClick={() => handleProtectedAction(() => router.push('/wishlist'))}
                className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:border-yellow-400 hover:bg-white/10 transition"
              >
                <Heart className="h-5 w-5 text-gray-300" />
                {isLoggedIn && wishlistCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-bold text-black">
                    {wishlistCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleProtectedAction(() => router.push('/cart'))}
                className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400 text-black hover:bg-yellow-500 transition"
              >
                <ShoppingCart className="h-5 w-5" />
                {isLoggedIn && cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black text-white text-[10px] font-bold">
                    {cartCount}
                  </span>
                )}
              </button>

              {/* User Notifications Dropdown */}
              {isLoggedIn && (
                <div className="relative" ref={notifMenuRef}>
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:border-yellow-400 hover:bg-white/10 transition"
                  >
                    <Bell className="h-5 w-5 text-gray-300" />
                    {notifCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                        {notifCount > 9 ? '9+' : notifCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right rounded-xl border border-white/10 bg-black shadow-2xl z-50">
                      <div className="p-4 border-b border-white/10">
                        <div className="flex justify-between items-center">
                          <h3 className="text-white font-semibold">Notifications</h3>
                          {notifCount > 0 && (
                            <button
                              onClick={markAllAsRead}
                              className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                            >
                              <CheckCheck className="w-3 h-3" />
                              Mark all as read
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="max-h-96 overflow-y-auto">
                        {loadingNotifs ? (
                          <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-yellow-400 border-t-transparent mx-auto"></div>
                            <p className="text-xs text-gray-500 mt-2">Loading...</p>
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className={`p-4 border-b border-white/10 hover:bg-white/5 transition cursor-pointer ${
                                !notif.is_read ? 'bg-white/5' : ''
                              }`}
                              onClick={() => handleNotificationClick(notif)}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full mt-2 ${!notif.is_read ? 'bg-yellow-400' : 'bg-gray-600'}`} />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-white">
                                    {notif.title}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {notif.message}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-2">
                                    {new Date(notif.created_at).toLocaleDateString('en-PH', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {notifications.length > 0 && (
                        <div className="p-3 border-t border-white/10">
                          <Link
                            href="/notifications"
                            onClick={() => setShowNotifications(false)}
                            className="block text-center text-xs text-yellow-400 hover:text-yellow-300"
                          >
                            View all notifications
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* USER MENU */}
              <div className="relative" ref={userMenuRef}>
                {!session ? (
                  <Link
                    href="/login"
                    className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white hover:border-yellow-400 hover:bg-white/10 transition"
                  >
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">Login</span>
                  </Link>
                ) : (
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 hover:border-yellow-400 hover:bg-white/10 transition"
                  >
                    {userAvatar ? (
                      <img src={userAvatar} alt="Profile" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-gray-300" />
                    )}
                    <span className="hidden sm:inline text-sm font-medium text-gray-300">
                      {userName || session.user.email?.split('@')[0]}
                    </span>
                    <ChevronDown className="h-3 w-3 text-gray-400" />
                  </button>
                )}

                {session && showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-white/10 bg-black shadow-2xl z-50">
                    <div className="p-2">
                      <div className="border-b border-white/10 px-3 py-2 mb-2">
                        <p className="text-xs text-gray-400">Signed in as</p>
                        <p className="text-sm font-medium text-white truncate">
                          {userName || session.user.email?.split('@')[0]}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{session.user.email}</p>
                        {isStaff && (
                          <p className="text-xs text-yellow-400 mt-1 capitalize">
                            {isAdmin ? 'Admin Account' : 'Staff Account'}
                          </p>
                        )}
                      </div>

                      <Link href="/profile" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition">
                        <UserCircle className="h-4 w-4" /> My Profile
                      </Link>

                      <Link href="/orders" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition">
                        <Package className="h-4 w-4" /> My Orders
                      </Link>

                      <Link href="/reviews" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition">
                        <Star className="h-4 w-4" /> My Reviews
                      </Link>

                      <Link href="/wishlist" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition">
                        <Heart className="h-4 w-4" /> Wishlist
                      </Link>

                      <Link href="/my-vouchers" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition">
                        <Ticket className="h-4 w-4" /> My Vouchers
                      </Link>

                      {isStaff && (
                        <>
                          <div className="border-t border-white/10 my-2"></div>
                          <Link href={adminHomeHref} onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition">
                            <LayoutDashboard className="h-4 w-4" /> {isAdmin ? 'Admin Dashboard' : 'Staff Panel'}
                          </Link>
                          {isAdmin && (
                            <Link href="/admin/staff" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 rounded-lg transition">
                              <UserCircle className="h-4 w-4" /> Staff Page
                            </Link>
                          )}
                        </>
                      )}

                      <div className="border-t border-white/10 my-2"></div>

                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition"
                      >
                        <LogOut className="h-4 w-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:border-yellow-400 hover:bg-white/10 transition"
              >
                {mobileMenuOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-yellow-500/20 bg-black py-4 px-4">
            <div className="flex flex-col gap-2">
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Home</Link>
              <Link href="/products" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Products</Link>
              <Link href="/support" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Support</Link>
              <Link href="/shipping" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Shipping</Link>
              <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">About</Link>
              {isLoggedIn && (
                <>
                  <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Profile</Link>
                  <Link href="/orders" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Orders</Link>
                  <Link href="/reviews" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Reviews</Link>
                  <Link href="/wishlist" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Wishlist</Link>
                  <Link href="/my-vouchers" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">My Vouchers</Link>
                  {isStaff && (
                    <>
                      <Link href={adminHomeHref} onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-yellow-400 hover:bg-yellow-400/10 rounded-lg">{isAdmin ? 'Admin Panel' : 'Staff Panel'}</Link>
                      {isAdmin && (
                        <Link href="/admin/staff" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-yellow-400 hover:bg-yellow-400/10 rounded-lg">Staff Page</Link>
                      )}
                    </>
                  )}
                  <button onClick={handleLogout} className="px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg text-left">Sign Out</button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
      <div className="h-24" />
    </>
  )
}
