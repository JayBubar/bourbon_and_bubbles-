export type Kind = 'auction' | 'sponsor' | 'distributor'
export type CompanyStatus = 'not_contacted' | 'reached_out' | 'following_up' | 'yes' | 'no'

export interface Company {
  id: string
  kind: Kind
  name: string
  category: string | null
  contact_name: string | null
  contact_title: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  owner_id: string | null
  status: CompanyStatus
  last_contact_date: string | null
  notes: string | null
  sponsor_level_id: string | null
  amount_committed: number | null
  amount_paid: number | null
  invoice_sent: boolean
  tickets_included: number | null
  table_id: string | null
  tax_deductible: number | null
  product_provided: string | null
  tasting_host: string | null
  receipt_sent_on: string | null
  receipt_sent_by: string | null
  created_at: string
  updated_at: string
}

export interface SponsorLevel {
  id: string
  name: string
  price: number
  tickets_included: number
  reserved_table: boolean
  table_note: string | null
  benefits: string[]
  sort_order: number
}

export interface EventTable {
  id: string
  label: string
  type: 'round' | 'banquet' | 'cocktail' | 'other'
  seats: number
}

export const KINDS: { id: Kind; label: string; singular: string }[] = [
  { id: 'auction', label: 'Silent Auction', singular: 'auction target' },
  { id: 'sponsor', label: 'Sponsors', singular: 'sponsor' },
  { id: 'distributor', label: 'Distributors', singular: 'distributor / brand partner' },
]

export const STATUSES: CompanyStatus[] = ['not_contacted', 'reached_out', 'following_up', 'yes', 'no']

export const STATUS_LABEL: Record<CompanyStatus, string> = {
  not_contacted: 'Not contacted',
  reached_out: 'Reached out',
  following_up: 'Following up',
  yes: 'Yes',
  no: 'No',
}

export const STATUS_STYLE: Record<CompanyStatus, string> = {
  not_contacted: 'bg-navy/10 text-navy/70',
  reached_out: 'bg-sky-100 text-sky-900',
  following_up: 'bg-gold/30 text-navy',
  yes: 'bg-emerald-100 text-emerald-900',
  no: 'bg-rose/15 text-burgundy',
}

export function StatusPill({ status }: { status: CompanyStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}
