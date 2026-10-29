import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { money } from '../../lib/format'
import Sheet from '../../components/Sheet'
import { METHOD_LABEL, type PaymentMethod } from './types'

/** The three-field phone form: name, how many, paid? */
export default function QuickAdd({
  open,
  price,
  onClose,
  onSaved,
}: {
  open: boolean
  price: number
  onClose: () => void
  onSaved: () => void
}) {
  const { me } = useAuth()
  const [name, setName] = useState('')
  const [qty, setQty] = useState(1)
  const [paid, setPaid] = useState(true)
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setQty(1)
    setPaid(true)
    setMethod('')
    setError(null)
  }, [open])

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('ticket_sales').insert({
      buyer_name: name.trim(),
      quantity: qty,
      unit_price: price,
      amount_paid: paid ? qty * price : 0,
      payment_method: paid ? method || null : null,
      sold_by_id: me?.id,
    })
    setSaving(false)
    if (error) return setError(error.message)
    onSaved()
    onClose()
  }

  return (
    <Sheet open={open} title="Quick add tickets" onClose={onClose}>
      <form onSubmit={save} className="space-y-5">
        <div>
          <label className="label" htmlFor="qa-name">Buyer name</label>
          <input id="qa-name" className="input" required autoFocus autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <span className="label">How many tickets?</span>
          <div className="flex items-center gap-3">
            <button type="button" className="btn btn-ghost h-12 w-12 text-2xl" aria-label="One fewer" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <input
              className="input h-12 w-20 text-center text-xl font-semibold"
              type="number"
              min={1}
              inputMode="numeric"
              aria-label="Quantity"
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            />
            <button type="button" className="btn btn-ghost h-12 w-12 text-2xl" aria-label="One more" onClick={() => setQty((q) => q + 1)}>+</button>
            <span className="ml-auto text-right text-sm text-navy/70">{money(qty * price)}</span>
          </div>
        </div>

        <div>
          <span className="label">Paid?</span>
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((v) => (
              <button
                type="button"
                key={String(v)}
                aria-pressed={paid === v}
                onClick={() => setPaid(v)}
                className={`min-h-12 rounded-lg border-2 font-medium ${
                  paid === v ? (v ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-burgundy bg-rose/10 text-burgundy') : 'border-navy/15 bg-white text-navy/60'
                }`}
              >
                {v ? 'Yes, paid' : 'Not yet'}
              </button>
            ))}
          </div>
        </div>

        {paid && (
          <div>
            <label className="label" htmlFor="qa-method">How? (optional)</label>
            <select id="qa-method" className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}>
              <option value="">—</option>
              {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-rose">{error}</p>}
        <button className="btn btn-accent w-full text-base" disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : `Add ${qty} ticket${qty === 1 ? '' : 's'}`}
        </button>
        <p className="text-center text-xs text-navy/50">Recorded as sold by you today. Open the sale afterward to add email, guests or table.</p>
      </form>
    </Sheet>
  )
}
