export type PaymentMethod = 'check' | 'card' | 'cash' | 'other'

export interface TicketSale {
  id: string
  buyer_name: string
  email: string | null
  phone: string | null
  quantity: number
  unit_price: number
  amount_paid: number
  payment_method: PaymentMethod | null
  sale_date: string
  sold_by_id: string | null
  guest_names: string | null
  dietary_notes: string | null
  table_id: string | null
  tax_deductible: number | null
  notes: string | null
  created_at: string
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  check: 'Check',
  card: 'Card (paid elsewhere)',
  cash: 'Cash',
  other: 'Other',
}

export type PayState = 'paid' | 'partial' | 'unpaid'

export function payState(t: Pick<TicketSale, 'quantity' | 'unit_price' | 'amount_paid'>): PayState {
  const due = Number(t.quantity) * Number(t.unit_price)
  const paid = Number(t.amount_paid)
  if (paid <= 0) return due > 0 ? 'unpaid' : 'paid'
  return paid >= due ? 'paid' : 'partial'
}

export const PAY_STYLE: Record<PayState, string> = {
  paid: 'bg-emerald-100 text-emerald-900',
  partial: 'bg-gold/30 text-navy',
  unpaid: 'bg-rose/15 text-burgundy',
}

export const PAY_LABEL: Record<PayState, string> = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' }
