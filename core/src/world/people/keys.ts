// A name as it is compared: case and spacing aside, outer punctuation dropped.
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .replace(/^[\s.,;]+|[\s.,;]+$/g, '')
}

export function isEmail(s: string): boolean {
  return /^[^@\s<>,;"']+@[^@\s<>,;"']+\.[^@\s<>,;"']+$/.test(s)
}

// A name that is only a way to reach someone: an address, a number, a link.
export function keyLike(name: string): boolean {
  const t = name.trim()
  return (
    t.includes('@') ||
    /^https?:\/\//i.test(t) ||
    ((t.match(/\d/g) ?? []).length >= 6 && !/\p{L}/u.test(t))
  )
}

// A profile link as it is compared: no scheme, no www, no query, no trailing slash.
export function profileKey(url: string): string | null {
  const t = url.trim().toLowerCase()
  if (!t) return null
  const bare = t
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
  return bare.includes('.') && bare.includes('/') ? bare : null
}

// The domain an address says its owner belongs to; none for a mail service everyone uses.
// The domain under its public suffix: alerts.sbi.co.in is sbi.co.in, mail.acme.com is acme.com.
export function mainDomain(domain: string, seconds: Set<string>): string {
  const labels = domain.toLowerCase().split('.').filter(Boolean)
  const tld = labels.at(-1) ?? ''
  const second = labels.at(-2) ?? ''
  const keep = tld.length === 2 && seconds.has(second) ? 3 : 2
  return labels.slice(-keep).join('.')
}

// The domain an address says its owner belongs to; none for a mail service everyone uses.
export function domainOf(
  email: string,
  services: Set<string>,
  seconds: Set<string> = new Set(),
): string | null {
  const at = email.lastIndexOf('@')
  const whole = at < 0 ? '' : email.slice(at + 1).toLowerCase()
  if (!whole.includes('.') || services.has(whole)) return null
  const d = mainDomain(whole, seconds)
  return services.has(d) ? null : d
}

// A company's name until a row names it: oakmill.com is Oakmill, chase-global.com is Chase
// Global.
export function domainWords(domain: string): string {
  return (domain.split('.')[0] ?? domain)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Addresses as a message writes them: Name <address>, another@address, "Last, First" <x@y>.
export function addressList(text: string): { name: string | null; email: string }[] {
  const out = new Map<string, string | null>()
  for (const piece of text.split(/(?<=>)\s*[,;]\s*/)) {
    const named = piece.match(/^([\s\S]*)<([^<>]+)>\s*$/)
    const parts = (named ? (named[1] ?? '') : piece).split(/\s*[,;]\s*/).map((p) => p.trim())
    if (!named) {
      for (const p of parts)
        if (isEmail(p) && !out.has(p.toLowerCase())) out.set(p.toLowerCase(), null)
      continue
    }
    let i = 0
    for (; i < parts.length - 1 && isEmail(parts[i] ?? ''); i++) {
      const e = (parts[i] as string).toLowerCase()
      if (!out.has(e)) out.set(e, null)
    }
    const email = (named[2] ?? '').trim().toLowerCase()
    if (!isEmail(email)) continue
    const name = parts
      .slice(i)
      .join(', ')
      .replace(/^["'\s]+|["'\s]+$/g, '')
    const clean = name && name.toLowerCase() !== email && !isEmail(name) ? name : null
    if (!out.get(email)) out.set(email, clean)
  }
  return [...out].map(([email, name]) => ({ email, name }))
}

export const text = (v: unknown): string =>
  v === null || v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v)

export const uniq = <T>(xs: T[]): T[] => [...new Set(xs)]
