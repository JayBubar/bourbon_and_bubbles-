import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useUsers } from '../../lib/useUsers'
import { todayISO } from '../../lib/dates'
import { money, parseMoney } from '../../lib/format'
import Sheet from '../../components/Sheet'
import Comments from '../../components/Comments'
import type { EventTable } from '../companies/types'
import { METHOD_LABEL, type PaymentMethod, type TicketSale } from './types'

export default function TicketForm({
  open,
  sale,
  price,
  onClose,
  onSaved,
}: {
  open: boolean
  sale: TicketSale | null
  price: number
  onClose: () => void
  onSaved: () => void
}) {
  const { me } = useAuth()
  const users = useUsers()
  const [tables, setTables] = useState<EventTable[]>([])
  const [f, setF] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))
    setF({
      buyer_name: s(sale?.buyer_name),
      email: s(sale?.email),
      phone: s(sale?.phone),
      quantity: s(sale?.quantity ?? 1),
      unit_price: s(sale?.unit_price ?? price),
      amount_paid: s(sale?.amount_paid ?? ''),
      payment_method: s(sale?.payment_method),
      sale_date: s(sale?.sale_date ?? todayISO()),
      sold_by_id: s(sale ? sale.sold_by_id : me?.id),
      guest_names: s(sale?.guest_names),
      dietary_notes: s(sale?.dietary_notes),
      table_id: s(sale?.table_id),
      tax_deductible: s(sale?.tax_deductible),
      notes: s(sale?.notes),
    })
    supabase.from('event_tables').select('id, label, type, seats').neq('type', 'cocktail').order('sort_order').then(({ data }) => setTables((data as EventTable[]) ?? []))
  }, [open, sale, price, me])

  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }))
  const qty = Math.max(1, Number(f.quantity) || 1)
  const due = qty * (parseMoney(f.unit_price ?? '') ?? 0)

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const t = (k: string) => (f[k] ?? '').trim() || null
    const row = {
      buyer_name: f.buyer_name.trim(),
      email: t('email'),
      phone: t('phone'),
      quantity: qty,
      unit_price: parseMoney(f.unit_price) ?? price,
      amount_paid: parseMoney(f.amount_paid) ?? 0,
      payment_method: t('payment_method'),
      sale_date: f.sale_date || todayISO(),
      sold_by_id: t('sold_by_id'),
      guest_names: t('guest_names'),
      dietary_notes: t('dietary_notes'),
      table_id: t('table_id'),
      tax_deductible: parseMoney(f.tax_deductible ?? ''),
      notes: t('notes'),
    }
    const { error } = sale
      ? await supabase.from('ticket_sales').update(row).eq('id', sale.id)
      : await supabase.from('ticket_sales').insert(row)
    setSaving(false)
    if (error) return setError(error.message)
    onSaved()
    onClose()
  }

  async function remove() {
    if (!sale || !confirm(`Delete ${sale.buyer_name}'s ${sale.quantity} ticket(s)?`)) return
    await supabase.from('ticket_sales').delete().eq('id', sale.id)
    onSaved()
    onClose()
  }

  return (
    <Sheet open={open} title={sale ? sale.buyer_name : 'New ticket sale'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Buyer name" id="t-buyer"><input id="t-buyer" className="input" required value={f.buyer_name ?? ''} onChange={(e) => set('buyer_name', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" id="t-email"><input id="t-email" type="email" className="input" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Phone" id="t-phone"><input id="t-phone" type="tel" className="input" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Quantity" id="t-qty"><input id="t-qty" type="number" min={1} className="input" value={f.quantity ?? ''} onChange={(e) => set('quantity', e.target.value)} /></Field>
          <Field label="Price each" id="t-price"><input id="t-price" className="input" inputMode="decimal" value={f.unit_price ?? ''} onChange={(e) => set('unit_price', e.target.value)} /></Field>
          <Field label="Amount paid" id="t-paid"><input id="t-paid" className="input" inputMode="decimal" value={f.amount_paid ?? ''} onChange={(e) => set('amount_paid', e.target.value)} /></Field>
        </div>
        <div className="flex items-center justify-between text-sm text-navy/70">
          <span>Total due {money(due)}</span>
          <button type="button" className="text-burgundy underline" onClick={() => set('amount_paid', String(due))}>Mark paid in full</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment method" id="t-method">
            <select id="t-method" className="input" value={f.payment_method ?? ''} onChange={(e) => set('payment_method', e.target.value)}>
              <option value="">—</option>
              {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </Field>
          <Field label="Date" id="t-date"><input id="t-date" type="date" className="input" value={f.sale_date ?? ''} onChange={(e) => set('sale_date', e.target.value)} /></Field>
          <Field label="Sold by" id="t-seller">
            <select id="t-seller" className="input" value={f.sold_by_id ?? ''} onChange={(e) => set('sold_by_id', e.target.value)}>
              <option value="">—</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Table" id="t-table">
            <select id="t-table" className="input" value={f.table_id ?? ''} onChange={(e) => set('table_id', e.target.value)}>
              <option value="">Not assigned</option>
              {tables.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Guest names" id="t-guests">
          <textarea id="t-guests" rows={2} className="input py-2" placeholder="One per line" value={f.guest_names ?? ''} onChange={(e) => set('guest_names', e.target.value)} />
        </Field>
        <Field label="Dietary notes" id="t-diet"><input id="t-diet" className="input" value={f.dietary_notes ?? ''} onChange={(e) => set('dietary_notes', e.target.value)} /></Field>
        <Field label="Tax-deductible portion (optional)" id="t-tax"><input id="t-tax" className="input" inputMode="decimal" value={f.tax_deductible ?? ''} onChange={(e) => set('tax_deductible', e.target.value)} /></Field>

        {error && <p role="alert" className="text-sm text-rose">{error}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          {sale && <button type="button" className="btn btn-ghost text-rose" onClick={remove}>Delete</button>}
        </div>
      </form>
      {sale && (
        <div className="mt-6 border-t border-gold/30 pt-4">
          <Comments entityType="ticket" entityId={sale.id} />
        </div>
      )}
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
