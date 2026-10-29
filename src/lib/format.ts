export function money(n: number | null | undefined, opts: { cents?: boolean } = {}): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: opts.cents ? 2 : 0,
    minimumFractionDigits: opts.cents ? 2 : 0,
  })
}

/** Parse a user-typed amount like "$1,250" → 1250; blank → null. */
export function parseMoney(s: string): number | null {
  const cleaned = s.replace(/[$,\s]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Make a website value clickable even when typed without a scheme. */
export function hrefFor(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}
