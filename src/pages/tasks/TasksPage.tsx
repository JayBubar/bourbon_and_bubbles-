import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useUsers } from '../../lib/useUsers'
import { addDays, todayISO } from '../../lib/dates'
import TaskRow from './TaskRow'
import TaskSheet from './TaskSheet'
import CalendarView from './CalendarView'
import { TASK_SELECT, type Task } from './types'

type View = 'mine' | 'all' | 'calendar'
const VIEWS: { id: View; label: string }[] = [
  { id: 'mine', label: 'My Tasks' },
  { id: 'all', label: 'All Tasks' },
  { id: 'calendar', label: 'Calendar' },
]

const isPhone = () => window.matchMedia('(max-width: 767px)').matches

export default function TasksPage() {
  const { me } = useAuth()
  const users = useUsers()
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) || (isPhone() ? 'mine' : 'all')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Task | null>(null)
  const [creating, setCreating] = useState<{ due_date?: string } | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('tasks').select(TASK_SELECT).order('due_date', { nullsFirst: false }).order('created_at')
    setTasks((data as unknown as Task[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggle = useCallback(async (t: Task) => {
    const status = t.status === 'done' ? 'todo' : 'done'
    setTasks((all) => all.map((x) => (x.id === t.id ? { ...x, status } : x))) // optimistic
    const { error } = await supabase.from('tasks').update({ status }).eq('id', t.id)
    if (error) load()
  }, [load])

  const open = useCallback((t: Task) => setEditing(t), [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-2xl md:text-3xl">Tasks</h1>
        <button className="btn btn-accent hidden md:inline-flex" onClick={() => setCreating({})}>+ New task</button>
      </div>

      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-parchment p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            onClick={() => setParams({ view: v.id }, { replace: true })}
            className={`min-h-11 rounded-md text-sm font-medium ${view === v.id ? 'bg-navy text-cream shadow' : 'text-navy/70'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-navy/50">Loading…</p>
      ) : view === 'mine' ? (
        <MyTasks tasks={tasks.filter((t) => t.assignee_id === me?.id)} users={users} onToggle={toggle} onOpen={open} />
      ) : view === 'all' ? (
        <AllTasks tasks={tasks} users={users} onToggle={toggle} onOpen={open} />
      ) : (
        <CalendarView tasks={tasks} users={users} onToggle={toggle} onOpen={open} onAdd={(d) => setCreating({ due_date: d })} />
      )}

      {/* floating add button on phones */}
      <button
        onClick={() => setCreating({})}
        className="fixed right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-burgundy text-3xl text-cream shadow-lg md:hidden"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
        aria-label="New task"
      >
        +
      </button>

      <TaskSheet open={!!editing} task={editing} onClose={() => setEditing(null)} onSaved={load} />
      <TaskSheet open={!!creating} task={null} defaults={creating ?? undefined} onClose={() => setCreating(null)} onSaved={load} />
    </div>
  )
}

interface ListProps {
  tasks: Task[]
  users: ReturnType<typeof useUsers>
  onToggle: (t: Task) => void
  onOpen: (t: Task) => void
}

function Group({ title, tasks, tone, ...rest }: ListProps & { title: string; tone?: string; showAssignee?: boolean }) {
  if (tasks.length === 0) return null
  return (
    <section>
      <h2 className={`mb-2 font-sans text-sm font-semibold tracking-wide uppercase ${tone ?? 'text-navy/60'}`}>
        {title} <span className="font-normal">({tasks.length})</span>
      </h2>
      <ul className="card divide-y divide-gold/20 overflow-hidden p-0">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} {...rest} />
        ))}
      </ul>
    </section>
  )
}

function MyTasks({ tasks, ...rest }: ListProps) {
  const [showDone, setShowDone] = useState(false)
  const today = todayISO()
  const weekEnd = addDays(today, 7)
  const open = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')

  if (tasks.length === 0) {
    return (
      <div className="card text-center text-navy/70">
        Nothing assigned to you yet. Check <strong>All Tasks</strong> to pick one up.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Group title="Overdue" tone="text-rose" tasks={open.filter((t) => t.due_date && t.due_date < today)} showAssignee={false} {...rest} />
      <Group title="Next 7 days" tasks={open.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd)} showAssignee={false} {...rest} />
      <Group title="Later" tasks={open.filter((t) => t.due_date && t.due_date > weekEnd)} showAssignee={false} {...rest} />
      <Group title="No due date" tasks={open.filter((t) => !t.due_date)} showAssignee={false} {...rest} />
      {open.length === 0 && <div className="card text-center text-navy/70">All caught up. 🥂</div>}
      {done.length > 0 && (
        <div>
          <button className="btn px-0 text-sm text-burgundy" onClick={() => setShowDone((s) => !s)}>
            {showDone ? 'Hide' : 'Show'} completed ({done.length})
          </button>
          {showDone && <Group title="Completed" tasks={done} showAssignee={false} {...rest} />}
        </div>
      )}
    </div>
  )
}

function AllTasks({ tasks, users, ...rest }: ListProps) {
  const [assignee, setAssignee] = useState('any')
  const [status, setStatus] = useState<'open' | 'done' | 'all'>('open')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return tasks.filter(
      (t) =>
        (assignee === 'any' || (assignee === 'none' ? !t.assignee_id : t.assignee_id === assignee)) &&
        (status === 'all' || (status === 'done' ? t.status === 'done' : t.status !== 'done')) &&
        (!needle || t.title.toLowerCase().includes(needle) || (t.description ?? '').toLowerCase().includes(needle)),
    )
  }, [tasks, assignee, status, q])

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <input className="input" type="search" placeholder="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tasks" />
        <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Filter by person">
          <option value="any">Everyone</option>
          <option value="none">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status">
          <option value="open">Open</option>
          <option value="done">Done</option>
          <option value="all">All</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-navy/50">No tasks match.</p>
      ) : (
        <ul className="card divide-y divide-gold/20 overflow-hidden p-0">
          {filtered.map((t) => (
            <TaskRow key={t.id} task={t} users={users} {...rest} />
          ))}
        </ul>
      )}
    </div>
  )
}
