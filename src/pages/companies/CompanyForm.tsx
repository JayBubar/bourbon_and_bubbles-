import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useUsers } from '../../lib/useUsers'
import { money, parseMoney } from '../../lib/format'
import Sheet from '../../components/Sheet'
import { KINDS, STATUSES, STATUS_LABEL, type Company, type CompanyStatus, type EventTable, type Kind, type SponsorLevel } from './types'

const TEXT_FIELDS = [
  'name', 'category', 'contact_name', 'contact_title', 'email', 'phone', 'website', 'address',
  'product_provided', 'tasting_host',
] as const

type FormState = Record<(typeof TEXT_FIELDS)[number], string> & {
  owner_id: string
  status: CompanyStatus
  last_contact_date: string
  sponsor_level_id: string
  amount_committed: string
  amount_paid: string
  invoice_sent: boolean
  tickets_included: string
  table_id: string
  tax_deductible: string
}

function toForm(c: Company | null): FormState {
  const s = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))
  return {
    name: s(c?.name), category: s(c?.category), contact_name: s(c?.contact_name), contact_title: s(c?.contact_title),
    email: s(c?.email), phone: s(c?.phone), website: s(c?.website), address: s(c?.address),
    product_provided: s(c?.product_provided), tasting_host: s(c?.tasting_host),
    owner_id: s(c?.owner_id), status: c?.status ?? 'not_contacted', last_contact_date: s(c?.last_contact_date),
    sponsor_level_id: s(c?.sponsor_level_id), amount_committed: s(c?.amount_committed), amount_paid: s(c?.amount_paid),
    invoice_sent: c?.invoice_sent ?? false, tickets_included: s(c?.tickets_included), table_id: s(c?.table_id),
    tax_deductible: s(c?.tax_deductible),
  }
}

