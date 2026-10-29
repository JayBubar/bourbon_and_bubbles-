export type TaskStatus = 'todo' | 'doing' | 'done'

export interface Task {
  id: string
  title: string
  description: string | null
  assignee_id: string | null
  due_date: string | null
  status: TaskStatus
  company_id: string | null
  idea_id: string | null
  is_milestone: boolean
  completed_at: string | null
  company: { name: string; kind: string } | null
  idea: { title: string } | null
}

export const TASK_SELECT = '*, company:companies(name, kind), idea:ideas(title)'

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
}
