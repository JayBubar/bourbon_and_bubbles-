import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { todayISO } from '../../lib/dates'
import Sheet from '../../components/Sheet'
import { STATUSES, STATUS_LABEL, STATUS_STYLE, type Company, type CompanyStatus } from './types'

/** One-step "I talked to them": status change + note + last-contact date. */
export default function LogCallSheet({
  open,
  company,
  onClose,
  onSaved,
}: {
  open: boolean
  company: Company
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState<CompanyStatus>(company.status)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    // first contact usually moves "Not contacted" to "Reached out"
    setStatus(company.status === 'not_contacted' ? 'reached_out' : company.status)
    setNote('')
    setDate(todayISO())
    setError(null)
  }, [open, company.status])

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const upd = await supabase.from('companies').update({ status, last_contact_date: date }).eq('id', company.id)
    if (upd.error) {
      setSaving(false)
      return setError(upd.error.message)
    }
    if (note.trim()) {
      const statusNote = status !== company.status ? `[${STATUS_LABEL[status]}] ` : ''
      await supabase.from('comments').insert({ entity_type: 'company', entity_id: company.id, body: statusNote + note.trim() })
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Sheet open={open} title={`Log contact · ${company.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <span className="label">Where things stand</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STATUSES.map((s) => (
              <button
                type="button"
                key={s}
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                className={`min-h-12 rounded-lg border-2 text-sm font-medium transition ${
                  status === s ? `border-navy ${STATUS_STYLE[s]}` : 'border-transparent bg-white text-navy/70'
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="lc-note">What happened?</label>
          <textarea
            id="lc-note"
            rows={3}
            className="input py-2"
            placeholder="Left a voicemail, sent the packet, they'll decide next week…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="lc-date">Date</label>
          <input id="lc-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-rose">{error}</p>}
        <button className="btn btn-accent w-full" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </form>
    </Sheet>
  )
}
