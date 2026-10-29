import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase, type AllowedUser, type Role } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { loadUsers } from '../lib/useUsers'
import { Icon } from '../components/Icon'

export default function Users() {
  const { me, refreshMe } = useAuth()
  const [users, setUsers] = useState<AllowedUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', role: 'volunteer' as Role })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('allowed_users').select('*').order('role').order('name')
    setUsers((data as AllowedUser[]) ?? [])
    loadUsers(true) // refresh the shared assignee list
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('allowed_users').insert({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
    })
    setSaving(false)
    if (error) {
      setError(error.code === '23505' ? 'That email is already on the list.' : error.message)
      return
    }
    setForm({ name: '', email: '', role: 'volunteer' })
    load()
  }

  async function setRole(u: AllowedUser, role: Role) {
    setError(null)
    const { error } = await supabase.from('allowed_users').update({ role }).eq('id', u.id)
    if (error) setError(error.message)
    await load()
    if (u.id === me?.id) refreshMe()
  }

  async function remove(u: AllowedUser) {
    if (!confirm(`Remove ${u.name} (${u.email})? They will no longer be able to sign in.`)) return
    setError(null)
    const { error } = await supabase.from('allowed_users').delete().eq('id', u.id)
    if (error) setError(error.message)
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl">Users</h1>
        <p className="mt-1 text-sm text-navy/70">
          Only these Google accounts can sign in. Volunteers can see and edit everything except Budget, Users and Settings.
        </p>
      </div>

      <form onSubmit={add} className="card grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <div>
          <label className="label" htmlFor="u-name">Name</label>
          <input id="u-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="u-email">Google email</label>
          <input id="u-email" type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="u-role">Role</label>
          <select id="u-role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="volunteer">Volunteer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button className="btn btn-primary" disabled={saving}>Add user</button>
      </form>

      {error && <div role="alert" className="rounded-lg border border-rose/40 bg-rose/10 p-3 text-sm text-burgundy">{error}</div>}

      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id} className="card flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-navy">{u.name}{u.id === me?.id && <span className="text-navy/50"> (you)</span>}</div>
              <div className="truncate text-sm text-navy/60">{u.email}</div>
            </div>
            <select
              aria-label={`Role for ${u.name}`}
              className="input w-auto"
              value={u.role}
              onChange={(e) => setRole(u, e.target.value as Role)}
            >
              <option value="volunteer">Volunteer</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn btn-ghost px-3" aria-label={`Remove ${u.name}`} onClick={() => remove(u)}>
              <Icon name="trash" className="h-5 w-5 text-burgundy" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