export default function CompanyForm({
  open,
  kind,
  company,
  onClose,
  onSaved,
}: {
  open: boolean
  kind: Kind
  company: Company | null
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const users = useUsers()
  const [form, setForm] = useState<FormState>(toForm(null))
  const [levels, setLevels] = useState<SponsorLevel[]>([])
  const [tables, setTables] = useState<EventTable[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(toForm(company))
    setError(null)
    if (kind === 'sponsor') {
      supabase.from('sponsor_levels').select('*').order('sort_order').then(({ data }) => setLevels((data as SponsorLevel[]) ?? []))
      supabase.from('event_tables').select('id, label, type, seats').neq('type', 'cocktail').order('sort_order').then(({ data }) => setTables((data as EventTable[]) ?? []))
    }
  }, [open, company, kind])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  // picking a level fills in its price and tickets (still editable)
  function pickLevel(id: string) {
    const lvl = levels.find((l) => l.id === id)
    setForm((f) => ({
      ...f,
      sponsor_level_id: id,
      amount_committed: lvl && (!f.amount_committed || !company) ? String(lvl.price) : f.amount_committed,
      tickets_included: lvl ? String(lvl.tickets_included) : f.tickets_included,
    }))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const text = Object.fromEntries(TEXT_FIELDS.map((k) => [k, form[k].trim() || null]))
    const row: Record<string, unknown> = {
      ...text,
      kind,
      owner_id: form.owner_id || null,
      status: form.status,
      last_contact_date: form.last_contact_date || null,
    }
    if (kind === 'sponsor') {
      Object.assign(row, {
        sponsor_level_id: form.sponsor_level_id || null,
        amount_committed: parseMoney(form.amount_committed),
        amount_paid: parseMoney(form.amount_paid),
        invoice_sent: form.invoice_sent,
        tickets_included: form.tickets_included === '' ? null : Number(form.tickets_included),
        table_id: form.table_id || null,
        tax_deductible: parseMoney(form.tax_deductible),
      })
    }
    const res = company
      ? await supabase.from('companies').update(row).eq('id', company.id).select('id').single()
      : await supabase.from('companies').insert(row).select('id').single()
    setSaving(false)
    if (res.error) {
      return setError(res.error.code === '23505' ? `A ${KINDS.find((k) => k.id === kind)?.singular} with that name already exists.` : res.error.message)
    }
    onSaved(res.data.id)
    onClose()
  }

  const kindLabel = KINDS.find((k) => k.id === kind)!.singular

  return (
    <Sheet open={open} title={company ? `Edit ${company.name}` : `New ${kindLabel}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Company name" id="c-name">
          <input id="c-name" className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus={!company} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status" id="c-status">
            <select id="c-status" className="input" value={form.status} onChange={(e) => set('status', e.target.value as CompanyStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Owner" id="c-owner">
            <select id="c-owner" className="input" value={form.owner_id} onChange={(e) => set('owner_id', e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>
        </div>

        {kind === 'sponsor' && (
          <fieldset className="space-y-3 rounded-xl border border-gold/40 bg-white p-3">
            <legend className="px-1 text-sm font-semibold text-burgundy">Sponsorship</legend>
            <Field label="Level" id="c-level">
              <select id="c-level" className="input" value={form.sponsor_level_id} onChange={(e) => pickLevel(e.target.value)}>
                <option value="">Not chosen yet</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} · {money(l.price)}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount committed" id="c-committed">
                <input id="c-committed" className="input" inputMode="decimal" value={form.amount_committed} onChange={(e) => set('amount_committed', e.target.value)} />
              </Field>
              <Field label="Amount paid" id="c-paid">
                <input id="c-paid" className="input" inputMode="decimal" value={form.amount_paid} onChange={(e) => set('amount_paid', e.target.value)} />
              </Field>
              <Field label="Tickets included" id="c-tix">
                <input id="c-tix" className="input" type="number" min={0} value={form.tickets_included} onChange={(e) => set('tickets_included', e.target.value)} />
              </Field>
              <Field label="Tax-deductible portion" id="c-tax">
                <input id="c-tax" className="input" inputMode="decimal" value={form.tax_deductible} onChange={(e) => set('tax_deductible', e.target.value)} />
              </Field>
            </div>
            <Field label="Reserved table" id="c-table">
              <select id="c-table" className="input" value={form.table_id} onChange={(e) => set('table_id', e.target.value)}>
                <option value="">None</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>{t.label} ({t.seats} seats)</option>
                ))}
              </select>
            </Field>
            <label className="flex min-h-11 items-center gap-3 text-sm text-navy">
              <input type="checkbox" className="h-5 w-5 accent-burgundy" checked={form.invoice_sent} onChange={(e) => set('invoice_sent', e.target.checked)} />
              Invoice sent
            </label>
          </fieldset>
        )}

        {kind === 'distributor' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Product provided" id="c-product">
              <input id="c-product" className="input" value={form.product_provided} onChange={(e) => set('product_provided', e.target.value)} />
            </Field>
            <Field label="Tasting host" id="c-host">
              <input id="c-host" className="input" value={form.tasting_host} onChange={(e) => set('tasting_host', e.target.value)} />
            </Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact name" id="c-contact">
            <input id="c-contact" className="input" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
          </Field>
          <Field label="Title" id="c-title">
            <input id="c-title" className="input" value={form.contact_title} onChange={(e) => set('contact_title', e.target.value)} />
          </Field>
          <Field label="Email" id="c-email">
            <input id="c-email" className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Phone" id="c-phone">
            <input id="c-phone" className="input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Website" id="c-web">
            <input id="c-web" className="input" value={form.website} onChange={(e) => set('website', e.target.value)} />
          </Field>
          <Field label="Category / industry" id="c-cat">
            <input id="c-cat" className="input" value={form.category} onChange={(e) => set('category', e.target.value)} />
          </Field>
        </div>
        <Field label="Address" id="c-address">
          <input id="c-address" className="input" value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="Last contact" id="c-last">
          <input id="c-last" type="date" className="input" value={form.last_contact_date} onChange={(e) => set('last_contact_date', e.target.value)} />
        </Field>

        {error && <p role="alert" className="text-sm text-rose">{error}</p>}
        <button className="btn btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </form>
    </Sheet>
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
