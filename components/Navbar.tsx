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
  Search,
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
  Star,
  Tags,
  Truck,
  Settings,
  CheckCheck,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useCart } from '@/context/CartContext'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { cartCount, clearCart } = useCart()

  const [session, setSession] = useState<Session | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [wishlistCount, setWishlistCount] = useState(0)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [notifCount, setNotifCount] = useState(0)
  const [adminNotifCount, setAdminNotifCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)

  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifMenuRef = useRef<HTMLDivElement>(null)

  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isAdmin = userRole === 'admin'
  const isOnAdminRoute = pathname?.startsWith('/admin')

  // Fetch user profile
  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, avatar_url, first_name, last_name, username')
      .eq('id', userId)
      .single()

    if (!error && data) {
      console.log('Fetched user role:', data.role)
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
        setNotifications(data)
        const unreadCount = data.filter(n => !n.is_read).length
        setNotifCount(unreadCount)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoadingNotifs(false)
    }
  }

  // Fetch admin notifications
  const fetchAdminNotifications = async () => {
    if (!isAdmin) return

    const { count: lowStockCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .lt('stock', 10)
      .eq('is_active', true)

    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const { count: newOrdersCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('order_status', 'pending_payment')
      .gte('created_at', oneDayAgo.toISOString())

    const { count: pendingRefundsCount } = await supabase
      .from('refunds')
      .select('*', { count: 'exact', head: true })
      .eq('refund_status', 'pending')

    const { count: unreadNotifs } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .is('user_id', null)

    const total = (lowStockCount || 0) + (newOrdersCount || 0) + (pendingRefundsCount || 0) + (unreadNotifs || 0)
    setAdminNotifCount(total)
  }

  // Mark single notification as read
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

  // Mark all notifications as read
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

  // Handle admin route redirect
  useEffect(() => {
    if (!isLoading && isOnAdminRoute && !isAdmin) {
      router.push('/')
    }
  }, [isOnAdminRoute, isAdmin, isLoading, router])

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
    if (isAdmin) {
      fetchAdminNotifications()

      const channel = supabase
        .channel('admin-notifications')
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
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'refunds' },
          () => fetchAdminNotifications()
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          () => {
            fetchAdminNotifications()
            if (session?.user?.id) {
              fetchNotifications(session.user.id)
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [isAdmin, session?.user?.id])

  // Subscribe to real-time notifications for the user
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
          setNotifications(prev => [payload.new as any, ...prev])
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
            setUserAvatar(payload.new.avatar_url)
            const displayName = payload.new.first_name
              ? `${payload.new.first_name} ${payload.new.last_name || ''}`.trim()
              : payload.new.username || 'User'
            setUserName(displayName)
            setUserRole(payload.new.role)
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session?.user?.id])

  const resetUserState = () => {
    setUserRole(null)
    setUserAvatar(null)
    setUserName('')
    setWishlistCount(0)
    setNotifCount(0)
    setAdminNotifCount(0)
    setNotifications([])
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
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchTerm)}`)
      setSearchTerm('')
      setMobileMenuOpen(false)
    }
  }

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

  // Don't show navbar on auth pages
  if (isAuthPage) return null

  // Show loading state
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

  // Admin navigation items
  const adminNavItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Products', href: '/admin/products', icon: ShoppingBag },
    { name: 'Orders', href: '/admin/orders', icon: Package },
    { name: 'Payments', href: '/admin/payments', icon: CreditCard },
    { name: 'Reviews', href: '/admin/reviews', icon: Star },
    { name: 'Categories', href: '/admin/categories', icon: Tags },
    { name: 'Vouchers', href: '/admin/vouchers', icon: Gift },
    { name: 'Shipping', href: '/admin/shipping', icon: Truck },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ]

  // ===================== SHOW ADMIN NAVBAR IF ON ADMIN ROUTE =====================
  if (isOnAdminRoute) {
    if (!isAdmin) {
      return null
    }
    
    return (
      <>
        <nav className="fixed top-0 left-0 z-50 w-full bg-black border-b border-yellow-500/20 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
            <div className="flex items-center justify-between gap-4">
              <Link href="/admin/dashboard" className="flex items-center gap-3 shrink-0 group">
                <img src="/logo.png" alt="ROCARS" className="w-8 h-8 object-contain transition-transform group-hover:scale-105" />
                <div className="hidden sm:block">
                  <h1 className="text-white font-bold text-sm tracking-wide">ROCARS</h1>
                  <p className="text-[8px] text-yellow-400 uppercase tracking-[0.25em]">ADMIN PANEL</p>
                </div>
              </Link>

              <div className="hidden lg:flex items-center gap-1">
                {adminNavItems.map((item) => {
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
                <button
                  onClick={() => router.push('/admin/notifications')}
                  className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:border-yellow-400 hover:bg-white/10 transition"
                >
                  <Bell className="h-4 w-4 text-gray-300" />
                  {adminNotifCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                      {adminNotifCount > 9 ? '9+' : adminNotifCount}
                    </span>
                  )}
                </button>

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
                          <p className="text-xs text-gray-400">Admin Access</p>
                          <p className="text-sm font-medium text-white truncate">
                            {userName || session?.user?.email?.split('@')[0]}
                          </p>
                          <p className="text-xs text-yellow-400 mt-1">Administrator</p>
                        </div>

                        <Link href="/admin/dashboard" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition">
                          <LayoutDashboard className="h-4 w-4" /> Dashboard
                        </Link>

                        <Link href="/admin/vouchers" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition">
                          <Gift className="h-4 w-4" /> Manage Vouchers
                        </Link>

                        <Link href="/admin/notifications" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition">
                          <Bell className="h-4 w-4" /> Notifications
                          {adminNotifCount > 0 && (
                            <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                              {adminNotifCount}
                            </span>
                          )}
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
                {adminNavItems.map((item) => (
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
              <Link href="/support" className="text-gray-300 hover:text-white transition-colors">Support</Link>
              <Link href="/shipping" className="text-gray-300 hover:text-white transition-colors">Shipping</Link>
              <Link href="/about" className="text-gray-300 hover:text-white transition-colors">About</Link>
            </div>

            <form onSubmit={handleSearch} className="flex-1 max-w-[320px]">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search auto parts..."
                  className="w-full h-11 rounded-xl border border-white/10 bg-white/10 pl-11 pr-4 text-sm text-white placeholder:text-gray-400 focus:border-yellow-400 focus:bg-black focus:outline-none transition"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </form>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-400/10 hover:bg-yellow-400/20 transition"
                  title="Admin Dashboard"
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
                              onClick={() => {
                                if (!notif.is_read) markAsRead(notif.id)
                                if (notif.title === 'Order Status Updated') {
                                  router.push('/orders')
                                  setShowNotifications(false)
                                }
                              }}
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
                        {isAdmin && (
                          <p className="text-xs text-yellow-400 mt-1">Admin Account</p>
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

                      {/* FIXED: My Vouchers button - now links to /my-vouchers */}
                      <Link href="/my-vouchers" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition">
                        <Ticket className="h-4 w-4" /> My Vouchers
                      </Link>

                      {isAdmin && (
                        <>
                          <div className="border-t border-white/10 my-2"></div>
                          <Link href="/admin/dashboard" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition">
                            <LayoutDashboard className="h-4 w-4" /> Admin Dashboard
                          </Link>
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
              <Link href="/support" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Support</Link>
              <Link href="/shipping" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Shipping</Link>
              <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">About</Link>
              {isLoggedIn && (
                <>
                  <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Profile</Link>
                  <Link href="/orders" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Orders</Link>
                  <Link href="/reviews" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Reviews</Link>
                  <Link href="/wishlist" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">Wishlist</Link>
                  {/* FIXED: My Vouchers button in mobile menu */}
                  <Link href="/my-vouchers" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-gray-300 hover:bg-white/10 rounded-lg">My Vouchers</Link>
                  {isAdmin && (
                    <Link href="/admin/dashboard" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-yellow-400 hover:bg-yellow-400/10 rounded-lg">Admin Panel</Link>
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