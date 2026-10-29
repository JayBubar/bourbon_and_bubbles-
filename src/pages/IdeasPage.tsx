import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useUsers } from '../lib/useUsers'
import { formatDate } from '../lib/dates'
import { hrefFor, money, parseMoney } from '../lib/format'
import Sheet from '../components/Sheet'
import Comments from '../components/Comments'

type Category = 'entertainment' | 'venue_decor' | 'food' | 'drinks' | 'program' | 'auction' | 'other'
type IdeaStatus = 'idea' | 'considering' | 'finalized' | 'rejected'

interface Idea {
  id: string
  category: Category
  status: IdeaStatus
  title: string
  description: string | null
  link: string | null
  estimated_cost: number | null
  vendor_name: string | null
  vendor_contact: string | null
  contract_signed: boolean
  deposit_amount: number | null
  deposit_due: string | null
  created_by: string | null
  created_at: string
}

const CATEGORIES: Record<Category, string> = {
  entertainment: 'Entertainment',
  venue_decor: 'Venue & Decor',
  food: 'Food',
  drinks: 'Drinks',
  program: 'Program',
  auction: 'Auction ideas',
  other: 'Other',
}
const STATUSES: Record<IdeaStatus, string> = { idea: 'Idea', considering: 'Considering', finalized: 'Finalized', rejected: 'Rejected' }
const STATUS_STYLE: Record<IdeaStatus, string> = {
  idea: 'bg-navy/10 text-navy/70',
  considering: 'bg-gold/30 text-navy',
  finalized: 'bg-emerald-100 text-emerald-900',
  rejected: 'bg-rose/15 text-burgundy',
}

