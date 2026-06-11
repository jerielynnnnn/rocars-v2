import { supabase } from '@/lib/supabase'

type AdminActivityPayload = {
  action: string
  target_type?: string
  target_id?: string | number | null
  details?: Record<string, unknown>
}

export async function logAdminActivity(payload: AdminActivityPayload) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return

  const response = await fetch('/api/admin/activity-logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const result = await response.json().catch(() => null)
    console.error('Failed to log admin activity:', result?.error || response.statusText)
  }
}
