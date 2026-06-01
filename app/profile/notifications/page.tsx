'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function ProfileNotificationsRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/notifications')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-black mx-auto mb-4" />
        <p className="text-gray-600">Redirecting to notifications...</p>
      </div>
    </div>
  )
}