export default function IdeasPage() {
  const { me } = useAuth()
  const users = useUsers()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [votes, setVotes] = useState<{ idea_id: string; user_id: string }[]>([])
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [showRejected, setShowRejected] = useState(false)
  const [sort, setSort] = useState<'votes' | 'new'>('votes')
  const [open, setOpen] = useState<Idea | 'new' | null>(null)

  const load = useCallback(async () => {
    const [i, v] = await Promise.all([
      supabase.from('ideas').select('*').order('created_at', { ascending: false }),
      supabase.from('idea_votes').select('idea_id, user_id'),
    ])
    setIdeas((i.data as Idea[]) ?? [])
    setVotes(v.data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const voteCount = (id: string) => votes.filter((v) => v.idea_id === id).length
  const iVoted = (id: string) => votes.some((v) => v.idea_id === id && v.user_id === me?.id)

  async function toggleVote(idea: Idea) {
    if (!me) return
    if (iVoted(idea.id)) {
      setVotes((vs) => vs.filter((v) => !(v.idea_id === idea.id && v.user_id === me.id)))
      await supabase.from('idea_votes').delete().eq('idea_id', idea.id).eq('user_id', me.id)
    } else {
      setVotes((vs) => [...vs, { idea_id: idea.id, user_id: me.id }])
      await supabase.from('idea_votes').insert({ idea_id: idea.id })
    }
  }

  const shown = useMemo(() => {
    const list = ideas.filter((i) => (cat === 'all' || i.category === cat) && (showRejected || i.status !== 'rejected'))
    if (sort === 'votes') {
      const order: IdeaStatus[] = ['finalized', 'considering', 'idea', 'rejected']
      return [...list].sort(
        (a, b) => order.indexOf(a.status) - order.indexOf(b.status) || votes.filter((v) => v.idea_id === b.id).length - votes.filter((v) => v.idea_id === a.id).length,
      )
    }
    return list
  }, [ideas, cat, showRejected, sort, votes])

  const current = open && open !== 'new' ? ideas.find((i) => i.id === open.id) ?? null : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="flex-1 text-2xl md:text-3xl">Ideas</h1>
        <button className="btn btn-accent text-sm" onClick={() => setOpen('new')}>+ Idea</button>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {(['all', ...Object.keys(CATEGORIES)] as (Category | 'all')[]).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap ${cat === c ? 'border-navy bg-navy text-cream' : 'border-navy/20 bg-white text-navy/80'}`}
          >
            {c === 'all' ? 'All' : CATEGORIES[c]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as 'votes' | 'new')} aria-label="Sort">
          <option value="votes">Top voted</option>
          <option value="new">Newest</option>
        </select>
        <label className="flex min-h-11 items-center gap-2 text-navy/80">
          <input type="checkbox" className="h-5 w-5 accent-burgundy" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} />
          Show rejected
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="card text-center text-navy/70">No ideas here yet. Add the first one!</div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((i) => {
            const n = voteCount(i.id)
            const mine = iVoted(i.id)
            return (
              <li key={i.id} className="card flex gap-3 p-0">
                <button onClick={() => setOpen(i)} className="min-w-0 flex-1 p-4 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[i.status]}`}>{STATUSES[i.status]}</span>
                    <span className="text-xs text-navy/50">{CATEGORIES[i.category]}</span>
                  </div>
                  <div className="mt-1 font-medium text-navy">{i.title}</div>
                  {i.description && <p className="mt-0.5 line-clamp-2 text-sm text-navy/70">{i.description}</p>}
                  <div className="mt-1 text-xs text-navy/50">
                    {[i.estimated_cost !== null && money(i.estimated_cost), i.vendor_name, users.find((u) => u.id === i.created_by)?.name.split(' ')[0]]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </button>
                <button
                  onClick={() => toggleVote(i)}
                  aria-pressed={mine}
                  aria-label={mine ? `Remove your vote for ${i.title}` : `Vote for ${i.title}`}
                  className={`flex w-16 shrink-0 flex-col items-center justify-center rounded-r-xl border-l border-gold/20 ${mine ? 'bg-burgundy text-cream' : 'text-navy/60 hover:bg-parchment'}`}
                >
                  <span className="text-xl">👍</span>
                  <span className="text-sm font-semibold tabular-nums">{n}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <IdeaSheet open={open !== null} idea={open === 'new' ? null : current} voters={current ? votes.filter((v) => v.idea_id === current.id).map((v) => users.find((u) => u.id === v.user_id)?.name ?? '') : []} onClose={() => setOpen(null)} onSaved={load} />
    </div>
  )
}

function IdeaSheet({ open, idea, voters, onClose, onSaved }: { open: boolean; idea: Idea | null; voters: string[]; onClose: () => void; onSaved: () => void }) {
  const { isAdmin } = useAuth()
  const [f, setF] = useState<Record<string, string | boolean>>({})
  const [budgetLine, setBudgetLine] = useState<{ id: string } | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setMsg(null)
    const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))
    setF({
      title: s(idea?.title), category: idea?.category ?? 'other', status: idea?.status ?? 'idea', description: s(idea?.description),
      link: s(idea?.link), estimated_cost: s(idea?.estimated_cost), vendor_name: s(idea?.vendor_name), vendor_contact: s(idea?.vendor_contact),
      contract_signed: idea?.contract_signed ?? false, deposit_amount: s(idea?.deposit_amount), deposit_due: s(idea?.deposit_due),
    })
    setBudgetLine(undefined)
    if (idea && isAdmin) {
      supabase.from('budget_items').select('id').eq('idea_id', idea.id).limit(1).maybeSingle().then(({ data }) => setBudgetLine(data))
    }
  }, [open, idea, isAdmin])

  const str = (k: string) => (f[k] as string) ?? ''
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }))

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const row = {
      title: str('title').trim(),
      category: f.category,
      status: f.status,
      description: str('description').trim() || null,
      link: str('link').trim() || null,
      estimated_cost: parseMoney(str('estimated_cost')),
      vendor_name: str('vendor_name').trim() || null,
      vendor_contact: str('vendor_contact').trim() || null,
      contract_signed: !!f.contract_signed,
      deposit_amount: parseMoney(str('deposit_amount')),
      deposit_due: str('deposit_due') || null,
    }
    const { error } = idea ? await supabase.from('ideas').update(row).eq('id', idea.id) : await supabase.from('ideas').insert(row)
    if (error) return setError(error.message)
    onSaved()
    onClose()
  }

  async function addToBudget() {
    if (!idea) return
    const { data, error } = await supabase
      .from('budget_items')
      .insert({
        category: CATEGORIES[idea.category],
        description: idea.title,
        vendor: idea.vendor_name,
        estimated_amount: idea.estimated_cost ?? 0,
        due_date: idea.deposit_due,
        idea_id: idea.id,
      })
      .select('id')
      .single()
    if (error) return setError(error.message)
    setBudgetLine(data)
    setMsg('Added to the budget.')
  }

  async function remove() {
    if (!idea || !confirm(`Delete "${idea.title}"?`)) return
    await supabase.from('ideas').delete().eq('id', idea.id)
    onSaved()
    onClose()
  }

  return (
    <Sheet open={open} title={idea ? idea.title : 'New idea'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Idea" id="i-title"><input id="i-title" className="input" required value={str('title')} onChange={(e) => set('title', e.target.value)} autoFocus={!idea} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" id="i-cat">
            <select id="i-cat" className="input" value={str('category')} onChange={(e) => set('category', e.target.value)}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Status" id="i-status">
            <select id="i-status" className="input" value={str('status')} onChange={(e) => set('status', e.target.value)}>
              {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Details" id="i-desc"><textarea id="i-desc" rows={3} className="input py-2" value={str('description')} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Link" id="i-link">
          <div className="flex gap-2">
            <input id="i-link" className="input" value={str('link')} onChange={(e) => set('link', e.target.value)} placeholder="https://…" />
            {str('link') && <a className="btn btn-ghost shrink-0 text-sm" href={hrefFor(str('link'))} target="_blank" rel="noreferrer">Open</a>}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estimated cost" id="i-cost"><input id="i-cost" className="input" inputMode="decimal" value={str('estimated_cost')} onChange={(e) => set('estimated_cost', e.target.value)} /></Field>
          <Field label="Vendor" id="i-vendor"><input id="i-vendor" className="input" value={str('vendor_name')} onChange={(e) => set('vendor_name', e.target.value)} /></Field>
        </div>
        <Field label="Vendor contact" id="i-vc"><input id="i-vc" className="input" value={str('vendor_contact')} onChange={(e) => set('vendor_contact', e.target.value)} placeholder="Name, phone, email" /></Field>

        {f.status === 'finalized' && (
          <fieldset className="space-y-3 rounded-xl border border-gold/40 bg-white p-3">
            <legend className="px-1 text-sm font-semibold text-burgundy">Finalized</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm text-navy">
              <input type="checkbox" className="h-5 w-5 accent-burgundy" checked={!!f.contract_signed} onChange={(e) => set('contract_signed', e.target.checked)} />
              Contract signed
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Deposit" id="i-dep"><input id="i-dep" className="input" inputMode="decimal" value={str('deposit_amount')} onChange={(e) => set('deposit_amount', e.target.value)} /></Field>
              <Field label="Deposit due" id="i-due"><input id="i-due" type="date" className="input" value={str('deposit_due')} onChange={(e) => set('deposit_due', e.target.value)} /></Field>
            </div>
            {isAdmin && idea && idea.status === 'finalized' && (
              budgetLine ? (
                <p className="text-sm text-emerald-800">✓ On the budget</p>
              ) : budgetLine === null ? (
                <button type="button" className="btn btn-ghost w-full text-sm" onClick={addToBudget}>Add to budget</button>
              ) : null
            )}
            {isAdmin && idea && idea.status !== 'finalized' && <p className="text-xs text-navy/60">Save as Finalized to add it to the budget.</p>}
          </fieldset>
        )}

        {error && <p role="alert" className="text-sm text-rose">{error}</p>}
        {msg && <p role="status" className="text-sm text-emerald-800">{msg}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1">Save</button>
          {idea && <button type="button" className="btn btn-ghost text-rose" onClick={remove}>Delete</button>}
        </div>
      </form>

      {idea && (
        <div className="mt-6 space-y-4 border-t border-gold/30 pt-4">
          <p className="text-sm text-navy/60">
            👍 {voters.length === 0 ? 'No votes yet' : voters.filter(Boolean).join(', ')}
            {idea.deposit_due && ` · Deposit due ${formatDate(idea.deposit_due)}`}
          </p>
          <Comments entityType="idea" entityId={idea.id} />
        </div>
      )}
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
