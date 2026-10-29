import { useMemo, useState } from 'react'
import type { AllowedUser } from '../../lib/supabase'
import { EVENT_DATE, formatDate, todayISO } from '../../lib/dates'
import TaskRow from './TaskRow'
import type { Task } from './types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function monthCells(year: number, month: number): string[] {
  // 6 weeks starting on the Sunday on/before the 1st
  const first = new Date(Date.UTC(year, month, 1))
  const start = new Date(first)
  start.setUTCDate(1 - first.getUTCDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

export default function CalendarView({
  tasks,
  users,
  onToggle,
  onOpen,
  onAdd,
}: {
  tasks: Task[]
  users: AllowedUser[]
  onToggle: (t: Task) => void
  onOpen: (t: Task) => void
  onAdd: (dueDate: string) => void
}) {
  const today = todayISO()
  const [cursor, setCursor] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 }))
  const [selected, setSelected] = useState(today)

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.due_date) continue
      map.set(t.due_date, [...(map.get(t.due_date) ?? []), t])
    }
    return map
  }, [tasks])

  const cells = monthCells(cursor.y, cursor.m)
  const monthKey = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`
  const title = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })
  const move = (delta: number) =>
    setCursor(({ y, m }) => {
      const n = m + delta
      return { y: y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 }
    })
  const dayTasks = byDay.get(selected) ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost px-3" onClick={() => move(-1)} aria-label="Previous month">‹</button>
        <h2 className="flex-1 text-center text-xl">{title}</h2>
        <button className="btn btn-ghost px-3" onClick={() => move(1)} aria-label="Next month">›</button>
      </div>
      <div className="flex justify-center gap-2 text-sm">
        <button className="text-burgundy underline-offset-2 hover:underline" onClick={() => { setCursor({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 }); setSelected(today) }}>
          Today
        </button>
        <span className="text-navy/30">·</span>
        <button className="text-burgundy underline-offset-2 hover:underline" onClick={() => { setCursor({ y: 2027, m: 3 }); setSelected(EVENT_DATE) }}>
          Event day
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-gold/30 bg-parchment text-center text-xs font-medium text-navy/70">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((iso) => {
            const inMonth = iso.startsWith(monthKey)
            const list = byDay.get(iso) ?? []
            const isEvent = iso === EVENT_DATE
            const isSel = iso === selected
            return (
              <button
                key={iso}
                onClick={() => setSelected(iso)}
                className={`relative flex min-h-14 flex-col items-stretch border-r border-b border-gold/15 p-1 text-left align-top md:min-h-24 ${
                  inMonth ? 'bg-white' : 'bg-cream/60 text-navy/30'
                } ${isSel ? 'ring-2 ring-inset ring-burgundy' : ''} ${isEvent ? 'bg-gold/20' : ''}`}
                aria-label={`${formatDate(iso, { weekday: 'long', month: 'long' })}, ${list.length} tasks`}
              >
                <span
                  className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs md:mx-0 ${
                    iso === today ? 'bg-burgundy font-semibold text-cream' : ''
                  }`}
                >
                  {+iso.slice(8)}
                </span>
                {isEvent && <span className="hidden truncate text-[10px] font-semibold text-burgundy md:block">🥃 Bourbon &amp; Bubbles</span>}
                {/* phones: dots */}
                <span className="mt-0.5 flex flex-wrap justify-center gap-0.5 md:hidden">
                  {isEvent && <span className="h-1.5 w-1.5 rounded-full bg-burgundy" />}
                  {list.slice(0, 4).map((t) => (
                    <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${t.status === 'done' ? 'bg-navy/20' : t.is_milestone ? 'bg-gold' : 'bg-navy'}`} />
                  ))}
                </span>
                {/* larger screens: titles */}
                <span className="hidden space-y-0.5 md:block">
                  {list.slice(0, 3).map((t) => (
                    <span
                      key={t.id}
                      className={`block truncate rounded px-1 text-[11px] leading-4 ${
                        t.status === 'done' ? 'text-navy/40 line-through' : t.is_milestone ? 'bg-gold/25 text-navy' : 'bg-navy/10 text-navy'
                      }`}
                    >
                      {t.title}
                    </span>
                  ))}
                  {list.length > 3 && <span className="block px-1 text-[11px] text-navy/50">+{list.length - 3} more</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="flex-1 text-lg">{formatDate(selected, { weekday: 'long', month: 'long', year: 'numeric' })}</h3>
          <button className="btn btn-ghost text-sm" onClick={() => onAdd(selected)}>+ Task</button>
        </div>
        {selected === EVENT_DATE && (
          <p className="mb-2 rounded-lg bg-gold/20 px-3 py-2 text-sm text-navy">
            🥃 <strong>Bourbon &amp; Bubbles</strong>, 6:00 PM at The Laundry
          </p>
        )}
        {dayTasks.length === 0 ? (
          <p className="text-sm text-navy/50">Nothing due this day.</p>
        ) : (
          <ul className="card divide-y divide-gold/20 overflow-hidden p-0">
            {dayTasks.map((t) => (
              <TaskRow key={t.id} task={t} users={users} onToggle={onToggle} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
