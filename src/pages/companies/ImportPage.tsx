import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, type AllowedUser } from '../../lib/supabase'
import { useUsers } from '../../lib/useUsers'
import {
  IMPORT_FIELDS, TEMPLATE_CSV, companyKey, detectHeader, mapRows, parseCSV,
  type ImportField, type MappedRow,
} from '../../lib/csv'
import { KINDS, STATUS_LABEL, StatusPill, type Kind } from './types'

type RowState = MappedRow & {
  ownerId: string | null
  ownerUnmatched: boolean
  problem: string | null // reason it's skipped by default
  blocking: boolean // can't be imported at all
  include: boolean
}

function matchOwner(text: string, users: AllowedUser[]): AllowedUser | null {
  const t = text.trim().toLowerCase()
  if (!t) return null
  return (
    users.find((u) => u.email === t) ??
    users.find((u) => u.name.toLowerCase() === t) ??
    users.find((u) => u.name.toLowerCase().startsWith(t)) ??
    users.find((u) => u.name.split(' ')[0].toLowerCase() === t.split(' ')[0]) ??
    null
  )
}

export default function ImportPage() {
  const users = useUsers()
  const [params] = useSearchParams()
  const [kind, setKind] = useState<Kind>((params.get('kind') as Kind) || 'auction')
  const [defaultOwner, setDefaultOwner] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<string[][]>([])
  const [headerIndex, setHeaderIndex] = useState(0)
  const [mapping, setMapping] = useState<(ImportField | '')[]>([])
  const [existing, setExisting] = useState<{ exact: Set<string>; loose: Map<string, string> }>({ exact: new Set(), loose: new Map() })
  const [overrides, setOverrides] = useState<Record<number, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ imported: number; failed: string[] } | null>(null)

  useEffect(() => {
    supabase
      .from('companies')
      .select('name')
      .eq('kind', kind)
      .then(({ data }) => {
        const names = (data ?? []).map((c) => c.name as string)
        setExisting({
          exact: new Set(names.map((n) => n.trim().toLowerCase())),
          loose: new Map(names.map((n) => [companyKey(n), n])),
        })
      })
  }, [kind, result])

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setOverrides({})
    const parsed = parseCSV(await file.text())
    const det = detectHeader(parsed)
    setRows(parsed)
    setHeaderIndex(det.headerIndex)
    setMapping(det.mapping)
  }

  const headers = rows[headerIndex] ?? []

  const preview: RowState[] = useMemo(() => {
    if (!mapping.includes('name')) return []
    const seenExact = new Map<string, number>()
    const seenLoose = new Map<string, number>()
    return mapRows(rows, headerIndex, mapping).map((r) => {
      const owner = matchOwner(r.owner, users)
      const exact = r.name.trim().toLowerCase()
      const loose = companyKey(r.name)
      let problem: string | null = null
      let blocking = false
      if (!r.name) {
        problem = 'No company name'
        blocking = true
      } else if (existing.exact.has(exact)) {
        problem = 'Already in this list'
        blocking = true
      } else if (seenExact.has(exact)) {
        problem = `Same name as line ${seenExact.get(exact)}`
        blocking = true
      } else if (existing.loose.has(loose)) {
        problem = `Looks like "${existing.loose.get(loose)}" (already in list)`
      } else if (seenLoose.has(loose)) {
        problem = `Looks like line ${seenLoose.get(loose)}`
      }
      if (r.name && !seenExact.has(exact)) seenExact.set(exact, r.line)
      if (r.name && !seenLoose.has(loose)) seenLoose.set(loose, r.line)
      const include = blocking ? false : overrides[r.line] ?? problem === null
      return {
        ...r,
        ownerId: owner?.id ?? (defaultOwner || null),
        ownerUnmatched: !!r.owner && !owner,
        problem,
        blocking,
        include,
      }
    })
  }, [rows, headerIndex, mapping, users, existing, overrides, defaultOwner])

  const toImport = preview.filter((r) => r.include)

  async function runImport() {
    setBusy(true)
    const payload = toImport.map((r) => ({
      kind,
      name: r.name,
      category: r.category,
      contact_name: r.contact_name,
      contact_title: r.contact_title,
      email: r.email,
      phone: r.phone,
      website: r.website,
      address: r.address,
      status: r.status ?? 'not_contacted',
      owner_id: r.ownerId,
      last_contact_date: r.last_contact_date,
      notes: r.notes,
    }))
    let imported = 0
    const failed: string[] = []
    for (let i = 0; i < payload.length; i += 100) {
      const chunk = payload.slice(i, i + 100)
      const { error } = await supabase.from('companies').insert(chunk)
      if (!error) {
        imported += chunk.length
        continue
      }
      // fall back to one at a time so one bad row doesn't sink the batch
      for (const row of chunk) {
        const res = await supabase.from('companies').insert(row)
        if (res.error) failed.push(`${row.name}: ${res.error.code === '23505' ? 'already exists' : res.error.message}`)
        else imported++
      }
    }
    setBusy(false)
    setResult({ imported, failed })
    setRows([])
    setFileName('')
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'bourbon-bubbles-companies-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const kindInfo = KINDS.find((k) => k.id === kind)!

  return (
    <div className="space-y-5">
      <Link to={`/outreach?kind=${kind}`} className="inline-flex min-h-11 items-center text-sm text-burgundy">‹ Outreach</Link>
      <div>
        <h1 className="text-2xl md:text-3xl">Import companies</h1>
        <p className="mt-1 text-sm text-navy/70">
          Upload a CSV (from Excel or Google Sheets: File → Download → CSV). Columns can be in any order with any names; you'll confirm the matching below.{' '}
          <button className="text-burgundy underline" onClick={downloadTemplate}>Download a template</button>
        </p>
      </div>

      {result && (
        <div role="status" className="card border-emerald-300 bg-emerald-50 text-sm">
          Imported <strong>{result.imported}</strong> {result.imported === 1 ? 'company' : 'companies'} into {kindInfo.label}.{' '}
          <Link className="text-burgundy underline" to={`/outreach?kind=${kind}`}>View the list</Link>
          {result.failed.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-rose">
              {result.failed.map((f) => <li key={f}>{f}</li>)}
            </ul>
          )}
        </div>
      )}

      <section className="card grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="imp-kind">Import into</label>
          <select id="imp-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="imp-owner">Default owner</label>
          <select id="imp-owner" className="input" value={defaultOwner} onChange={(e) => setDefaultOwner(e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="imp-file">CSV file</label>
          <input id="imp-file" type="file" accept=".csv,.tsv,.txt,text/csv" className="input py-2 text-sm" onChange={onFile} />
        </div>
      </section>

      {rows.length > 0 && (
        <>
          <section className="space-y-2">
            <h2 className="text-lg">1. Match columns</h2>
            <p className="text-sm text-navy/60">
              {fileName}: header found on row {headerIndex + 1}. Set any column to "Skip" to ignore it.{' '}
              {headerIndex > 0 && <span>(Rows above it were ignored.)</span>}
            </p>
            <div className="card divide-y divide-gold/20 p-0">
              {headers.map((h, i) => {
                const sample = rows.slice(headerIndex + 1).map((r) => r[i]).find(Boolean)
                return (
                  <div key={i} className="grid gap-2 px-4 py-2 sm:grid-cols-[1fr_1fr_14rem] sm:items-center">
                    <div className="font-medium text-navy">{h || <em className="text-navy/40">(no header)</em>}</div>
                    <div className="truncate text-xs text-navy/50">{sample ? `e.g. ${sample}` : 'empty'}</div>
                    <select
                      aria-label={`Field for column ${h}`}
                      className="input"
                      value={mapping[i] ?? ''}
                      onChange={(e) => {
                        const f = e.target.value as ImportField | ''
                        // each field maps from one column; moving it clears the old column
                        setMapping((m) => m.map((x, j) => (j === i ? f : f && x === f ? '' : x)))
                      }}
                    >
                      <option value="">Skip</option>
                      {IMPORT_FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
            {!mapping.includes('name') && (
              <p role="alert" className="text-sm text-rose">Choose which column holds the company name.</p>
            )}
          </section>

          {preview.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg">2. Preview</h2>
              <p className="text-sm text-navy/70">
                <strong>{toImport.length}</strong> of {preview.length} rows will be added to {kindInfo.label}. Rows that look like duplicates are unchecked; tick them if they're really different companies.
              </p>
              <ul className="card divide-y divide-gold/20 overflow-hidden p-0">
                {preview.map((r) => (
                  <li key={r.line} className={`flex items-start gap-3 px-4 py-3 ${r.include ? '' : 'bg-cream/70'}`}>
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 accent-burgundy"
                      checked={r.include}
                      disabled={r.blocking}
                      aria-label={`Import line ${r.line}`}
                      onChange={(e) => setOverrides((o) => ({ ...o, [r.line]: e.target.checked }))}
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-medium ${r.include ? 'text-navy' : 'text-navy/50'}`}>{r.name || '(blank)'}</span>
                        <StatusPill status={r.status ?? 'not_contacted'} />
                        <span className="text-xs text-navy/40">line {r.line}</span>
                      </div>
                      <div className="truncate text-xs text-navy/60">
                        {[r.contact_name, r.email, r.phone].filter(Boolean).join(' · ')}
                      </div>
                      <div className="text-xs text-navy/60">
                        Owner: {users.find((u) => u.id === r.ownerId)?.name ?? 'Unassigned'}
                        {r.ownerUnmatched && <span className="text-rose"> (couldn't match "{r.owner}")</span>}
                        {r.statusRaw && !r.status && <span className="text-rose"> · status "{r.statusRaw}" not recognized, using {STATUS_LABEL.not_contacted}</span>}
                      </div>
                      {r.problem && <div className="text-xs font-medium text-rose">{r.problem}</div>}
                    </div>
                  </li>
                ))}
              </ul>
              <button className="btn btn-accent w-full sm:w-auto" disabled={busy || toImport.length === 0} onClick={runImport}>
                {busy ? 'Importing…' : `Import ${toImport.length} ${toImport.length === 1 ? 'company' : 'companies'}`}
              </button>
            </section>
          )}
        </>
      )}
    </div>
  )
}
