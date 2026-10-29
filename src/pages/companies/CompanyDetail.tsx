import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useUsers } from '../../lib/useUsers'
import { formatDate } from '../../lib/dates'
import { hrefFor } from '../../lib/format'
import Comments from '../../components/Comments'
import TaskRow from '../tasks/TaskRow'
import TaskSheet from '../tasks/TaskSheet'
import { TASK_SELECT, type Task } from '../tasks/types'
import CompanyForm from './CompanyForm'
import LogCallSheet from './LogCallSheet'
import AuctionItems from './AuctionItems'
import SponsorPanel from './SponsorPanel'
import { KINDS, StatusPill, type Company } from './types'

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const users = useUsers()
  const [company, setCompany] = useState<Company | null>(null)
  const [missing, setMissing] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [sheet, setSheet] = useState<'edit' | 'log' | 'task' | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [commentsKey, setCommentsKey] = useState(0)

  const load = useCallback(async () => {
    const { data } = await supabase.from('companies').select('*').eq('id', id!).maybeSingle()
    if (!data) setMissing(true)
    setCompany(data as Company | null)
  }, [id])

  const loadTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select(TASK_SELECT).eq('company_id', id!).order('due_date', { nullsFirst: false })
    setTasks((data as unknown as Task[]) ?? [])
  }, [id])

  useEffect(() => {
    load()
    loadTasks()
  }, [load, loadTasks])

  const taskDefaults = useMemo(() => ({ company_id: id }), [id])

  async function toggleTask(t: Task) {
    await supabase.from('tasks').update({ status: t.status === 'done' ? 'todo' : 'done' }).eq('id', t.id)
    loadTasks()
  }

  async function remove() {
    if (!company || !confirm(`Delete ${company.name} and everything recorded for it? This can't be undone.`)) return
    await supabase.from('companies').delete().eq('id', company.id)
    navigate(`/outreach?kind=${company.kind}`, { replace: true })
  }

  if (missing) {
    return (
      <div className="card text-center">
        That company no longer exists. <Link to="/outreach" className="text-burgundy underline">Back to Outreach</Link>
      </div>
    )
  }
  if (!company) return <p className="text-navy/50">Loading…</p>

  const owner = users.find((u) => u.id === company.owner_id)
  const receiptSender = users.find((u) => u.id === company.receipt_sent_by)
  const kindInfo = KINDS.find((k) => k.id === company.kind)!

  return (
    <div className="space-y-5">
      <Link to={`/outreach?kind=${company.kind}`} className="inline-flex min-h-11 items-center text-sm text-burgundy">
        ‹ {kindInfo.label}
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-start gap-2">
          <h1 className="min-w-0 flex-1 text-2xl break-words md:text-3xl">{company.name}</h1>
          <StatusPill status={company.status} />
        </div>
        <p className="text-sm text-navy/70">
          {[company.category, owner ? `Owner: ${owner.name}` : 'No owner yet', company.last_contact_date && `Last contact ${formatDate(company.last_contact_date)}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-accent" onClick={() => setSheet('log')}>Log a call</button>
        <button className="btn btn-ghost" onClick={() => setSheet('edit')}>Edit details</button>
      </div>

      {/* contact card with tap-to-call/email */}
      {(company.contact_name || company.email || company.phone || company.website || company.address) && (
        <section className="card space-y-2 text-sm">
          {company.contact_name && (
            <div className="font-medium text-navy">
              {company.contact_name}
              {company.contact_title && <span className="font-normal text-navy/60">, {company.contact_title}</span>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {company.phone && <a className="btn btn-ghost text-sm" href={`tel:${company.phone.replace(/[^\d+]/g, '')}`}>📞 {company.phone}</a>}
            {company.email && <a className="btn btn-ghost max-w-full truncate text-sm" href={`mailto:${company.email}`}>✉️ {company.email}</a>}
            {company.website && <a className="btn btn-ghost max-w-full truncate text-sm" href={hrefFor(company.website)} target="_blank" rel="noreferrer">🌐 Website</a>}
          </div>
          {company.address && (
            <a className="block text-navy/70 underline-offset-2 hover:underline" href={`https://maps.google.com/?q=${encodeURIComponent(company.address)}`} target="_blank" rel="noreferrer">
              {company.address}
            </a>
          )}
        </section>
      )}

      {company.kind === 'sponsor' && <SponsorPanel company={company} onEdit={() => setSheet('edit')} />}
      {company.kind === 'auction' && <AuctionItems company={company} />}
      {company.kind === 'distributor' && (company.product_provided || company.tasting_host) && (
        <section className="card grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-navy/60">Product provided</div>
            <div className="font-medium text-navy">{company.product_provided ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-navy/60">Tasting host</div>
            <div className="font-medium text-navy">{company.tasting_host ?? '—'}</div>
          </div>
        </section>
      )}
      {company.kind === 'distributor' && (
        <p className="text-xs text-navy/60">Questions about distributor partners go to Virginia Wells.</p>
      )}

      {company.kind !== 'distributor' && (
        <section className="card flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg">Donation receipt</h2>
            <p className={`text-sm ${company.receipt_sent_on ? 'text-emerald-800' : 'text-navy/60'}`}>
              {company.receipt_sent_on
                ? `Sent ${formatDate(company.receipt_sent_on, { year: 'numeric' })}${receiptSender ? ` by ${receiptSender.name}` : ''}`
                : company.status === 'yes'
                  ? 'Not sent yet'
                  : 'Available once they say yes'}
            </p>
          </div>
          <Link to={`/receipt/${company.id}`} className="btn btn-ghost text-sm">
            {company.receipt_sent_on ? 'View receipt' : 'Create receipt'}
          </Link>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-lg">Tasks</h2>
          <button className="btn btn-ghost text-sm" onClick={() => setSheet('task')}>+ Task</button>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-navy/60">No tasks linked to {company.name}.</p>
        ) : (
          <ul className="card divide-y divide-gold/20 overflow-hidden p-0">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={{ ...t, company: null }} users={users} onToggle={toggleTask} onOpen={setEditingTask} />
            ))}
          </ul>
        )}
      </section>

      {company.notes && (
        <section className="card text-sm">
          <div className="text-xs text-navy/60">Imported notes</div>
          <p className="whitespace-pre-wrap">{company.notes}</p>
        </section>
      )}

      <div className="card">
        <Comments key={commentsKey} entityType="company" entityId={company.id} />
      </div>

      <button className="btn w-full text-sm text-rose" onClick={remove}>Delete {company.name}</button>

      <CompanyForm open={sheet === 'edit'} kind={company.kind} company={company} onClose={() => setSheet(null)} onSaved={load} />
      <LogCallSheet
        open={sheet === 'log'}
        company={company}
        onClose={() => setSheet(null)}
        onSaved={() => {
          load()
          setCommentsKey((k) => k + 1)
        }}
      />
      <TaskSheet open={sheet === 'task'} task={null} defaults={taskDefaults} onClose={() => setSheet(null)} onSaved={loadTasks} />
      <TaskSheet open={!!editingTask} task={editingTask} onClose={() => setEditingTask(null)} onSaved={loadTasks} />
    </div>
  )
}
