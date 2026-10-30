// What stands out in the deals, a line each, as the run's words: the Overview shows them under
// Insights. Counted from the rows; nothing is written.
const DAY = 864e5
const ago = (d) => (d ? (Date.now() - Date.parse(d)) / DAY : Number.POSITIVE_INFINITY)
const amount = (v) => (v && typeof v === 'object' ? v.amount : typeof v === 'number' ? v : null)
const median = (ns) => [...ns].sort((a, b) => a - b)[Math.floor(ns.length / 2)]
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

export default async (alpha) => {
  const deals = await alpha.rows.list('Deals')
  if (!deals.length) return { words: 'No deals to read yet.' }
  const lines = []
  const fresh = deals.filter((d) => ago(d.values['First seen']) < 7)
  const by = new Map()
  for (const d of fresh) {
    const s = String(d.values.Location ?? '')
      .split(',')
      .at(-1)
      .trim()
    if (s) by.set(s, (by.get(s) ?? 0) + 1)
  }
  const top = [...by].sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (fresh.length)
    lines.push(
      `${plural(fresh.length, 'new deal')} this week${top.length ? `, most in ${top.map(([s, n]) => `${s} (${n})`).join(', ')}` : ''}.`,
    )
  const fits = deals.filter((d) => d.values.Fit === 'Fits' && d.values.Stage !== 'Passed')
  lines.push(`${fits.length} of ${deals.length} deals fit your criteria.`)
  const stale = deals.filter(
    (d) =>
      (d.values.Stage ?? 'New') === 'New' && !d.values.Reviewed && ago(d.values['First seen']) > 14,
  )
  if (stale.length)
    lines.push(`${plural(stale.length, 'deal')} at New for over two weeks, not reviewed.`)
  const multiples = fits
    .map((d) => d.values['Multiple of SDE'])
    .filter((n) => typeof n === 'number')
  if (multiples.length >= 3)
    lines.push(`The deals that fit ask a median ${median(multiples).toFixed(1)}× SDE.`)
  const asked = fits.map((d) => amount(d.values['Asking price'])).filter((n) => n !== null)
  if (asked.length >= 3)
    lines.push(`Their median asking price is $${Math.round(median(asked) / 1e3)}k.`)
  const gone = deals.filter((d) => ['Under LOI', 'Sold'].includes(d.values['Status at source']))
  if (gone.length) lines.push(`${plural(gone.length, 'deal')} under LOI or sold at the source.`)
  return { words: lines.join('\n') }
}
