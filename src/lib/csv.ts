// CSV parsing and column mapping for company imports.
// Kept free of browser/React imports so it can be tested directly with Node.

export type ImportField =
  | 'name' | 'category' | 'contact_name' | 'contact_first' | 'contact_last' | 'contact_title'
  | 'email' | 'phone' | 'website' | 'address' | 'city' | 'state' | 'zip'
  | 'status' | 'owner' | 'last_contact_date' | 'notes'

export const IMPORT_FIELDS: { id: ImportField; label: string }[] = [
  { id: 'name', label: 'Company name' },
  { id: 'category', label: 'Category / industry' },
  { id: 'contact_name', label: 'Contact name (full)' },
  { id: 'contact_first', label: 'Contact first name' },
  { id: 'contact_last', label: 'Contact last name' },
  { id: 'contact_title', label: 'Contact title' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'website', label: 'Website' },
  { id: 'address', label: 'Address / street' },
  { id: 'city', label: 'City' },
  { id: 'state', label: 'State' },
  { id: 'zip', label: 'ZIP' },
  { id: 'status', label: 'Status' },
  { id: 'owner', label: 'Owner (volunteer name or email)' },
  { id: 'last_contact_date', label: 'Last contact date' },
  { id: 'notes', label: 'Notes' },
]

/** Normalized header text → field. Order matters: earlier entries win ties. */
const SYNONYMS: [ImportField, string[]][] = [
  ['name', ['company', 'companyname', 'business', 'businessname', 'organization', 'organisation', 'org', 'orgname', 'name', 'sponsor', 'sponsorname', 'donor', 'donorname', 'vendor', 'account', 'accountname', 'distributor', 'brand', 'establishment', 'restaurant', 'store', 'shop']],
  ['contact_first', ['firstname', 'first', 'fname', 'contactfirstname', 'givenname']],
  ['contact_last', ['lastname', 'last', 'lname', 'surname', 'contactlastname', 'familyname']],
  ['contact_name', ['contact', 'contactname', 'contactperson', 'person', 'primarycontact', 'pointofcontact', 'poc', 'fullname', 'owner/contact', 'whotocontact', 'decisionmaker']],
  ['contact_title', ['title', 'jobtitle', 'position', 'role', 'contacttitle']],
  ['email', ['email', 'emailaddress', 'e-mail', 'mail', 'contactemail', 'emails']],
  ['phone', ['phone', 'phonenumber', 'telephone', 'tel', 'mobile', 'cell', 'cellphone', 'contactphone', 'phone#', 'number', 'workphone', 'officephone']],
  ['website', ['website', 'web', 'url', 'site', 'webpage', 'homepage', 'websiteurl', 'link']],
  ['address', ['address', 'streetaddress', 'street', 'address1', 'addressline1', 'mailingaddress', 'location', 'fulladdress']],
  ['city', ['city', 'town']],
  ['state', ['state', 'st', 'province', 'region']],
  ['zip', ['zip', 'zipcode', 'postalcode', 'postcode', 'zip/postal']],
  ['category', ['category', 'industry', 'type', 'sector', 'businesstype', 'kind', 'segment', 'vertical']],
  ['status', ['status', 'stage', 'outreachstatus', 'response', 'result', 'state of ask', 'askstatus']],
  ['owner', ['owner', 'assignedto', 'assigned', 'volunteer', 'who', 'lead', 'reachoutby', 'contactedby', 'responsible', 'askedby', 'caller', 'whoscalling', 'whoiscalling', 'whoscontacting']],
  ['last_contact_date', ['lastcontact', 'lastcontactdate', 'lastcontacted', 'datecontacted', 'contactdate', 'lasttouch', 'date']],
  ['notes', ['notes', 'note', 'comments', 'comment', 'details', 'description', 'remarks', 'history', 'info', 'misc']],
]

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9#/]/g, '')
}

/** Parse CSV/TSV text. Handles BOM, quoted fields (with commas, quotes, newlines), CRLF, ; or tab delimiters. */
export function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, '')
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const delim = [',', ';', '\t'].reduce((best, d) => (countOutsideQuotes(firstLine, d) > countOutsideQuotes(firstLine, best) ? d : best), ',')

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"' && field.trim() === '') {
      field = ''
      inQuotes = true
    } else if (ch === delim) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''))
}

function countOutsideQuotes(line: string, ch: string): number {
  let n = 0
  let q = false
  for (const c of line) {
    if (c === '"') q = !q
    else if (c === ch && !q) n++
  }
  return n
}

export function fieldForHeader(header: string): ImportField | null {
  const h = normHeader(header)
  if (!h) return null
  for (const [field, keys] of SYNONYMS) if (keys.some((k) => normHeader(k) === h)) return field
  // looser: header contains a distinctive keyword ("Company Name (legal)", "Primary Email")
  const contains: [ImportField, RegExp][] = [
    ['email', /e-?mail/],
    ['phone', /phone|cell|mobile|tel/],
    ['website', /website|url|web/],
    ['contact_first', /first/],
    ['contact_last', /last ?name|surname/],
    ['last_contact_date', /last.*contact|contacted|date/],
    ['contact_title', /title|position/],
    ['zip', /zip|postal/],
    ['address', /address|street/],
    ['status', /status|stage/], // before notes: "Status / Notes" feeds status; unmatched text is kept as a note
    ['notes', /note|comment/],
    ['owner', /owner|assigned|volunteer|calling|caller/],
    ['contact_name', /contact|person/],
    ['name', /company|business|organi[sz]ation|sponsor|donor|vendor/],
    ['category', /industry|category|type/],
  ]
  const raw = header.toLowerCase()
  for (const [field, re] of contains) if (re.test(raw)) return field
  return null
}

