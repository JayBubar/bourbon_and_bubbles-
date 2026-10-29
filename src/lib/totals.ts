import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/** Event-wide numbers shared by the Dashboard and Budget pages. */
export interface Totals {
  ticketsSold: number
  ticketRevenuePaid: number
  sponsorSeats: number
  sponsorCommitted: number
  sponsorPaid: number
  sponsorsYes: number
  auctionDonorsYes: number
  auctionItems: number
  auctionItemsReceived: number
  auctionValue: number
}

export function useTotals() {
  const [totals, setTotals] = useState<Totals | null>(null)

  const reload = useCallback(async () => {
    const [sales, sponsors, auctionCos, items] = await Promise.all([
      supabase.from('ticket_sales').select('quantity, amount_paid'),
      supabase.from('companies').select('tickets_included, amount_committed, amount_paid').eq('kind', 'sponsor').eq('status', 'yes'),
      supabase.from('companies').select('id', { count: 'exact', head: true }).eq('kind', 'auction').eq('status', 'yes'),
      supabase.from('auction_items').select('estimated_value, received'),
    ])
    const s = sales.data ?? []
    const sp = sponsors.data ?? []
    const it = items.data ?? []
    setTotals({
      ticketsSold: s.reduce((n, r) => n + r.quantity, 0),
      ticketRevenuePaid: s.reduce((n, r) => n + Number(r.amount_paid), 0),
      sponsorSeats: sp.reduce((n, r) => n + Number(r.tickets_included ?? 0), 0),
      sponsorCommitted: sp.reduce((n, r) => n + Number(r.amount_committed ?? 0), 0),
      sponsorPaid: sp.reduce((n, r) => n + Number(r.amount_paid ?? 0), 0),
      sponsorsYes: sp.length,
      auctionDonorsYes: auctionCos.count ?? 0,
      auctionItems: it.length,
      auctionItemsReceived: it.filter((r) => r.received).length,
      auctionValue: it.reduce((n, r) => n + Number(r.estimated_value ?? 0), 0),
    })
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { totals, reload }
}

/** "Raised" = ticket money collected + sponsorship dollars committed (auction value is shown separately). */
export const raised = (t: Totals) => t.ticketRevenuePaid + t.sponsorCommitted
