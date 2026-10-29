import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useUsers } from '../../lib/useUsers'
import Sheet from '../../components/Sheet'
import Comments from '../../components/Comments'
import { STATUS_LABEL, type Task, type TaskStatus } from './types'

interface Option {
  id: string
  label: string
}

const KIND_LABEL: Record<string, string> = { auction: 'Auction', sponsor: 'Sponsor', distributor: 'Distributor' }

/** Create (task = null) or edit a task. */
export default function TaskSheet({
  open,
  task,
  defaults,
  onClose,
  onSaved,
}: {
  open: boolean
  task: Task | null
  defaults?: Partial<Pick<Task, 'due_date' | 'assignee_id' | 'company_id' | 'idea_id'>>
  onClose: () => void
  onSaved: () => void
}) {
  const { me } = useAuth()
  const users = useUsers()
  const [companies, setCompanies] = useState<Option[]>([])
  const [ideas, setIdeas] = useState<Option[]>([])
  const [form, setForm] = useState(blank())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function blank() {
    return {
      title: '',
      description: '',
      assignee_id: '',
      due_date: '',
      status: 'todo' as TaskStatus,
      company_id: '',
      idea_id: '',
      is_milestone: false,
    }
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      task
        ? {
            title: task.title,
            description: task.description ?? '',
            assignee_id: task.assignee_id ?? '',
            due_date: task.due_date ?? '',
            status: task.status,
            company_id: task.company_id ?? '',
            idea_id: task.idea_id ?? '',
            is_milestone: task.is_milestone,
          }
        : {
            ...blank(),
            assignee_id: defaults?.assignee_id ?? me?.id ?? '',
            due_date: defaults?.due_date ?? '',
            company_id: defaults?.company_id ?? '',
            idea_id: defaults?.idea_id ?? '',
          },
    )
    supabase
      .from('companies')
      .select('id, name, kind')
      .order('name')
      .then(({ data }) =>
        setCompanies((data ?? []).map((c) => ({ id: c.id, label: `${c.name} (${KIND_LABEL[c.kind] ?? c.kind})` }))),
      )
    supabase
      .from('ideas')
      .select('id, title')
      .order('title')
      .then(({ data }) => setIdeas((data ?? []).map((i) => ({ id: i.id, label: i.title }))))
  }, [open, task, defaults, me])

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const row = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      assignee_id: form.assignee_id || null,
      due_date: form.due_date || null,
      status: form.status,
      company_id: form.company_id || null,
      idea_id: form.idea_id || null,
      is_milestone: form.is_milestone,
    }
    const { error } = task
      ? await supabase.from('tasks').update(row).eq('id', task.id)
      : await supabase.from('tasks').insert(row)
    setSaving(false)
    if (error) return setError(error.message)
    onSaved()
    onClose()
  }

  async function remove() {
    if (!task || !confirm(`Delete "${task.title}"?`)) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) return setError(error.message)
    onSaved()
    onClose()
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Sheet open={open} title={task ? 'Edit task' : 'New task'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label" htmlFor="t-title">Task</label>
          <input id="t-title" className="input" required value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus={!task} />
        </div>

        <div role="radiogroup" aria-label="Status" className="grid grid-cols-3 gap-1 rounded-lg bg-parchment p-1">
          {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
            <button
              type="button"
              key={s}
              role="radio"
              aria-checked={form.status === s}
              onClick={() => set('status', s)}
              className={`min-h-11 rounded-md text-sm font-medium ${form.status === s ? 'bg-navy text-cream shadow' : 'text-navy/70'}`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="t-assignee">Assigned to</label>
            <select id="t-assignee" className="input" value={form.assignee_id} onChange={(e) => set('assignee_id', e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t-due">Due</label>
            <input id="t-due" type="date" className="input" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="t-desc">Details</label>
          <textarea id="t-desc" rows={3} className="input py-2" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="t-company">Company / sponsor</label>
            <select id="t-company" className="input" value={form.company_id} onChange={(e) => set('company_id', e.target.value)}>
              <option value="">None</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t-idea">Idea</label>
            <select id="t-idea" className="input" value={form.idea_id} onChange={(e) => set('idea_id', e.target.value)}>
              <option value="">None</option>
              {ideas.map((i) => (
                <option key={i.id} value={i.id}>{i.label}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex min-h-11 items-center gap-3 text-sm text-navy">
          <input type="checkbox" className="h-5 w-5 accent-burgundy" checked={form.is_milestone} onChange={(e) => set('is_milestone', e.target.checked)} />
          Event milestone (shown on the calendar in gold)
        </label>

        {error && <p role="alert" className="text-sm text-rose">{error}</p>}

        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          {task && (
            <button type="button" className="btn btn-ghost text-rose" onClick={remove}>Delete</button>
          )}
        </div>
      </form>

      {task && (
        <div className="mt-6 border-t border-gold/30 pt-4">
          <Comments entityType="task" entityId={task.id} />
        </div>
      )}
    </Sheet>
  )
}
