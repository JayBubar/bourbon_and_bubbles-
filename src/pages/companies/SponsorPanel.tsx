import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { money } from '../../lib/format'
import type { Company, EventTable, SponsorLevel } from './types'

interface Deliverable {
  id: string
  description: string
  done: boolean
  sort_order: number
}

export default function SponsorPanel({ company, onEdit }: { company: Company; onEdit: () => void }) {
  const [level, setLevel] = useState<SponsorLevel | null>(null)
  const [table, setTable] = useState<EventTable | null>(null)
  const [items, setItems] = useState<Deliverable[]>([])
  const [newItem, setNewItem] = useState('')

  const loadDeliverables = useCallback(async () => {
    const { data } = await supabase.from('sponsor_deliverables').select('*').eq('company_id', company.id).order('sort_order').order('created_at')
    setItems((data as Deliverable[]) ?? [])
  }, [company.id])

  useEffect(() => {
    loadDeliverables()
    if (company.sponsor_level_id) {
      supabase.from('sponsor_levels').select('*').eq('id', company.sponsor_level_id).single().then(({ data }) => setLevel(data as SponsorLevel))
    } else setLevel(null)
    if (company.table_id) {
      supabase.from('event_tables').select('id, label, type, seats').eq('id', company.table_id).single().then(({ data }) => setTable(data as EventTable))
    } else setTable(null)
  }, [company.sponsor_level_id, company.table_id, loadDeliverables])

  async function toggle(d: Deliverable) {
    setItems((all) => all.map((x) => (x.id === d.id ? { ...x, done: !x.done } : x)))
    await supabase.from('sponsor_deliverables').update({ done: !d.done }).eq('id', d.id)
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!newItem.trim()) return
    await supabase.from('sponsor_deliverables').insert({
      company_id: company.id,
      description: newItem.trim(),
      sort_order: (items.at(-1)?.sort_order ?? 0) + 1,
    })
    setNewItem('')
    loadDeliverables()
  }

  async function remove(d: Deliverable) {
    if (!confirm(`Remove "${d.description}"?`)) return
    await supabase.from('sponsor_deliverables').delete().eq('id', d.id)
    loadDeliverables()
  }

  const committed = Number(company.amount_committed ?? 0)
  const paid = Number(company.amount_paid ?? 0)
  const doneCount = items.filter((i) => i.done).length

  return (
    <div className="space-y-5">
      <section className="card space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="flex-1 text-lg">{level ? `${level.name} sponsor` : 'Sponsorship'}</h2>
          <button className="text-sm text-burgundy" onClick={onEdit}>Edit</button>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <Stat label="Committed" value={money(company.amount_committed)} />
          <Stat label="Paid" value={money(company.amount_paid)} tone={committed > 0 && paid >= committed ? 'text-emerald-700' : undefined} />
          <Stat label="Invoice" value={company.invoice_sent ? 'Sent' : 'Not sent'} />
          <Stat label="Tickets included" value={company.tickets_included?.toString() ?? '—'} />
          <Stat label="Table" value={table ? table.label : level?.reserved_table ? 'Needs a table' : '—'} tone={!table && level?.reserved_table ? 'text-rose' : undefined} />
          <Stat label="Tax-deductible" value={money(company.tax_deductible)} />
        </dl>
        {committed > 0 && (
          <div className="h-2 overflow-hidden rounded-full bg-parchment" aria-label={`${Math.round((paid / committed) * 100)}% paid`}>
            <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, (paid / committed) * 100)}%` }} />
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">
          Deliverables {items.length > 0 && <span className="font-sans text-sm text-navy/60">{doneCount}/{items.length} done</span>}
        </h2>
        {items.length === 0 && (
          <p className="text-sm text-navy/60">Pick a sponsor level to fill in its benefits, or add your own below.</p>
        )}
        {items.length > 0 && (
          <ul className="card divide-y divide-gold/20 overflow-hidden p-0">
            {items.map((d) => (
              <li key={d.id} className="flex items-center">
                <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3 px-4 py-2">
                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-burgundy" checked={d.done} onChange={() => toggle(d)} />
                  <span className={d.done ? 'text-navy/40 line-through' : 'text-navy'}>{d.description}</span>
                </label>
                <button className="px-4 py-3 text-navy/30 hover:text-rose" aria-label={`Remove ${d.description}`} onClick={() => remove(d)}>×</button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="flex gap-2">
          <input className="input" placeholder="Add a deliverable…" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
          <button className="btn btn-ghost shrink-0" disabled={!newItem.trim()}>Add</button>
        </form>
      </section>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-xs text-navy/60">{label}</dt>
      <dd className={`font-medium ${tone ?? 'text-navy'}`}>{value}</dd>
    </div>
  )
}
