import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import Sheet from '../components/Sheet'
import type { EventTable } from './companies/types'

type TableRow = EventTable & { notes: string | null; sort_order: number }

interface Party {
  key: string
  kind: 'sponsor' | 'ticket'
  id: string
  name: string
  seats: number
  table_id: string | null
}

const TYPE_LABEL: Record<TableRow['type'], string> = { round: '60" round', banquet: "8' banquet", cocktail: 'Cocktail (standing)', other: 'Other' }

export default function TablesPage() {
  const { isAdmin } = useAuth()
  const { settings } = useSettings()
  const [tables, setTables] = useState<TableRow[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [assigning, setAssigning] = useState<TableRow | null>(null)
  const [editing, setEditing] = useState<TableRow | 'new' | null>(null)

  const load = useCallback(async () => {
    const [t, sp, tk] = await Promise.all([
      supabase.from('event_tables').select('*').order('sort_order').order('label'),
      supabase.from('companies').select('id, name, tickets_included, table_id').eq('kind', 'sponsor').eq('status', 'yes'),
      supabase.from('ticket_sales').select('id, buyer_name, quantity, table_id'),
    ])
    setTables((t.data as TableRow[]) ?? [])
    setParties([
      ...(sp.data ?? []).map((c) => ({ key: `s-${c.id}`, kind: 'sponsor' as const, id: c.id, name: c.name, seats: Number(c.tickets_included ?? 0), table_id: c.table_id })),
      ...(tk.data ?? []).map((s) => ({ key: `t-${s.id}`, kind: 'ticket' as const, id: s.id, name: s.buyer_name, seats: s.quantity, table_id: s.table_id })),
    ])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function assign(p: Party, tableId: string | null) {
    const table = p.kind === 'sponsor' ? 'companies' : 'ticket_sales'
    await supabase.from(table).update({ table_id: tableId }).eq('id', p.id)
    load()
  }

  const seated = tables.filter((t) => t.type !== 'cocktail')
  const seatCapacity = seated.reduce((n, t) => n + t.seats, 0)
  const headcount = parties.reduce((n, p) => n + p.seats, 0)
  const capacity = settings?.capacity ?? 140
  const unseated = parties.filter((p) => !p.table_id && p.seats > 0)
  const filled = useMemo(() => {
    const m = new Map<string, number>()
    parties.forEach((p) => p.table_id && m.set(p.table_id, (m.get(p.table_id) ?? 0) + p.seats))
    return m
  }, [parties])

  const shortNow = headcount - seatCapacity
  const shortAtCapacity = capacity - seatCapacity

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="flex-1 text-2xl md:text-3xl">Tables</h1>
        {isAdmin && <button className="btn btn-ghost text-sm" onClick={() => setEditing('new')}>+ Table</button>}
      </div>

      <section className="card grid grid-cols-3 gap-2 text-center">
        <Stat label="Seats at tables" value={seatCapacity} />
        <Stat label="Guests so far" value={headcount} />
        <Stat label="Capacity goal" value={capacity} />
      </section>

      {shortNow > 0 ? (
        <p role="alert" className="rounded-lg bg-rose/10 px-3 py-2 text-sm font-medium text-burgundy">
          {shortNow} more guests than seats right now. Add about {Math.ceil(shortNow / 8)} more round table{Math.ceil(shortNow / 8) === 1 ? '' : 's'} of 8.
        </p>
      ) : shortAtCapacity > 0 ? (
        <p className="rounded-lg bg-gold/20 px-3 py-2 text-sm text-navy">
          Seating fits today's guests, but a full house of {capacity} needs {shortAtCapacity} more seats (about {Math.ceil(shortAtCapacity / 8)} more rounds of 8).
        </p>
      ) : null}

      {unseated.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg">Not seated yet <span className="font-sans text-sm text-navy/60">({unseated.reduce((n, p) => n + p.seats, 0)} guests)</span></h2>
          <ul className="flex flex-wrap gap-2">
            {unseated.map((p) => (
              <li key={p.key} className={`rounded-full px-3 py-1 text-sm ${p.kind === 'sponsor' ? 'bg-gold/30 text-navy' : 'bg-navy/10 text-navy'}`}>
                {p.name} · {p.seats}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((t) => {
          const used = filled.get(t.id) ?? 0
          const here = parties.filter((p) => p.table_id === t.id)
          const over = t.type !== 'cocktail' && used > t.seats
          return (
            <li key={t.id} className={`card space-y-2 ${t.type === 'cocktail' ? 'opacity-70' : ''}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-lg text-navy">{t.label}</div>
                  <div className="text-xs text-navy/60">{TYPE_LABEL[t.type]}{t.notes ? ` · ${t.notes}` : ''}</div>
                </div>
                {t.type !== 'cocktail' && (
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium tabular-nums ${over ? 'bg-rose/15 text-burgundy' : used === t.seats ? 'bg-emerald-100 text-emerald-900' : 'bg-parchment text-navy'}`}>
                    {used}/{t.seats}
                  </span>
                )}
              </div>
              {t.type !== 'cocktail' && (
                <>
                  {here.length > 0 && (
                    <ul className="space-y-1">
                      {here.map((p) => (
                        <li key={p.key} className="flex items-center gap-2 text-sm">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${p.kind === 'sponsor' ? 'bg-gold' : 'bg-navy'}`} />
                          <span className="min-w-0 flex-1 truncate">{p.name}</span>
                          <span className="text-navy/60">{p.seats}</span>
                          <button className="px-2 text-navy/40 hover:text-rose" aria-label={`Unseat ${p.name}`} onClick={() => assign(p, null)}>×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {over && <p className="text-xs text-rose">Over by {used - t.seats}.</p>}
                </>
              )}
              <div className="flex gap-2">
                {t.type !== 'cocktail' && <button className="btn btn-ghost flex-1 text-sm" onClick={() => setAssigning(t)}>Seat guests</button>}
                <button className="btn btn-ghost text-sm" onClick={() => setEditing(t)}>Edit</button>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-navy/60">
        Sponsors appear here once they're marked Yes in <Link className="underline" to="/outreach?kind=sponsor">Outreach</Link>; ticket buyers come from <Link className="underline" to="/tickets">Tickets</Link>.
      </p>

      <Sheet open={!!assigning} title={assigning ? `Seat guests at ${assigning.label}` : ''} onClose={() => setAssigning(null)}>
        {assigning && (
          <AssignList
            table={assigning}
            used={filled.get(assigning.id) ?? 0}
            parties={parties.filter((p) => p.table_id !== assigning.id && p.seats > 0)}
            tables={tables}
            onPick={async (p) => {
              await assign(p, assigning.id)
            }}
          />
        )}
      </Sheet>

      <TableForm open={editing !== null} table={editing === 'new' ? null : editing} canDelete={isAdmin} nextOrder={(tables.at(-1)?.sort_order ?? 0) + 1} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  )
}

function AssignList({ table, used, parties, tables, onPick }: { table: TableRow; used: number; parties: Party[]; tables: TableRow[]; onPick: (p: Party) => void }) {
  const label = (id: string | null) => tables.find((t) => t.id === id)?.label
  const sorted = [...parties].sort((a, b) => Number(!!a.table_id) - Number(!!b.table_id) || a.name.localeCompare(b.name))
  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/70">{used} of {table.seats} seats filled. Tap a party to seat them here.</p>
      {sorted.length === 0 ? (
        <p className="text-sm text-navy/50">No other sponsors or ticket buyers to seat.</p>
      ) : (
        <ul className="divide-y divide-gold/20 rounded-xl border border-gold/30 bg-white">
          {sorted.map((p) => (
            <li key={p.key}>
              <button className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left" onClick={() => onPick(p)}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.kind === 'sponsor' ? 'bg-gold' : 'bg-navy'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-navy">{p.name}</span>
                  <span className="block text-xs text-navy/50">
                    {p.kind === 'sponsor' ? 'Sponsor' : 'Tickets'} · {p.seats} seat{p.seats === 1 ? '' : 's'}
                    {p.table_id ? ` · now at ${label(p.table_id)}` : ''}
                  </span>
                </span>
                <span className={`text-xs ${used + p.seats > table.seats ? 'text-rose' : 'text-burgundy'}`}>Seat here</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TableForm({ open, table, canDelete, nextOrder, onClose, onSaved }: { open: boolean; table: TableRow | null; canDelete: boolean; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ label: '', type: 'round' as TableRow['type'], seats: '8', notes: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setF({ label: table?.label ?? '', type: table?.type ?? 'round', seats: String(table?.seats ?? 8), notes: table?.notes ?? '' })
  }, [open, table])

  async function save(e: FormEvent) {
    e.preventDefault()
    const row = { label: f.label.trim(), type: f.type, seats: f.type === 'cocktail' ? 0 : Number(f.seats) || 0, notes: f.notes.trim() || null }
    const { error } = table
      ? await supabase.from('event_tables').update(row).eq('id', table.id)
      : await supabase.from('event_tables').insert({ ...row, sort_order: nextOrder })
    if (error) return setError(error.message)
    onSaved()
    onClose()
  }

  async function remove() {
    if (!table || !confirm(`Delete ${table.label}? Anyone seated there becomes unseated.`)) return
    await supabase.from('event_tables').delete().eq('id', table.id)
    onSaved()
    onClose()
  }

  return (
    <Sheet open={open} title={table ? `Edit ${table.label}` : 'New table'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label" htmlFor="tb-label">Label</label>
          <input id="tb-label" className="input" required value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Round 11" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="tb-type">Type</label>
            <select id="tb-type" className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as TableRow['type'] })}>
              {(Object.keys(TYPE_LABEL) as TableRow['type'][]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tb-seats">Seats</label>
            <input id="tb-seats" type="number" min={0} className="input" disabled={f.type === 'cocktail'} value={f.type === 'cocktail' ? '0' : f.seats} onChange={(e) => setF({ ...f, seats: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="tb-notes">Notes</label>
          <input id="tb-notes" className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Near stage, rented from…" />
        </div>
        {error && <p role="alert" className="text-sm text-rose">{error}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1">Save</button>
          {table && canDelete && <button type="button" className="btn btn-ghost text-rose" onClick={remove}>Delete</button>}
        </div>
      </form>
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-navy/60">{label}</div>
      <div className="font-serif text-2xl text-navy">{value}</div>
    </div>
  )
}
