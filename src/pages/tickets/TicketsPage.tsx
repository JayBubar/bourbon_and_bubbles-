import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSettings } from '../../lib/settings'
import { useUsers, firstName } from '../../lib/useUsers'
import { formatDate } from '../../lib/dates'
import { money } from '../../lib/format'
import QuickAdd from './QuickAdd'
import TicketForm from './TicketForm'
import { PAY_LABEL, PAY_STYLE, payState, type PayState, type TicketSale } from './types'

export default function TicketsPage() {
  const { settings } = useSettings()
  const users = useUsers()
  const [sales, setSales] = useState<TicketSale[]>([])
  const [sponsorSeats, setSponsorSeats] = useState(0)
  const [loading, setLoading] = useState(true)
  const [quick, setQuick] = useState(false)
  const [editing, setEditing] = useState<TicketSale | 'new' | null>(null)
  const [q, setQ] = useState('')
  const [pay, setPay] = useState<PayState | 'all'>('all')
  const [seller, setSeller] = useState('any')

  const load = useCallback(async () => {
    const [s, sp] = await Promise.all([
      supabase.from('ticket_sales').select('*').order('sale_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('companies').select('tickets_included').eq('kind', 'sponsor').eq('status', 'yes'),
    ])
    setSales((s.data as TicketSale[]) ?? [])
    setSponsorSeats((sp.data ?? []).reduce((n, c) => n + Number(c.tickets_included ?? 0), 0))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const price = Number(settings?.ticket_price ?? 150)
  const capacity = Number(settings?.capacity ?? 140)

  const totals = useMemo(() => {
    const sold = sales.reduce((n, s) => n + s.quantity, 0)
    const paid = sales.reduce((n, s) => n + Number(s.amount_paid), 0)
    const owed = sales.reduce((n, s) => n + Math.max(0, s.quantity * Number(s.unit_price) - Number(s.amount_paid)), 0)
    return { sold, paid, owed, seats: sold + sponsorSeats }
  }, [sales, sponsorSeats])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return sales.filter(
      (s) =>
        (pay === 'all' || payState(s) === pay) &&
        (seller === 'any' || s.sold_by_id === seller) &&
        (!needle || [s.buyer_name, s.email, s.guest_names].some((v) => (v ?? '').toLowerCase().includes(needle))),
    )
  }, [sales, q, pay, seller])

  const over = totals.seats > capacity
  const pct = (n: number) => `${Math.min(100, (n / Math.max(capacity, 1)) * 100)}%`
  const sellerName = (id: string | null) => firstName(users.find((u) => u.id === id)?.name) || '—'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-2xl md:text-3xl">Ticket Sales</h1>
        <button className="btn btn-ghost hidden text-sm md:inline-flex" onClick={() => setEditing('new')}>+ Full entry</button>
        <button className="btn btn-accent text-sm" onClick={() => setQuick(true)}>+ Quick add</button>
      </div>

      {/* seats vs capacity */}
      <section className="card space-y-3">
        <div className="flex items-baseline gap-2">
          <div className="font-serif text-3xl text-navy">{totals.seats}</div>
          <div className="text-navy/70">of {capacity} seats committed</div>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-parchment" role="img" aria-label={`${totals.sold} sold tickets and ${sponsorSeats} sponsor seats out of ${capacity}`}>
          <div className="h-full bg-navy" style={{ width: pct(totals.sold) }} />
          <div className="h-full bg-gold" style={{ width: pct(Math.min(sponsorSeats, Math.max(0, capacity - totals.sold))) }} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy/70">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-navy" />{totals.sold} tickets sold</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-gold" />{sponsorSeats} sponsor seats</span>
          <span>{Math.max(0, capacity - totals.seats)} left</span>
        </div>
        {over && (
          <p role="alert" className="rounded-lg bg-rose/10 px-3 py-2 text-sm font-medium text-burgundy">
            Over capacity by {totals.seats - capacity}. Check with the venue before selling more.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 border-t border-gold/20 pt-3 text-center">
          <div>
            <div className="text-xs text-navy/60">Collected</div>
            <div className="font-serif text-xl text-navy">{money(totals.paid)}</div>
          </div>
          <div>
            <div className="text-xs text-navy/60">Still owed</div>
            <div className={`font-serif text-xl ${totals.owed > 0 ? 'text-burgundy' : 'text-navy'}`}>{money(totals.owed)}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-3">
        <input className="input" type="search" placeholder="Search buyer, email, guests" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input" value={pay} onChange={(e) => setPay(e.target.value as PayState | 'all')} aria-label="Payment status">
          <option value="all">Any payment status</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partially paid</option>
          <option value="paid">Paid</option>
        </select>
        <select className="input" value={seller} onChange={(e) => setSeller(e.target.value)} aria-label="Sold by">
          <option value="any">Sold by anyone</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-navy/50">Loading…</p>
      ) : sales.length === 0 ? (
        <div className="card text-center text-navy/70">
          No tickets recorded yet. Tap <strong>Quick add</strong> when someone buys.
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-navy/50">No sales match.</p>
      ) : (
        <>
          <ul className="card divide-y divide-gold/20 overflow-hidden p-0 md:hidden">
            {shown.map((s) => {
              const st = payState(s)
              return (
                <li key={s.id}>
                  <button onClick={() => setEditing(s)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy font-serif text-lg text-cream">{s.quantity}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-navy">{s.buyer_name}</div>
                      <div className="truncate text-xs text-navy/60">
                        {formatDate(s.sale_date)} · {sellerName(s.sold_by_id)}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PAY_STYLE[st]}`}>{PAY_LABEL[st]}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="card hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <thead className="bg-parchment text-left text-xs text-navy/70">
                <tr>
                  <th className="px-4 py-2 font-medium">Buyer</th>
                  <th className="px-4 py-2 text-right font-medium">Qty</th>
                  <th className="px-4 py-2 text-right font-medium">Paid</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Sold by</th>
                  <th className="px-4 py-2 font-medium">Dietary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/15">
                {shown.map((s) => {
                  const st = payState(s)
                  return (
                    <tr key={s.id} className="cursor-pointer hover:bg-cream" onClick={() => setEditing(s)}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-navy">{s.buyer_name}</div>
                        {s.email && <div className="text-xs text-navy/50">{s.email}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{s.quantity}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(s.amount_paid)} <span className="text-navy/40">/ {money(s.quantity * Number(s.unit_price))}</span></td>
                      <td className="px-4 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PAY_STYLE[st]}`}>{PAY_LABEL[st]}</span></td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(s.sale_date)}</td>
                      <td className="px-4 py-2.5">{sellerName(s.sold_by_id)}</td>
                      <td className="max-w-40 truncate px-4 py-2.5 text-navy/70">{s.dietary_notes}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <QuickAdd open={quick} price={price} onClose={() => setQuick(false)} onSaved={load} />
      <TicketForm open={editing !== null} sale={editing === 'new' ? null : editing} price={price} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  )
}