/**
 * Find the header row (messy exports often have a title line or blank rows first)
 * and guess a field for each column. Each field is used at most once.
 */
export function detectHeader(rows: string[][]): { headerIndex: number; mapping: (ImportField | '')[] } {
  let best = { headerIndex: 0, mapping: [] as (ImportField | '')[], score: -1 }
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const mapping = guessMapping(rows[i])
    const score = mapping.filter(Boolean).length + (mapping.includes('name') ? 2 : 0)
    if (score > best.score) best = { headerIndex: i, mapping, score }
  }
  return { headerIndex: best.headerIndex, mapping: best.mapping }
}

export function guessMapping(headers: string[]): (ImportField | '')[] {
  const guesses = headers.map(fieldForHeader)
  // A plain "Name" column alongside a "Company"/"Business" column is the contact's name.
  const hasCompanyColumn = headers.some((h, i) => guesses[i] === 'name' && normHeader(h) !== 'name')
  const used = new Set<ImportField>()
  return headers.map((h, i) => {
    let f = guesses[i]
    if (f === 'name' && normHeader(h) === 'name' && hasCompanyColumn) f = 'contact_name'
    if (!f || used.has(f)) return ''
    used.add(f)
    return f
  })
}

export type CompanyStatus = 'not_contacted' | 'reached_out' | 'following_up' | 'yes' | 'no'

export function normalizeStatus(v: string): CompanyStatus | null {
  const s = v.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!s) return null
  if (/^(no|declined?|not interested|pass(ed)?|rejected|turned down|n)$/.test(s) || /declin|not interested|said no/.test(s)) return 'no'
  if (/^(yes|y|committed|confirmed|agreed|donated|done|secured|won)$/.test(s) || /said yes|committed|confirmed|secured/.test(s)) return 'yes'
  if (/follow|pending|waiting|thinking|maybe|in progress|considering|callback|call back/.test(s)) return 'following_up'
  if (/reached|contacted|emailed|called|sent|left|voicemail|asked/.test(s)) return 'reached_out'
  if (/not contacted|new|todo|to do|none|not started|uncontacted/.test(s)) return 'not_contacted'
  return null
}

/** Accepts 2027-01-05, 1/5/2027, 1/5/27, Jan 5 2027 → 'YYYY-MM-DD', else null. */
export function normalizeDate(v: string): string | null {
  const s = v.trim()
  if (!s) return null
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) {
    let y = +m[3]
    if (y < 100) y += 2000
    return iso(y, +m[1], +m[2])
  }
  const t = Date.parse(s)
  if (!Number.isNaN(t)) {
    const d = new Date(t)
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate())
  }
  return null
}

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Loose key for duplicate detection: "The Acme Co., LLC" → "acme". */
export function companyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(the|inc|llc|l l c|co|company|corp|corporation|ltd|incorporated|pllc|pa|lp|llp)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface MappedRow {
  line: number
  name: string
  category: string | null
  contact_name: string | null
  contact_title: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  status: CompanyStatus | null
  statusRaw: string
  owner: string
  last_contact_date: string | null
  notes: string | null
}

export function mapRows(rows: string[][], headerIndex: number, mapping: (ImportField | '')[]): MappedRow[] {
  const get = (r: string[], f: ImportField) => {
    const i = mapping.indexOf(f)
    return i >= 0 ? (r[i] ?? '').trim().replace(/[ \t]+/g, ' ') : ''
  }
  const or = (s: string) => s || null
  return rows.slice(headerIndex + 1).map((r, i) => {
    const contact = get(r, 'contact_name') || [get(r, 'contact_first'), get(r, 'contact_last')].filter(Boolean).join(' ')
    const street = get(r, 'address')
    const cityLine = [get(r, 'city'), [get(r, 'state'), get(r, 'zip')].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    const statusRaw = get(r, 'status')
    const status = normalizeStatus(statusRaw)
    // keep free-text status ("Called - left VM") as a note so nothing is lost
    const statusNote = statusRaw && (status === null || statusRaw.length > 12) ? statusRaw : ''
    let email = get(r, 'email')
    // "Jane <jane@x.com>" or "mailto:" junk
    const em = email.match(/[^\s<>"'(),;:]+@[^\s<>"'(),;:]+\.[a-z]{2,}/i)
    email = em ? em[0].toLowerCase() : email
    return {
      line: headerIndex + i + 2,
      name: get(r, 'name').replace(/\s+/g, ' '),
      category: or(get(r, 'category')),
      contact_name: or(contact),
      contact_title: or(get(r, 'contact_title')),
      email: or(email),
      phone: or(get(r, 'phone')),
      website: or(get(r, 'website').replace(/^https?:\/\//i, '').replace(/\/$/, '')),
      address: or([street, cityLine].filter(Boolean).join(', ')),
      status,
      statusRaw,
      owner: get(r, 'owner'),
      last_contact_date: normalizeDate(get(r, 'last_contact_date')),
      notes: or([statusNote, get(r, 'notes')].filter(Boolean).join('\n')),
    }
  })
}

export const TEMPLATE_CSV =
  'Company,Category,Contact Name,Title,Email,Phone,Website,Address,Owner,Status,Last Contact,Notes\r\n' +
  'Example Restaurant Group,Restaurant,Jane Smith,Marketing Director,jane@example.com,(803) 555-0100,example.com,"123 Main St, Columbia SC 29201",Jay Bubar,Not contacted,,Met at chamber mixer\r\n'
