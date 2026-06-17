'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Package,
  Star,
  Ticket,
  Trash2,
} from 'lucide-react'

interface UserNotification {
  id: number
  title: string
  message: string
  is_read: boolean
  created_at: string
  user_id: string
  type?: string | null
  link?: string | null
}

const NOTIFICATIONS_PER_PAGE = 10

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalNotifications, setTotalNotifications] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async (currentUserId?: string) => {
    const activeUserId = currentUserId || userId
    if (!activeUserId) return

    setLoading(true)

    try {
      const from = (currentPage - 1) * NOTIFICATIONS_PER_PAGE
      const to = from + NOTIFICATIONS_PER_PAGE - 1

      const [{ data, error, count }, { count: unreadTotal, error: unreadError }] =
        await Promise.all([
          supabase
            .from('notifications')
            .select('*', { count: 'exact' })
            .eq('user_id', activeUserId)
            .order('created_at', { ascending: false })
            .range(from, to),
          supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', activeUserId)
            .eq('is_read', false),
        ])

      if (error) {
        console.error('Error fetching notifications:', error)
        return
      }

      if (unreadError) {
        console.error('Error fetching unread notification count:', unreadError)
      }

      setNotifications((data || []) as UserNotification[])
      setTotalNotifications(count || 0)
      setUnreadCount(unreadTotal || 0)
    } finally {
      setLoading(false)
    }
  }, [currentPage, userId])

  const markAsRead = async (id: number) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)

    if (!error) {
      const wasUnread = notifications.some(
        notification => notification.id === id && !notification.is_read
      )

      setNotifications(prev =>
        prev.map(notification =>
          notification.id === id ? { ...notification, is_read: true } : notification
        )
      )

      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    }
  }

  const markAllAsRead = async () => {
    if (!userId) return

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (!error) {
      setNotifications(prev => prev.map(notification => ({ ...notification, is_read: true })))
      setUnreadCount(0)
    }
  }

  const deleteNotification = async (id: number) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (!error) {
      const nextTotal = Math.max(0, totalNotifications - 1)
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / NOTIFICATIONS_PER_PAGE))

      setTotalNotifications(nextTotal)

      if (currentPage > nextTotalPages) {
        setCurrentPage(nextTotalPages)
        return
      }

      setNotifications(prev => prev.filter(notification => notification.id !== id))

      if (notifications.length === 1 && nextTotal > 0) {
        void fetchNotifications()
      }
    }
  }

  const openNotification = async (notification: UserNotification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }

    if (notification.link) {
      router.push(notification.link)
      return
    }

    if (notification.type === 'voucher_received') {
      router.push('/my-vouchers')
    } else if (notification.type === 'review_reply') {
      router.push('/reviews')
    } else {
      router.push('/orders')
    }
  }

  const getIcon = (notification: UserNotification) => {
    if (notification.type === 'voucher_received') {
      return <Ticket className="h-5 w-5 text-yellow-500" />
    }

    if (notification.type === 'review_reply') {
      return <Star className="h-5 w-5 text-blue-500" />
    }

    if (notification.type === 'payment_update' || notification.title.toLowerCase().includes('payment')) {
      return <CreditCard className="h-5 w-5 text-green-500" />
    }

    if (notification.title.toLowerCase().includes('order')) {
      return <Package className="h-5 w-5 text-black" />
    }

    return <Bell className="h-5 w-5 text-gray-500" />
  }

  useEffect(() => {
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/login')
        return
      }

      setUserId(session.user.id)
      await fetchNotifications(session.user.id)
    }

    void Promise.resolve().then(() => loadSession())
  }, [fetchNotifications, router])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchNotifications(userId)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchNotifications, userId])

  const totalPages = Math.max(1, Math.ceil(totalNotifications / NOTIFICATIONS_PER_PAGE))
  const pageStart = totalNotifications === 0 ? 0 : (currentPage - 1) * NOTIFICATIONS_PER_PAGE + 1
  const pageEnd = Math.min(currentPage * NOTIFICATIONS_PER_PAGE, totalNotifications)

  return (
    <main className="min-h-screen bg-[#f6f6f4] px-4 py-8 text-black sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="mt-1 text-sm text-gray-500">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up!'}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void fetchNotifications()}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-black"
            >
              Refresh
            </button>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllAsRead()}
                className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all as read
              </button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-20 text-center">
              <Bell className="mx-auto mb-4 h-14 w-14 text-gray-300" />
              <h2 className="text-lg font-semibold">No notifications yet</h2>
              <p className="mt-1 text-sm text-gray-500">Order updates, voucher alerts, and messages will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-5 transition ${notification.is_read ? 'hover:bg-gray-50' : 'bg-yellow-50/60 hover:bg-yellow-50'}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-gray-100 p-2.5">
                      {getIcon(notification)}
                    </div>

                    <button
                      onClick={() => void openNotification(notification)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-gray-900">{notification.title}</h2>
                        {!notification.is_read && (
                          <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-black">
                            New
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-gray-600">{notification.message}</p>
                      <p className="mt-2 text-xs text-gray-400">
                        {new Date(notification.created_at).toLocaleString('en-PH')}
                      </p>
                    </button>

                    <div className="flex shrink-0 gap-1">
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
              ))}
            </div>
          )}

          {totalNotifications > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Showing {pageStart} to {pageEnd} of {totalNotifications} notifications
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
    </main>
  )
}
