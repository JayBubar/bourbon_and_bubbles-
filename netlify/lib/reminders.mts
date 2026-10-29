// Shared logic for the evening task-reminder digest (scheduled run + admin test send).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const TZ = 'America/New_York'

export function env(name: string): string {
  const v = Netlify.env.get(name)
  if (!v) throw new Error(`Missing environment variable ${name}`)
  return v
}

export function serviceClient(): SupabaseClient {
  return createClient(env('VITE_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Current date and hour in Eastern time. */
export function easternNow(): { date: string; hour: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function prettyDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

interface Task {
  title: string
  due_date: string
  assignee_id: string
}
interface User {
  id: string
  name: string
  email: string
}

export function digestHtml(user: User, overdue: Task[], tomorrow: Task[], appUrl: string): string {
  const list = (tasks: Task[], showDate: boolean) =>
    `<ul style="padding-left:20px;margin:8px 0 16px">${tasks
      .map((t) => `<li style="margin:4px 0">${esc(t.title)}${showDate ? ` <span style="color:#b02a3e">(due ${prettyDate(t.due_date)})</span>` : ''}</li>`)
      .join('')}</ul>`
  return `<!doctype html><html><body style="margin:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;color:#20232d">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="background:#1b2340;color:#e6cf94;padding:16px 20px;border-radius:12px 12px 0 0;font-family:Georgia,serif;font-size:20px">Bourbon &amp; Bubbles · Task reminder</div>
  <div style="background:#fff;padding:20px;border:1px solid #e6dcc4;border-top:0;border-radius:0 0 12px 12px">
    <p style="margin-top:0">Hi ${esc(user.name.split(' ')[0])},</p>
    ${tomorrow.length ? `<p style="margin-bottom:0"><strong>Due tomorrow</strong></p>${list(tomorrow, false)}` : ''}
    ${overdue.length ? `<p style="margin-bottom:0"><strong style="color:#7d1a28">Overdue</strong></p>${list(overdue, true)}` : ''}
    <p><a href="${appUrl}/tasks?view=mine" style="display:inline-block;background:#7d1a28;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Open my tasks</a></p>
    <p style="font-size:12px;color:#6b6f7a;margin-bottom:0">You get this because you have tasks in the Volunteer Hub. Turn reminders off under My profile.</p>
  </div>
</div></body></html>`
}

export async function sendEmail(to: string, subject: string, html: string): Promise<string> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('REMINDER_FROM'), to: [to], subject, html }),
  })
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? 'send failed'}`)
  return body.id ?? ''
}

function subjectFor(overdue: number, tomorrow: number): string {
  const parts = [tomorrow && `${tomorrow} due tomorrow`, overdue && `${overdue} overdue`].filter(Boolean)
  return `Bourbon & Bubbles: ${parts.join(', ')}`
}

/** Load open tasks due tomorrow or earlier, grouped by assignee. */
async function loadDigests(db: SupabaseClient, today: string, onlyUserId?: string) {
  const tomorrow = addDays(today, 1)
  let usersQ = db.from('allowed_users').select('id, name, email, reminders_enabled')
  if (onlyUserId) usersQ = usersQ.eq('id', onlyUserId)
  const [{ data: users, error: ue }, { data: tasks, error: te }] = await Promise.all([
    usersQ,
    db.from('tasks').select('title, due_date, assignee_id').neq('status', 'done').not('assignee_id', 'is', null).lte('due_date', tomorrow).order('due_date'),
  ])
  if (ue || te) throw new Error((ue ?? te)!.message)
  return (users ?? []).map((u) => {
    const mine = (tasks ?? []).filter((t) => t.assignee_id === u.id) as Task[]
    return {
      user: u as User & { reminders_enabled: boolean },
      overdue: mine.filter((t) => t.due_date < today),
      tomorrow: mine.filter((t) => t.due_date === tomorrow),
    }
  })
}

/** The nightly run: one digest per opted-in user with something due, at most once per day. */
export async function runReminders(appUrl: string) {
  const db = serviceClient()
  const { date: today } = easternNow()
  const { data: settings } = await db.from('settings').select('reminders_enabled').eq('id', 1).single()
  if (!settings?.reminders_enabled) return { skipped: 'reminders are turned off in Settings' }

  const { data: already } = await db.from('reminder_log').select('user_id').eq('sent_on', today)
  const sentToday = new Set((already ?? []).map((r) => r.user_id))

  const results: { email: string; status: string }[] = []
  for (const d of await loadDigests(db, today)) {
    const count = d.overdue.length + d.tomorrow.length
    if (!d.user.reminders_enabled || count === 0 || sentToday.has(d.user.id)) continue
    try {
      const id = await sendEmail(d.user.email, subjectFor(d.overdue.length, d.tomorrow.length), digestHtml(d.user, d.overdue, d.tomorrow, appUrl))
      await db.from('reminder_log').insert({ user_id: d.user.id, sent_on: today, task_count: count, provider_id: id })
      results.push({ email: d.user.email, status: 'sent' })
    } catch (e) {
      results.push({ email: d.user.email, status: (e as Error).message })
    }
  }
  return { today, results }
}

/** Admin test: send the caller their own digest now (sample text if nothing is due). Not logged. */
export async function sendTestDigest(userId: string, appUrl: string) {
  const db = serviceClient()
  const { date: today } = easternNow()
  const [d] = await loadDigests(db, today, userId)
  if (!d) throw new Error('User not found')
  const empty = d.overdue.length + d.tomorrow.length === 0
  const sample = [{ title: '(sample) Nothing of yours is due tomorrow or overdue right now', due_date: addDays(today, 1), assignee_id: userId }]
  const subject = empty ? 'Bourbon & Bubbles: test reminder' : `[Test] ${subjectFor(d.overdue.length, d.tomorrow.length)}`
  const id = await sendEmail(d.user.email, subject, digestHtml(d.user, d.overdue, empty ? sample : d.tomorrow, appUrl))
  return { sentTo: d.user.email, overdue: d.overdue.length, tomorrow: d.tomorrow.length, providerId: id }
}
