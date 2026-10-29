import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useTotals, raised } from '../lib/totals'
import { formatDate } from '../lib/dates'
import { money, parseMoney } from '../lib/format'
import Sheet from '../components/Sheet'

interface Line {
  id: string
  category: string
  description: string
  vendor: string | null
  estimated_amount: number
  actual_amount: number | null
  paid: boolean
  due_date: string | null
  idea_id: string | null
  idea: { title: string } | null
}

const SUGGESTED = ['Venue', 'Food & Catering', 'Drinks', 'Entertainment', 'Venue & Decor', 'Printing & Signage', 'Rentals', 'Auction', 'Program', 'Staffing', 'Other']

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function BudgetPage() {
  const { totals } = useTotals()
  const [lines, setLines] = useState<Line[]>([])
  const [editing, setEditing] = useState<Line | 'new' | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('budget_items').select('*, idea:ideas(title)').order('category').order('due_date', { nullsFirst: false })
    setLines((data as unknown as Line[]) ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const actual = (l: Line) => Number(l.actual_amount ?? 0)
  const sum = (ls: Line[], f: (l: Line) => number) => ls.reduce((n, l) => n + f(l), 0)

  const byCategory = useMemo(() => {
    const m = new Map<string, Line[]>()
    lines.forEach((l) => m.set(l.category, [...(m.get(l.category) ?? []), l]))
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [lines])

  const planned = sum(lines, (l) => Number(l.estimated_amount))
  const spent = sum(lines, actual)
  const paid = sum(lines.filter((l) => l.paid), (l) => actual(l) || Number(l.estimated_amount))

  function exportCsv() {
    const header = ['Category', 'Description', 'Vendor', 'Estimated', 'Actual', 'Paid', 'Due date', 'Linked idea']
    const rows = lines.map((l) => [l.category, l.description, l.vendor, l.estimated_amount, l.actual_amount, l.paid ? 'Yes' : 'No', l.due_date, l.idea?.title])
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `bourbon-bubbles-budget-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-2xl md:text-3xl">Budget</h1>
        <button className="btn btn-ghost text-sm" onClick={exportCsv} disabled={lines.length === 0}>Export CSV</button>
        <button className="btn btn-accent text-sm" onClick={() => setEditing('new')}>+ Line</button>
      </div>
      <p className="text-xs text-navy/60">Admins only. Volunteers can't see this page or its numbers.</p>

      {totals && (
        <p className="rounded-lg bg-parchment px-3 py-2 text-sm text-navy">
          For context: ticket + sponsor revenue so far <strong>{money(raised(totals))}</strong>{' '}
          <span className="text-navy/60">({money(totals.ticketRevenuePaid)} tickets collected + {money(totals.sponsorCommitted)} sponsorships committed)</span>
        </p>
      )}

      <section className="card grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <Stat label="Planned" value={money(planned)} />
        <Stat label="Actual so far" value={money(spent)} />
        <Stat label="Paid out" value={money(paid)} />
        <Stat label="Remaining vs plan" value={money(planned - spent)} tone={planned - spent < 0 ? 'text-rose' : undefined} />
      </section>

      {lines.length === 0 ? (
        <div className="card text-center text-navy/70">No budget lines yet. Add one, or use "Add to budget" on a finalized idea.</div>
      ) : (
        byCategory.map(([cat, ls]) => {
          const p = sum(ls, (l) => Number(l.estimated_amount))
          const a = sum(ls, actual)
          return (
            <section key={cat} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <h2 className="flex-1 text-lg">{cat}</h2>
                <span className="text-sm text-navy/70 tabular-nums">{money(a)} of {money(p)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-parchment">
                <div className={`h-full ${a > p ? 'bg-rose' : 'bg-navy'}`} style={{ width: `${p > 0 ? Math.min(100, (a / p) * 100) : a > 0 ? 100 : 0}%` }} />
              </div>
              <ul className="card divide-y divide-gold/20 overflow-hidden p-0">
                {ls.map((l) => (
                  <li key={l.id}>
                    <button className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left" onClick={() => setEditing(l)}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-navy">{l.description}</div>
                        <div className="truncate text-xs text-navy/60">
                          {[l.vendor, l.due_date && `Due ${formatDate(l.due_date)}`, l.idea && `Idea: ${l.idea.title}`].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="text-right text-sm tabular-nums">
                        <div className="text-navy">{l.actual_amount !== null ? money(l.actual_amount) : money(l.estimated_amount)}</div>
                        <div className="text-xs text-navy/50">{l.actual_amount !== null ? `plan ${money(l.estimated_amount)}` : 'estimate'}</div>
                      </div>
                      <span className={`w-14 shrink-0 rounded-full py-0.5 text-center text-xs font-medium ${l.paid ? 'bg-emerald-100 text-emerald-900' : 'bg-parchment text-navy/60'}`}>
                        {l.paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}

      <LineSheet open={editing !== null} line={editing === 'new' ? null : editing} categories={[...new Set([...SUGGESTED, ...lines.map((l) => l.category)])]} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  )
}

function LineSheet({ open, line, categories, onClose, onSaved }: { open: boolean; line: Line | null; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const [ideas, setIdeas] = useState<{ id: string; title: string }[]>([])
  const [f, setF] = useState<Record<string, string | boolean>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))
    setF({
      category: line?.category ?? '', description: s(line?.description), vendor: s(line?.vendor), estimated_amount: s(line?.estimated_amount),
      actual_amount: s(line?.actual_amount), paid: line?.paid ?? false, due_date: s(line?.due_date), idea_id: s(line?.idea_id),
    })
    supabase.from('ideas').select('id, title').order('title').then(({ data }) => setIdeas(data ?? []))
  }, [open, line])

  const str = (k: string) => (f[k] as string) ?? ''
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }))

  async function save(e: FormEvent) {
    e.preventDefault()
    const row = {
      category: str('category').trim() || 'Other',
      description: str('description').trim(),
      vendor: str('vendor').trim() || null,
      estimated_amount: parseMoney(str('estimated_amount')) ?? 0,
      actual_amount: parseMoney(str('actual_amount')),
      paid: !!f.paid,
      due_date: str('due_date') || null,
      idea_id: str('idea_id') || null,
    }
    const { error } = line ? await supabase.from('budget_items').update(row).eq('id', line.id) : await supabase.from('budget_items').insert(row)
    if (error) return setError(error.message)
    onSaved()
    onClose()
  }

  async function remove() {
    if (!line || !confirm(`Delete "${line.description}"?`)) return
    await supabase.from('budget_items').delete().eq('id', line.id)
    onSaved()
    onClose()
  }

  return (
    <Sheet open={open} title={line ? 'Edit budget line' : 'New budget line'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Description" id="b-desc"><input id="b-desc" className="input" required value={str('description')} onChange={(e) => set('description', e.target.value)} autoFocus={!line} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" id="b-cat">
            <input id="b-cat" className="input" list="b-cats" value={str('category')} onChange={(e) => set('category', e.target.value)} placeholder="Pick or type" />
            <datalist id="b-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Vendor" id="b-vendor"><input id="b-vendor" className="input" value={str('vendor')} onChange={(e) => set('vendor', e.target.value)} /></Field>
          <Field label="Estimated" id="b-est"><input id="b-est" className="input" inputMode="decimal" value={str('estimated_amount')} onChange={(e) => set('estimated_amount', e.target.value)} /></Field>
          <Field label="Actual" id="b-act"><input id="b-act" className="input" inputMode="decimal" value={str('actual_amount')} onChange={(e) => set('actual_amount', e.target.value)} /></Field>
          <Field label="Due date" id="b-due"><input id="b-due" type="date" className="input" value={str('due_date')} onChange={(e) => set('due_date', e.target.value)} /></Field>
          <Field label="Linked idea" id="b-idea">
            <select id="b-idea" className="input" value={str('idea_id')} onChange={(e) => set('idea_id', e.target.value)}>
              <option value="">None</option>
              {ideas.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm text-navy">
          <input type="checkbox" className="h-5 w-5 accent-burgundy" checked={!!f.paid} onChange={(e) => set('paid', e.target.checked)} />
          Paid
        </label>
        {error && <p role="alert" className="text-sm text-rose">{error}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1">Save</button>
          {line && <button type="button" className="btn btn-ghost text-rose" onClick={remove}>Delete</button>}
        </div>
      </form>
    </Sheet>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-xs text-navy/60">{label}</div>
      <div className={`font-serif text-xl ${tone ?? 'text-navy'}`}>{value}</div>
    </div>
  )
}
