import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useSettings } from '../../lib/settings'
import { useUsers } from '../../lib/useUsers'
import { formatDate, todayISO } from '../../lib/dates'
import { money } from '../../lib/format'
import type { Company, SponsorLevel } from './types'

interface Item {
  id: string
  description: string
  received: boolean
}

/** Printable donation acknowledgment for an auction donor or sponsor. */
export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const { me, isAdmin } = useAuth()
  const users = useUsers()
  const { settings } = useSettings()
  const [company, setCompany] = useState<Company | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [level, setLevel] = useState<SponsorLevel | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('companies').select('*').eq('id', id!).single()
    const c = data as Company
    setCompany(c)
    if (c?.kind === 'auction') {
      const res = await supabase.from('auction_items').select('id, description, received').eq('company_id', c.id).order('created_at')
      setItems((res.data as Item[]) ?? [])
    }
    if (c?.sponsor_level_id) {
      const res = await supabase.from('sponsor_levels').select('*').eq('id', c.sponsor_level_id).single()
      setLevel(res.data as SponsorLevel)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function markSent(sent: boolean) {
    if (!company) return
    setSaving(true)
    await supabase
      .from('companies')
      .update(sent ? { receipt_sent_on: todayISO(), receipt_sent_by: me?.id } : { receipt_sent_on: null, receipt_sent_by: null })
      .eq('id', company.id)
    await load()
    setSaving(false)
  }

  if (!company || !settings) return <p className="p-6 text-navy/50">Loading…</p>

  const isSponsor = company.kind === 'sponsor'
  const paid = Number(company.amount_paid ?? 0)
  const deductible = company.tax_deductible === null ? null : Number(company.tax_deductible)
  const benefitValue = deductible === null ? null : Math.max(0, paid - deductible)
  const tickets = company.tickets_included ?? 0
  const date = company.receipt_sent_on ?? todayISO()
  const sentBy = users.find((u) => u.id === company.receipt_sent_by)

  // things to fix before issuing (shown on screen only)
  const warnings: string[] = []
  if (company.kind === 'distributor') warnings.push('Receipts are set up for auction donors and sponsors only.')
  if (company.kind === 'auction' && items.length === 0) warnings.push('No auction items are recorded for this donor yet.')
  if (company.kind === 'auction' && items.some((i) => !i.received)) warnings.push('Some items are not marked received yet.')
  if (isSponsor && paid <= 0) warnings.push('No payment is recorded. Enter the amount paid on the sponsor before issuing a receipt.')
  if (isSponsor && deductible === null)
    warnings.push(`The tax-deductible portion is blank. Enter it on the sponsor (amount paid minus the fair market value of tickets and benefits received).`)
  if (!settings.org_address) warnings.push(`${settings.org_name}'s mailing address is blank${isAdmin ? ' (add it in Settings)' : ' (an admin can add it in Settings)'}.`)
  if (!settings.receipt_signer_title) warnings.push(`The signer's title is blank${isAdmin ? ' (add it in Settings)' : ''}.`)

  const greeting = company.contact_name ? company.contact_name.split(' ')[0] : company.name

  return (
    <div className="min-h-dvh bg-parchment py-6 print:bg-white print:py-0">
      {/* toolbar, hidden when printing */}
      <div className="no-print mx-auto mb-4 max-w-[8.5in] space-y-3 px-4">
        <Link to={`/outreach/${company.id}`} className="inline-flex min-h-11 items-center text-sm text-burgundy">‹ Back to {company.name}</Link>
        {warnings.length > 0 && (
          <ul role="alert" className="list-disc space-y-1 rounded-lg border border-rose/40 bg-rose/10 py-3 pr-3 pl-8 text-sm text-burgundy">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
          {company.receipt_sent_on ? (
            <>
              <span className="text-sm text-emerald-800">
                ✓ Sent {formatDate(company.receipt_sent_on, { year: 'numeric' })}{sentBy ? ` by ${sentBy.name}` : ''}
              </span>
              <button className="btn text-sm text-navy/60" disabled={saving} onClick={() => markSent(false)}>Undo</button>
            </>
          ) : (
            <button className="btn btn-accent" disabled={saving} onClick={() => markSent(true)}>Mark as sent</button>
          )}
        </div>
      </div>

      {/* the letter */}
      <article className="mx-auto max-w-[8.5in] bg-white px-8 py-10 font-serif text-[15px] leading-relaxed text-ink shadow-md sm:px-14 print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <header className="flex items-center gap-4 border-b-2 border-gold pb-4">
          <img src="/logo-badge.png" alt="" className="h-20 w-20" />
          <div className="font-sans">
            <div className="font-serif text-xl font-bold text-navy">{settings.org_name}</div>
            {settings.org_address && <div className="text-sm whitespace-pre-line text-navy/70">{settings.org_address}</div>}
            <div className="text-sm text-navy/70">EIN {settings.org_ein}</div>
          </div>
        </header>

        <p className="mt-6">{formatDate(date, { month: 'long', year: 'numeric' })}</p>

        <p className="mt-4">
          {company.contact_name && <>{company.contact_name}<br /></>}
          {company.name}
          {company.address && <><br /><span className="whitespace-pre-line">{company.address}</span></>}
        </p>

        <p className="mt-6">Dear {greeting},</p>

        {isSponsor ? (
          <>
            <p className="mt-4">
              Thank you for your {level ? <strong>{level.name}</strong> : null} sponsorship of <em>{settings.event_name}</em>, {settings.org_name}'s
              annual fundraiser, held {formatDate(settings.event_starts_at.slice(0, 10), { month: 'long', year: 'numeric' })}. We gratefully acknowledge
              your contribution of <strong>{money(paid, { cents: true })}</strong>.
            </p>
            {benefitValue !== null && benefitValue > 0 ? (
              <p className="mt-4">
                In exchange for your contribution, you received
                {tickets > 0 ? ` ${tickets} event ticket${tickets === 1 ? '' : 's'} and associated sponsor benefits` : ' sponsor benefits'} with an
                estimated fair market value of <strong>{money(benefitValue, { cents: true })}</strong>. The tax-deductible portion of your contribution
                is <strong>{money(deductible, { cents: true })}</strong>.
              </p>
            ) : benefitValue === 0 ? (
              <p className="mt-4">No goods or services were provided in exchange for this contribution.</p>
            ) : (
              <p className="no-print mt-4 text-rose">[Deductible amount needed. See the note above.]</p>
            )}
          </>
        ) : (
          <>
            <p className="mt-4">
              Thank you for your generous in-kind donation to <em>{settings.event_name}</em>, {settings.org_name}'s annual fundraiser, held{' '}
              {formatDate(settings.event_starts_at.slice(0, 10), { month: 'long', year: 'numeric' })}. We gratefully acknowledge receipt of the following
              for our silent auction:
            </p>
            <ul className="mt-3 list-disc pl-8">
              {items.map((i) => <li key={i.id}>{i.description}</li>)}
            </ul>
            <p className="mt-4">
              No goods or services were provided in exchange for this contribution. In keeping with IRS guidelines, we do not assign a value to
              donated property; the donor is responsible for determining its value.
            </p>
          </>
        )}

        <p className="mt-4">
          Your support helps {settings.org_name} continue its work in our community. We are deeply grateful for your partnership.
        </p>

        <p className="mt-4 text-sm text-navy/80">{settings.tax_status_statement}</p>

        <div className="mt-10">
          <p>With gratitude,</p>
          <div className="mt-12 w-64 border-t border-ink/60" />
          <p className="mt-1">
            {settings.receipt_signer_name}
            {settings.receipt_signer_title && <><br />{settings.receipt_signer_title}</>}
            <br />
            {settings.org_name}
          </p>
        </div>
      </article>
    </div>
  )
}
