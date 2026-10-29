import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { useTotals, raised } from '../lib/totals'
import { addDays, formatDateTime, todayISO } from '../lib/dates'
import { money } from '../lib/format'

interface Activity {
  id: number
  summary: string
  created_at: string
  actor: { name: string } | null
}

export default function Dashboard() {
  const { me, isAdmin } = useAuth()
  const { settings } = useSettings()
  const { totals } = useTotals()
  const [activity, setActivity] = useState<Activity[]>([])
  const [tasks, setTasks] = useState({ overdue: 0, week: 0, myOverdue: 0, myWeek: 0 })
  const [budget, setBudget] = useState<{ planned: number; spent: number } | null>(null)

  useEffect(() => {
    supabase
      .from('activity_log')
      .select('id, summary, created_at, actor:allowed_users(name)')
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => setActivity((data as unknown as Activity[]) ?? []))

    const today = todayISO()
    supabase
      .from('tasks')
      .select('due_date, assignee_id')
      .neq('status', 'done')
      .lte('due_date', addDays(today, 7))
      .then(({ data }) => {
        const rows = data ?? []
        const mine = rows.filter((r) => r.assignee_id === me?.id)
        const late = (r: { due_date: string | null }) => (r.due_date ?? '') < today
        setTasks({
          overdue: rows.filter(late).length,
          week: rows.filter((r) => !late(r)).length,
          myOverdue: mine.filter(late).length,
          myWeek: mine.filter((r) => !late(r)).length,
        })
      })
  }, [me])

  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('budget_items')
      .select('estimated_amount, actual_amount')
      .then(({ data }) =>
        setBudget({
          planned: (data ?? []).reduce((n, r) => n + Number(r.estimated_amount), 0),
          spent: (data ?? []).reduce((n, r) => n + Number(r.actual_amount ?? 0), 0),
        }),
      )
  }, [isAdmin])

  const eventStart = settings ? new Date(settings.event_starts_at) : new Date('2027-04-09T22:00:00Z')
  const days = Math.max(0, Math.ceil((eventStart.getTime() - Date.now()) / 86_400_000))
  const capacity = settings?.capacity ?? 140
  const goal = Number(settings?.revenue_goal ?? 50000)
  const seats = totals ? totals.ticketsSold + totals.sponsorSeats : 0
  const raisedNow = totals ? raised(totals) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl">Welcome, {me?.name.split(' ')[0]}</h1>
        <p className="mt-1 text-navy/70">
          <span className="font-semibold text-burgundy">{days} days</span> until {settings?.event_name ?? 'Bourbon & Bubbles'} ·{' '}
          {eventStart.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile to="/tickets" title="Seats committed">
          <Big>{seats} <Small>of {capacity}</Small></Big>
          <Bar value={seats} max={capacity} tone={seats > capacity ? 'bg-rose' : 'bg-navy'} />
          <Small>
            {totals?.ticketsSold ?? 0} tickets sold + {totals?.sponsorSeats ?? 0} sponsor seats
            {seats > capacity && <span className="font-semibold text-rose"> · over capacity by {seats - capacity}</span>}
          </Small>
        </Tile>

        <Tile title="Raised">
          <Big>{money(raisedNow)} <Small>of {money(goal)}</Small></Big>
          <Bar value={raisedNow} max={goal} tone="bg-burgundy" />
          <Small>Tickets collected + sponsorships committed. Auction items (est. {money(totals?.auctionValue ?? 0)}) not counted as cash.</Small>
        </Tile>

        <Tile to="/outreach?kind=sponsor" title="Sponsorships">
          <Big>{money(totals?.sponsorCommitted ?? 0)} <Small>committed</Small></Big>
          <Bar value={totals?.sponsorPaid ?? 0} max={Math.max(totals?.sponsorCommitted ?? 0, 1)} tone="bg-emerald-600" />
          <Small>{money(totals?.sponsorPaid ?? 0)} paid · {totals?.sponsorsYes ?? 0} sponsor{totals?.sponsorsYes === 1 ? '' : 's'}</Small>
        </Tile>

        <Tile to="/outreach?kind=auction" title="Silent auction">
          <Big>{totals?.auctionItems ?? 0} <Small>items secured</Small></Big>
          <Bar value={totals?.auctionItemsReceived ?? 0} max={Math.max(totals?.auctionItems ?? 0, 1)} tone="bg-gold" />
          <Small>
            {totals?.auctionItemsReceived ?? 0} received · {totals?.auctionDonorsYes ?? 0} donors · est. {money(totals?.auctionValue ?? 0)}
          </Small>
        </Tile>

        <Tile to="/tasks" title="Tasks">
          <div className="flex gap-6">
            <div>
              <Big tone={tasks.overdue ? 'text-rose' : undefined}>{tasks.overdue}</Big>
              <Small>overdue</Small>
            </div>
            <div>
              <Big>{tasks.week}</Big>
              <Small>due this week</Small>
            </div>
          </div>
          <Small>
            Yours: {tasks.myOverdue} overdue, {tasks.myWeek} this week
          </Small>
        </Tile>

        {isAdmin && budget && (
          <Tile to="/budget" title="Budget (admins only)">
            <Big>{money(budget.spent)} <Small>of {money(budget.planned)} planned</Small></Big>
            <Bar value={budget.spent} max={Math.max(budget.planned, 1)} tone={budget.spent > budget.planned ? 'bg-rose' : 'bg-navy'} />
            <Small>{money(budget.planned - budget.spent)} remaining vs plan</Small>
          </Tile>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-xl">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-navy/60">Nothing yet.</p>
        ) : (
          <ul className="card divide-y divide-gold/20 p-0">
            {activity.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <span className="font-medium text-navy">{a.actor?.name ?? 'System'}</span> {a.summary}
                <div className="text-xs text-navy/50">{formatDateTime(a.created_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Tile({ title, to, children }: { title: string; to?: string; children: ReactNode }) {
  const body = (
    <>
      <h2 className="font-sans text-xs font-semibold tracking-wide text-navy/60 uppercase">{title}</h2>
      {children}
    </>
  )
  return to ? (
    <Link to={to} className="card block space-y-2 transition hover:border-gold">{body}</Link>
  ) : (
    <div className="card space-y-2">{body}</div>
  )
}

function Big({ children, tone }: { children: ReactNode; tone?: string }) {
  // a <Small> inside the big number sits inline ("82 of 140")
  return <div className={`font-serif text-2xl [&>span]:inline [&>span]:text-sm ${tone ?? 'text-navy'}`}>{children}</div>
}

function Small({ children }: { children: ReactNode }) {
  return <span className="block font-sans text-xs text-navy/60">{children}</span>
}

function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-parchment">
      <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, (value / Math.max(max, 1)) * 100)}%` }} />
    </div>
  )
}
