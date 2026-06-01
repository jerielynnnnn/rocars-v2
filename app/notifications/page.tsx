'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Bell,
  ShoppingBag,
  Percent,
  Package,
  MessageSquare,
  Heart,
  Loader2,
  CheckCheck,
  Trash2,
} from 'lucide-react'

type Notification = {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  // ================= FETCH USER =================
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)
      await fetchNotifications(user.id)
      setLoading(false)
    }

    init()
  }, [])

  // ================= FETCH NOTIFICATIONS =================
  const fetchNotifications = async (uid: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setNotifications(data)
    }
  }

  // ================= REAL-TIME LISTENER =================
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // ================= MARK AS READ =================
  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      )
    )

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
  }

  // ================= DELETE =================
  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))

    await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
  }

  // ================= ICON PICKER =================
  const getIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <ShoppingBag className="w-5 h-5" />
      case 'promo':
        return <Percent className="w-5 h-5" />
      case 'product':
        return <Package className="w-5 h-5" />
      case 'message':
        return <MessageSquare className="w-5 h-5" />
      case 'wishlist':
        return <Heart className="w-5 h-5" />
      default:
        return <Bell className="w-5 h-5" />
    }
  }

  // ================= LOADING =================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notifications
          </h1>
          <p className="text-gray-600">
            All your updates, orders, and alerts in one place
          </p>
        </div>

        {/* EMPTY STATE */}
        {notifications.length === 0 && (
          <div className="bg-white border rounded-xl p-10 text-center">
            <Bell className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">No notifications yet</p>
          </div>
        )}

        {/* LIST */}
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`bg-white border rounded-xl p-4 flex items-start justify-between gap-4 ${
                !n.is_read ? 'border-black' : 'border-gray-200'
              }`}
            >

              {/* LEFT */}
              <div className="flex gap-3">
                <div className="text-gray-500 mt-1">
                  {getIcon(n.type)}
                </div>

                <div>
                  <h3 className="font-semibold">{n.title}</h3>
                  <p className="text-sm text-gray-600">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex items-center gap-2">

                {!n.is_read && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="p-2 rounded-lg hover:bg-gray-100"
                    title="Mark as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => deleteNotification(n.id)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}