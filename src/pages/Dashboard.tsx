import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

interface Activity {
  id: number
  summary: string
  created_at: string
  actor: { name: string } | null
}

const EVENT = new Date('2027-04-09T18:00:00-04:00')

export default function Dashboard() {
  const { me } = useAuth()
  const [activity, setActivity] = useState<Activity[]>([])
  const days = Math.max(0, Math.ceil((EVENT.getTime() - Date.now()) / 86_400_000))

  useEffect(() => {
    supabase
      .from('activity_log')
      .select('id, summary, created_at, actor:allowed_users(name)')
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => setActivity((data as unknown as Activity[]) ?? []))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl">Welcome, {me?.name.split(' ')[0]}</h1>
        <p className="mt-1 text-navy/70">
          <span className="font-semibold text-burgundy">{days} days</span> until Bourbon &amp; Bubbles · Friday, April 9, 2027
        </p>
      </div>

      <div className="card border-dashed text-sm text-navy/70">
        The dashboard tiles (tickets, money raised, sponsors, auction, tasks) will appear here as each module comes online.
      </div>

      <section>
        <h2 className="mb-3 text-xl">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-navy/60">Nothing yet.</p>
        ) : (
          <ul className="card divide-y divide-gold/20 p-0">
            {activity.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <span className="font-medium text-navy">{a.actor?.name ?? 'System'}</span> {a.summary}
                <div className="text-xs text-navy/50">{new Date(a.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
