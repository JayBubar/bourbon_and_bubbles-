// All event dates are Eastern time. Date-only values are stored as 'YYYY-MM-DD'.
const TZ = 'America/New_York'

export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...opts,
  })
}

/** "Today", "Tomorrow", "Yesterday", "3 days ago", or "Mon, Nov 3". */
export function relativeDay(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Today'
  if (iso === addDays(today, 1)) return 'Tomorrow'
  if (iso === addDays(today, -1)) return 'Yesterday'
  const diff = Math.round((Date.parse(iso) - Date.parse(today)) / 86_400_000)
  if (diff < 0) return `${-diff} days ago`
  return formatDate(iso, { weekday: 'short', year: diff > 300 ? 'numeric' : undefined })
}

export function formatDateTime(ts: string): string {
  return new Date(ts).toLocaleString('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const EVENT_DATE = '2027-04-09'
