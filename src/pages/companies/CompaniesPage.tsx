import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useUsers, firstName } from '../../lib/useUsers'
import { useAuth } from '../../lib/auth'
import { formatDate } from '../../lib/dates'
import { money } from '../../lib/format'
import CompanyForm from './CompanyForm'
import { KINDS, STATUSES, STATUS_LABEL, StatusPill, type Company, type CompanyStatus, type Kind, type SponsorLevel } from './types'

type SortKey = 'name' | 'status' | 'last_contact' | 'owner' | 'updated'

export default function CompaniesPage() {
  const { me } = useAuth()
  const users = useUsers()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const kind = (params.get('kind') as Kind) || 'auction'
  const [companies, setCompanies] = useState<Company[]>([])
  const [levels, setLevels] = useState<SponsorLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // filters live in the URL so the back button returns to the same list
  const status = (params.get('status') as CompanyStatus | null) ?? null
  const owner = params.get('owner') ?? 'any'
  const q = params.get('q') ?? ''
  const sort = (params.get('sort') as SortKey) ?? 'name'
  const needsReceipt = params.get('receipt') === 'needed'

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null || value === '' || value === 'any') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const load = useCallback(async () => {
    const { data } = await supabase.from('companies').select('*').eq('kind', kind).order('name')
    setCompanies((data as Company[]) ?? [])
    setLoading(false)
  }, [kind])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useEffect(() => {
    supabase.from('sponsor_levels').select('*').order('sort_order').then(({ data }) => setLevels((data as SponsorLevel[]) ?? []))
  }, [])

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<CompanyStatus, number>
    companies.forEach((x) => c[x.status]++)
    return c
  }, [companies])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const userName = (id: string | null) => users.find((u) => u.id === id)?.name ?? '~'
    const list = companies.filter(
      (c) =>
        (!status || c.status === status) &&
        (!needsReceipt || (c.status === 'yes' && !c.receipt_sent_on)) &&
        (owner === 'any' || (owner === 'none' ? !c.owner_id : owner === 'me' ? c.owner_id === me?.id : c.owner_id === owner)) &&
        (!needle ||
          [c.name, c.contact_name, c.category, c.email].some((v) => (v ?? '').toLowerCase().includes(needle))),
    )
    const by: Record<SortKey, (a: Company, b: Company) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || a.name.localeCompare(b.name),
      last_contact: (a, b) => (b.last_contact_date ?? '').localeCompare(a.last_contact_date ?? ''),
      owner: (a, b) => userName(a.owner_id).localeCompare(userName(b.owner_id)) || a.name.localeCompare(b.name),
      updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
    }
    return [...list].sort(by[sort])
  }, [companies, status, owner, q, sort, users, me, needsReceipt])

  const receiptsDue = companies.filter((c) => c.status === 'yes' && !c.receipt_sent_on).length

  const levelName = (id: string | null) => levels.find((l) => l.id === id)?.name
  const ownerName = (id: string | null) => firstName(users.find((u) => u.id === id)?.name) || '—'
  const kindInfo = KINDS.find((k) => k.id === kind)!

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-2xl md:text-3xl">Outreach</h1>
        <Link to={`/outreach/import?kind=${kind}`} className="btn btn-ghost text-sm">Import CSV</Link>
        <button className="btn btn-accent text-sm" onClick={() => setCreating(true)}>+ Add</button>
      </div>

      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-parchment p-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            role="tab"
            aria-selected={kind === k.id}
            onClick={() => setParams({ kind: k.id }, { replace: true })}
            className={`min-h-11 rounded-md px-1 text-sm font-medium ${kind === k.id ? 'bg-navy text-cream shadow' : 'text-navy/70'}`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind === 'sponsor' && companies.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="card py-3">
            <div className="text-xs text-navy/60">Committed</div>
            <div className="font-serif text-xl text-navy">{money(companies.reduce((s, c) => s + (c.status === 'yes' ? Number(c.amount_committed ?? 0) : 0), 0))}</div>
          </div>
          <div className="card py-3">
            <div className="text-xs text-navy/60">Paid</div>
            <div className="font-serif text-xl text-navy">{money(companies.reduce((s, c) => s + Number(c.amount_paid ?? 0), 0))}</div>
          </div>
        </div>
      )}

      {/* status chips double as a filter */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <Chip active={!status} onClick={() => setParam('status', null)}>All {companies.length}</Chip>
        {STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setParam('status', status === s ? null : s)}>
            {STATUS_LABEL[s]} {counts[s]}
          </Chip>
        ))}
        {kind !== 'distributor' && receiptsDue > 0 && (
          <Chip active={needsReceipt} onClick={() => setParam('receipt', needsReceipt ? null : 'needed')}>
            🧾 Needs receipt {receiptsDue}
          </Chip>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <input className="input" type="search" placeholder="Search name, contact, category" value={q} onChange={(e) => setParam('q', e.target.value)} aria-label="Search" />
        <select className="input" value={owner} onChange={(e) => setParam('owner', e.target.value)} aria-label="Filter by owner">
          <option value="any">Any owner</option>
          <option value="me">Mine</option>
          <option value="none">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <select className="input" value={sort} onChange={(e) => setParam('sort', e.target.value === 'name' ? null : e.target.value)} aria-label="Sort by">
          <option value="name">Sort: Name</option>
          <option value="status">Sort: Status</option>
          <option value="last_contact">Sort: Last contact</option>
          <option value="owner">Sort: Owner</option>
          <option value="updated">Sort: Recently updated</option>
        </select>
      </div>

      {loading ? (
        <p className="text-navy/50">Loading…</p>
      ) : companies.length === 0 ? (
        <div className="card text-center text-navy/70">
          No {kindInfo.singular}s yet. <button className="text-burgundy underline" onClick={() => setCreating(true)}>Add one</button> or{' '}
          <Link className="text-burgundy underline" to={`/outreach/import?kind=${kind}`}>import a CSV</Link>.
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-navy/50">Nothing matches these filters.</p>
      ) : (
        <>
          {/* phones: cards */}
          <ul className="card divide-y divide-gold/20 overflow-hidden p-0 md:hidden">
            {shown.map((c) => (
              <li key={c.id}>
                <Link to={`/outreach/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-navy">{c.name}</div>
                    <div className="truncate text-xs text-navy/60">
                      {[c.contact_name, kind === 'sponsor' && levelName(c.sponsor_level_id), ownerName(c.owner_id)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <StatusPill status={c.status} />
                </Link>
              </li>
            ))}
          </ul>

          {/* larger screens: table */}
          <div className="card hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <thead className="bg-parchment text-left text-xs text-navy/70">
                <tr>
                  <th className="px-4 py-2 font-medium">Company</th>
                  <th className="px-4 py-2 font-medium">Contact</th>
                  {kind === 'sponsor' && <th className="px-4 py-2 font-medium">Level</th>}
                  {kind === 'sponsor' && <th className="px-4 py-2 text-right font-medium">Committed</th>}
                  {kind === 'distributor' && <th className="px-4 py-2 font-medium">Product</th>}
                  <th className="px-4 py-2 font-medium">Owner</th>
                  <th className="px-4 py-2 font-medium">Last contact</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/15">
                {shown.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-cream" onClick={() => navigate(`/outreach/${c.id}`)}>
                    <td className="px-4 py-2.5">
                      <Link to={`/outreach/${c.id}`} className="font-medium text-navy hover:underline" onClick={(e) => e.stopPropagation()}>{c.name}</Link>
                      {c.category && <div className="text-xs text-navy/50">{c.category}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-navy/80">{c.contact_name}</td>
                    {kind === 'sponsor' && <td className="px-4 py-2.5">{levelName(c.sponsor_level_id) ?? '—'}</td>}
                    {kind === 'sponsor' && <td className="px-4 py-2.5 text-right tabular-nums">{money(c.amount_committed)}</td>}
                    {kind === 'distributor' && <td className="px-4 py-2.5">{c.product_provided}</td>}
                    <td className="px-4 py-2.5">{ownerName(c.owner_id)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(c.last_contact_date) || '—'}</td>
                    <td className="px-4 py-2.5"><StatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <CompanyForm
        open={creating}
        kind={kind}
        company={null}
        onClose={() => setCreating(false)}
        onSaved={(id) => navigate(`/outreach/${id}`)}
      />
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-9 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap ${
        active ? 'border-navy bg-navy text-cream' : 'border-navy/20 bg-white text-navy/80'
      }`}
    >
      {children}
    </button>
  )
}
