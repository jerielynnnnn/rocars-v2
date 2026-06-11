'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Bell, Package, CreditCard, Star, AlertTriangle, CheckCheck, Trash2, Eye } from 'lucide-react'

interface AdminNotification {
  id: string
  type: 'low_stock' | 'new_order' | 'pending_refund' | 'pending_review'
  title: string
  message: string
  is_read: boolean
  created_at: string
  link: string
  metadata?: any
}

export default function AdminNotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setNotifications(data as AdminNotification[])
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('admin_notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
    }
  }

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('admin_notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('is_read', false)

    if (!error) {
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      )
    }
  }

  const deleteNotification = async (id: string) => {
    const { error } = await supabase
      .from('admin_notifications')
      .delete()
      .eq('id', id)

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'low_stock':
        return <AlertTriangle className="h-5 w-5 text-red-400" />
      case 'new_order':
        return <Package className="h-5 w-5 text-green-400" />
      case 'pending_refund':
        return <CreditCard className="h-5 w-5 text-purple-400" />
      case 'pending_review':
        return <Star className="h-5 w-5 text-blue-400" />
      default:
        return <Bell className="h-5 w-5 text-gray-400" />
    }
  }

  useEffect(() => {
    fetchNotifications()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('admin-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_notifications' },
        () => fetchNotifications()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-gray-400 text-sm mt-1">
            System alerts and updates
          </p>
        </div>
        <div className="flex gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400/10 border border-yellow-400/30 rounded-lg text-yellow-400 hover:bg-yellow-400/20 transition"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all as read
            </button>
          )}
          <button
            onClick={fetchNotifications}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-300 hover:bg-white/10 transition"
          >
            <Bell className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent"></div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 bg-black/30 rounded-xl border border-white/10">
          <Bell className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No notifications</h3>
          <p className="text-gray-400">All caught up! No new alerts to display.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-black/30 border rounded-xl p-4 transition ${
                !notification.is_read
                  ? 'border-yellow-400/30 bg-yellow-400/5'
                  : 'border-white/10'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-white font-semibold">
                        {notification.title}
                      </h3>
                      <p className="text-gray-400 text-sm mt-1">
                        {notification.message}
                      </p>
                      <p className="text-gray-500 text-xs mt-2">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-1.5 text-gray-400 hover:text-yellow-400 transition"
                          title="Mark as read"
                        >
                          <CheckCheck className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {notification.link && (
                        <button
                          onClick={() => router.push(notification.link)}
                          className="p-1.5 text-gray-400 hover:text-blue-400 transition"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}