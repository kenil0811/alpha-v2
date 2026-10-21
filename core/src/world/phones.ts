// Phone numbers in one form (design §4): every phone is kept as E.164 (+447700900123), so
// 07700 900123 and +44 7700 900123 are one key and one person. A number written without its
// country is read in the country most of the kept numbers that carry a code are in, and failing
// that the Mac's own region: v1 found the Mac's region said Singapore while its clock said the
// UK, so the numbers are the better witness. A number that can't be read is kept as written, and
// never merges with another written differently.
import { execFileSync } from 'node:child_process'
import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js/max'

let macRegion: CountryCode | null | undefined

// The Mac's region (en_SG → SG), else the locale's; none off a Mac with no region.
export function homeRegion(): CountryCode | null {
  if (macRegion !== undefined) return macRegion
  let locale = ''
  if (process.platform === 'darwin') {
    try {
      locale = execFileSync('/usr/bin/defaults', ['read', '-g', 'AppleLocale'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {
      // the locale below
    }
  }
  locale ||= Intl.DateTimeFormat().resolvedOptions().locale
  const region = locale.replace('_', '-').split('-')[1]?.split('@')[0]?.toUpperCase()
  macRegion = region && /^[A-Z]{2}$/.test(region) ? (region as CountryCode) : null
  return macRegion
}

// The number in E.164, or null when it can't be read: written with its country (+44 …, 0044 …),
// or local to the region.
export function e164(text: string, region: CountryCode | null): string | null {
  let raw = text.replace(/\s+/g, ' ').trim()
  if ((raw.match(/\d/g) ?? []).length < 6) return null
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`
  const n = parsePhoneNumberFromString(raw, raw.startsWith('+') ? undefined : (region ?? undefined))
  return n?.isPossible() ? n.number : null
}

// The country an E.164 number's code is in, by the code alone.
export function regionOf(number: string): CountryCode | null {
  return parsePhoneNumberFromString(number)?.country ?? null
}

// The country most of these numbers that carry a code are in; the Mac's when none does.
export function likelyRegion(numbers: string[]): CountryCode | null {
  const seen = new Map<CountryCode, number>()
  for (const n of numbers) {
    if (!n.startsWith('+')) continue
    const r = regionOf(n)
    if (r) seen.set(r, (seen.get(r) ?? 0) + 1)
  }
  const best = [...seen].sort((a, b) => b[1] - a[1])[0]
  return best ? best[0] : homeRegion()
}

// The key a phone is kept by: E.164 when it can be read, else its digits as written.
export function phoneKey(text: string, region: CountryCode | null): string {
  return e164(text, region) ?? text.replace(/[^\d+]/g, '')
}

// A kept number as a person writes it: +1 415 555 0132.
export function phoneWords(number: string): string {
  return number.startsWith('+')
    ? (parsePhoneNumberFromString(number)?.formatInternational() ?? number)
    : number
}
