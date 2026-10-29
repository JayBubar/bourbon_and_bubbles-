import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { money, parseMoney } from '../../lib/format'
import Sheet from '../../components/Sheet'
import Comments from '../../components/Comments'
import type { Company } from './types'

interface AuctionItem {
  id: string
  description: string
  estimated_value: number | null
  received: boolean
  bid_sheet_number: string | null
  donor_display_name: string | null
}

export default function AuctionItems({ company }: { company: Company }) {
  const [items, setItems] = useState<AuctionItem[]>([])
  const [editing, setEditing] = useState<AuctionItem | 'new' | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('auction_items').select('*').eq('company_id', company.id).order('created_at')
    setItems((data as AuctionItem[]) ?? [])
  }, [company.id])

  useEffect(() => {
    load()
  }, [load])

  async function toggleReceived(item: AuctionItem) {
    setItems((all) => all.map((i) => (i.id === item.id ? { ...i, received: !i.received } : i)))
    await supabase.from('auction_items').update({ received: !item.received }).eq('id', item.id)
  }

  const total = items.reduce((s, i) => s + Number(i.estimated_value ?? 0), 0)

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-lg">Auction items</h2>
        <button className="btn btn-ghost text-sm" onClick={() => setEditing('new')}>+ Item</button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-navy/60">
          {company.status === 'yes' ? 'They said yes. Record what they are donating.' : 'Once they say yes, record donated items here.'}
        </p>
      ) : (
        <>
          <ul className="card divide-y divide-gold/20 overflow-hidden p-0">
            {items.map((i) => (
              <li key={i.id} className="flex items-stretch">
                <button onClick={() => setEditing(i)} className="min-h-14 min-w-0 flex-1 px-4 py-2 text-left">
                  <div className="font-medium text-navy">{i.description}</div>
                  <div className="text-xs text-navy/60">
                    {[money(i.estimated_value), i.bid_sheet_number && `Bid sheet #${i.bid_sheet_number}`, i.donor_display_name && `Shown as "${i.donor_display_name}"`]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </button>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 px-4 text-xs text-navy/70">
                  <input type="checkbox" className="h-5 w-5 accent-burgundy" checked={i.received} onChange={() => toggleReceived(i)} />
                  Received
                </label>
              </li>
            ))}
          </ul>
          <p className="text-right text-sm text-navy/70">Estimated value: <strong>{money(total)}</strong></p>
        </>
      )}

      <ItemSheet
        open={editing !== null}
        item={editing === 'new' ? null : editing}
        companyId={company.id}
        defaultDonor={company.name}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </section>
  )
}

function ItemSheet({
  open,
  item,
  companyId,
  defaultDonor,
  onClose,
  onSaved,
}: {
  open: boolean
  item: AuctionItem | null
  companyId: string
  defaultDonor: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({ description: '', value: '', received: false, bid: '', donor: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm({
      description: item?.description ?? '',
      value: item?.estimated_value?.toString() ?? '',
      received: item?.received ?? false,
      bid: item?.bid_sheet_number ?? '',
      donor: item?.donor_display_name ?? defaultDonor,
    })
  }, [open, item, defaultDonor])

  async function save(e: FormEvent) {
    e.preventDefault()
    const row = {
      company_id: companyId,
      description: form.description.trim(),
      estimated_value: parseMoney(form.value),
      received: form.received,
      bid_sheet_number: form.bid.trim() || null,
      donor_display_name: form.donor.trim() || null,
    }
    const { error } = item
      ? await supabase.from('auction_items').update(row).eq('id', item.id)
      : await supabase.from('auction_items').insert(row)
    if (error) return setError(error.message)
    onSaved()
    onClose()
  }

  async function remove() {
    if (!item || !confirm(`Delete "${item.description}"?`)) return
    await supabase.from('auction_items').delete().eq('id', item.id)
    onSaved()
    onClose()
  }

  return (
    <Sheet open={open} title={item ? 'Edit auction item' : 'New auction item'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label" htmlFor="ai-desc">What is it?</label>
          <input id="ai-desc" className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} autoFocus={!item} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ai-value">Estimated value</label>
            <input id="ai-value" className="input" inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="ai-bid">Bid sheet #</label>
            <input id="ai-bid" className="input" value={form.bid} onChange={(e) => setForm({ ...form, bid: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ai-donor">Donor name as displayed</label>
          <input id="ai-donor" className="input" value={form.donor} onChange={(e) => setForm({ ...form, donor: e.target.value })} />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm text-navy">
          <input type="checkbox" className="h-5 w-5 accent-burgundy" checked={form.received} onChange={(e) => setForm({ ...form, received: e.target.checked })} />
          Item received
        </label>
        {error && <p role="alert" className="text-sm text-rose">{error}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1">Save</button>
          {item && <button type="button" className="btn btn-ghost text-rose" onClick={remove}>Delete</button>}
        </div>
      </form>
      {item && (
        <div className="mt-6 border-t border-gold/30 pt-4">
          <Comments entityType="auction_item" entityId={item.id} />
        </div>
      )}
    </Sheet>
  )
}
