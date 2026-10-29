import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Profile() {
  const { me, refreshMe } = useAuth()
  const [saving, setSaving] = useState(false)
  if (!me) return null

  async function toggleReminders() {
    setSaving(true)
    await supabase.rpc('set_my_reminders', { enabled: !me!.reminders_enabled })
    await refreshMe()
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">My profile</h1>
      <div className="card space-y-1">
        <div className="text-lg font-semibold text-navy">{me.name}</div>
        <div className="text-sm text-navy/70">{me.email}</div>
        <div className="text-sm capitalize text-navy/70">Role: {me.role}</div>
      </div>
      <label className="card flex min-h-14 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-6 w-6 accent-burgundy"
          checked={me.reminders_enabled}
          disabled={saving}
          onChange={toggleReminders}
        />
        <span>
          <span className="block font-medium text-navy">Email me task reminders</span>
          <span className="block text-sm text-navy/60">Around 6 PM the evening before a task is due, plus anything overdue.</span>
        </span>
      </label>
    </div>
  )
}
