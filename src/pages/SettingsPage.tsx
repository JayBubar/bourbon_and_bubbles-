import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useSettings, type Settings } from '../lib/settings'
import { money, parseMoney } from '../lib/format'
import type { SponsorLevel } from './companies/types'

const TZ = 'America/New_York'

// "2027-04-09T22:00:00+00:00" → { date: '2027-04-09', time: '18:00' } in Eastern
function toEastern(ts: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ts))
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

// Eastern wall-clock date+time → UTC ISO string (handles daylight saving)
function fromEastern(date: string, time: string) {
  const guess = new Date(`${date}T${time}:00Z`)
  const shown = toEastern(guess.toISOString())
  const drift = new Date(`${shown.date}T${shown.time}:00Z`).getTime() - guess.getTime()
  return new Date(guess.getTime() - drift).toISOString()
}

export default function SettingsPage() {
  const { settings, reload } = useSettings()
  const [form, setForm] = useState<Record<string, string | boolean>>({})
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!settings) return
    const { date, time } = toEastern(settings.event_starts_at)
    setForm({
      event_name: settings.event_name,
      event_date: date,
      event_time: time,
      venue: settings.venue,
      ticket_price: String(settings.ticket_price),
      capacity: String(settings.capacity),
      revenue_goal: String(settings.revenue_goal),
      reminders_enabled: settings.reminders_enabled,
      org_name: settings.org_name,
      org_ein: settings.org_ein,
      org_address: settings.org_address ?? '',
      receipt_signer_name: settings.receipt_signer_name,
      receipt_signer_title: settings.receipt_signer_title ?? '',
      tax_status_statement: settings.tax_status_statement,
    })
  }, [settings])

  const str = (k: string) => (form[k] as string) ?? ''
  const set = (k: string, v: string | boolean) => {
    setSaved(false)
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const row: Partial<Settings> = {
      event_name: str('event_name').trim(),
      event_starts_at: fromEastern(str('event_date'), str('event_time')),
      venue: str('venue').trim(),
      ticket_price: parseMoney(str('ticket_price')) ?? 0,
      capacity: Number(str('capacity')) || 0,
      revenue_goal: parseMoney(str('revenue_goal')) ?? 0,
      reminders_enabled: !!form.reminders_enabled,
      org_name: str('org_name').trim(),
      org_ein: str('org_ein').trim(),
      org_address: str('org_address').trim() || null,
      receipt_signer_name: str('receipt_signer_name').trim(),
      receipt_signer_title: str('receipt_signer_title').trim() || null,
      tax_status_statement: str('tax_status_statement').trim(),
    }
    const { error } = await supabase.from('settings').update(row).eq('id', 1)
    if (error) return setError(error.message)
    await reload()
    setSaved(true)
  }

  if (!settings) return <p className="text-navy/50">Loading…</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl">Settings</h1>

      <form onSubmit={save} className="space-y-6">
        <Section title="Event">
          <Field label="Event name" id="s-name"><input id="s-name" className="input" required value={str('event_name')} onChange={(e) => set('event_name', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" id="s-date"><input id="s-date" type="date" className="input" required value={str('event_date')} onChange={(e) => set('event_date', e.target.value)} /></Field>
            <Field label="Start time (Eastern)" id="s-time"><input id="s-time" type="time" className="input" required value={str('event_time')} onChange={(e) => set('event_time', e.target.value)} /></Field>
          </div>
          <Field label="Venue" id="s-venue"><input id="s-venue" className="input" value={str('venue')} onChange={(e) => set('venue', e.target.value)} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Ticket price" id="s-price"><input id="s-price" className="input" inputMode="decimal" value={str('ticket_price')} onChange={(e) => set('ticket_price', e.target.value)} /></Field>
            <Field label="Seat capacity" id="s-cap"><input id="s-cap" type="number" min={0} className="input" value={str('capacity')} onChange={(e) => set('capacity', e.target.value)} /></Field>
            <Field label="Revenue goal" id="s-goal"><input id="s-goal" className="input" inputMode="decimal" value={str('revenue_goal')} onChange={(e) => set('revenue_goal', e.target.value)} /></Field>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm text-navy">
            <input type="checkbox" className="h-5 w-5 accent-burgundy" checked={!!form.reminders_enabled} onChange={(e) => set('reminders_enabled', e.target.checked)} />
            Send daily task reminder emails (6 PM Eastern; needs the Resend setup in the README)
          </label>
        </Section>

        <Section title="Donation receipts">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Organization name" id="s-org"><input id="s-org" className="input" required value={str('org_name')} onChange={(e) => set('org_name', e.target.value)} /></Field>
            <Field label="EIN" id="s-ein"><input id="s-ein" className="input" required value={str('org_ein')} onChange={(e) => set('org_ein', e.target.value)} /></Field>
          </div>
          <Field label="Mailing address" id="s-addr">
            <textarea id="s-addr" rows={2} className="input py-2" placeholder={'123 Main St\nColumbia, SC 29201'} value={str('org_address')} onChange={(e) => set('org_address', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Signed by" id="s-signer"><input id="s-signer" className="input" required value={str('receipt_signer_name')} onChange={(e) => set('receipt_signer_name', e.target.value)} /></Field>
            <Field label="Signer's title" id="s-title"><input id="s-title" className="input" placeholder="e.g. Executive Director" value={str('receipt_signer_title')} onChange={(e) => set('receipt_signer_title', e.target.value)} /></Field>
          </div>
          <Field label="Tax status statement (printed on every receipt)" id="s-tax">
            <textarea id="s-tax" rows={3} className="input py-2" value={str('tax_status_statement')} onChange={(e) => set('tax_status_statement', e.target.value)} />
          </Field>
          <p className="text-xs text-navy/60">
            Check this wording against Opa's Learning Academy's IRS determination before sending receipts.
          </p>
        </Section>

        {error && <p role="alert" className="text-sm text-rose">{error}</p>}
        <div className="flex items-center gap-3">
          <button className="btn btn-primary">Save settings</button>
          {saved && <span className="text-sm text-emerald-800">Saved ✓</span>}
        </div>
      </form>

      <SponsorLevels />
    </div>
  )
}

function SponsorLevels() {
  const [levels, setLevels] = useState<SponsorLevel[]>([])
  const [editing, setEditing] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('sponsor_levels').select('*').order('sort_order')
    setLevels((data as SponsorLevel[]) ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function add() {
    const { data } = await supabase
      .from('sponsor_levels')
      .insert({ name: `New level ${levels.length + 1}`, sort_order: (levels.at(-1)?.sort_order ?? 0) + 1 })
      .select('id')
      .single()
    await load()
    if (data) setEditing(data.id)
  }

  return (
    <Section title="Sponsor levels">
      <p className="text-sm text-navy/60">
        Changing a level doesn't change sponsors who already chose it. Benefits fill in a sponsor's deliverables checklist when the level is first picked.
      </p>
      <ul className="space-y-2">
        {levels.map((l) =>
          editing === l.id ? (
            <LevelForm key={l.id} level={l} onDone={() => { setEditing(null); load() }} />
          ) : (
            <li key={l.id} className="flex items-center gap-3 rounded-lg border border-gold/30 bg-cream/50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-navy">{l.name} · {money(l.price)}</div>
                <div className="text-xs text-navy/60">
                  {l.tickets_included} tickets{l.reserved_table ? ` · ${l.table_note ?? 'reserved table'}` : ''} · {l.benefits.length} benefits
                </div>
              </div>
              <button className="btn btn-ghost text-sm" onClick={() => setEditing(l.id)}>Edit</button>
            </li>
          ),
        )}
      </ul>
      <button className="btn btn-ghost text-sm" onClick={add}>+ Add level</button>
    </Section>
  )
}

function LevelForm({ level, onDone }: { level: SponsorLevel; onDone: () => void }) {
  const [f, setF] = useState({
    name: level.name,
    price: String(level.price),
    tickets: String(level.tickets_included),
    reserved: level.reserved_table,
    note: level.table_note ?? '',
    benefits: level.benefits.join('\n'),
  })
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase
      .from('sponsor_levels')
      .update({
        name: f.name.trim(),
        price: parseMoney(f.price) ?? 0,
        tickets_included: Number(f.tickets) || 0,
        reserved_table: f.reserved,
        table_note: f.note.trim() || null,
        benefits: f.benefits.split('\n').map((b) => b.trim()).filter(Boolean),
      })
      .eq('id', level.id)
    if (error) return setError(error.code === '23505' ? 'Another level already has that name.' : error.message)
    onDone()
  }

  async function remove() {
    if (!confirm(`Delete the ${level.name} level? Sponsors using it will show no level.`)) return
    await supabase.from('sponsor_levels').delete().eq('id', level.id)
    onDone()
  }

  return (
    <li className="rounded-lg border border-navy/30 bg-white p-3">
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Name" id={`l-name-${level.id}`}><input id={`l-name-${level.id}`} className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Price" id={`l-price-${level.id}`}><input id={`l-price-${level.id}`} className="input" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
          <Field label="Tickets" id={`l-tix-${level.id}`}><input id={`l-tix-${level.id}`} type="number" min={0} className="input" value={f.tickets} onChange={(e) => setF({ ...f, tickets: e.target.value })} /></Field>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm text-navy">
          <input type="checkbox" className="h-5 w-5 accent-burgundy" checked={f.reserved} onChange={(e) => setF({ ...f, reserved: e.target.checked })} />
          Includes a reserved table
        </label>
        {f.reserved && (
          <Field label="Table note" id={`l-note-${level.id}`}><input id={`l-note-${level.id}`} className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        )}
        <Field label="Benefits (one per line)" id={`l-ben-${level.id}`}>
          <textarea id={`l-ben-${level.id}`} rows={5} className="input py-2" value={f.benefits} onChange={(e) => setF({ ...f, benefits: e.target.value })} />
        </Field>
        {error && <p role="alert" className="text-sm text-rose">{error}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1">Save level</button>
          <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
          <button type="button" className="btn btn-ghost text-rose" onClick={remove}>Delete</button>
        </div>
      </form>
    </li>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card space-y-3">
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}
