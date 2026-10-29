import type { AllowedUser } from '../../lib/supabase'
import { relativeDay, todayISO } from '../../lib/dates'
import { firstName } from '../../lib/useUsers'
import { STATUS_LABEL, type Task } from './types'

export default function TaskRow({
  task,
  users,
  showAssignee = true,
  onToggle,
  onOpen,
}: {
  task: Task
  users: AllowedUser[]
  showAssignee?: boolean
  onToggle: (t: Task) => void
  onOpen: (t: Task) => void
}) {
  const done = task.status === 'done'
  const overdue = !done && task.due_date !== null && task.due_date < todayISO()
  const assignee = users.find((u) => u.id === task.assignee_id)

  return (
    <li className="flex items-stretch gap-1 bg-white">
      <button
        onClick={() => onToggle(task)}
        className="flex w-14 shrink-0 items-center justify-center"
        aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition ${
            done ? 'border-burgundy bg-burgundy text-cream' : 'border-navy/30 hover:border-burgundy'
          }`}
        >
          {done && '✓'}
        </span>
      </button>
      <button onClick={() => onOpen(task)} className="min-h-14 min-w-0 flex-1 py-2.5 pr-4 text-left">
        <div className={`font-medium ${done ? 'text-navy/40 line-through' : 'text-navy'}`}>
          {task.is_milestone && <span className="mr-1 text-gold" title="Milestone">◆</span>}
          {task.title}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-navy/60">
          {task.due_date && (
            <span className={overdue ? 'font-semibold text-rose' : ''}>
              {overdue ? 'Overdue · ' : ''}
              {relativeDay(task.due_date)}
            </span>
          )}
          {showAssignee && <span>{assignee ? firstName(assignee.name) : 'Unassigned'}</span>}
          {task.status === 'doing' && <span className="text-burgundy">{STATUS_LABEL.doing}</span>}
          {task.company && <span className="truncate">↳ {task.company.name}</span>}
          {task.idea && <span className="truncate">↳ {task.idea.title}</span>}
        </div>
      </button>
    </li>
  )
}
