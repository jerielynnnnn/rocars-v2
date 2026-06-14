export const APP_TIME_ZONE = 'Asia/Manila'

export function nowIso() {
  return new Date().toISOString()
}

export function formatDateTimePH(date: string | Date | null | undefined) {
  if (!date) return 'N/A'

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatLongDateTimePH(date: string | Date | null | undefined) {
  if (!date) return 'N/A'

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatDatePH(date: string | Date | null | undefined) {
  if (!date) return 'N/A'

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatShortDatePH(date: string | Date | null | undefined) {
  if (!date) return 'N/A'

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatTimePH(date: string | Date | null | undefined) {
  if (!date) return ''

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}
