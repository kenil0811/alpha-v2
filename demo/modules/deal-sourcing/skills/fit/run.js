// Each deal's loan and payments from the Financing rows, what its SDE leaves after them, and its
// fit against the gates, each value written with the formula it came from.
const amount = (v) => (v && typeof v === 'object' ? v.amount : typeof v === 'number' ? v : null)
const usd = (n) => ({ amount: Math.round(n), currency: 'USD' })
const k = (n) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1e3)}k`)

export default async (alpha) => {
  const criteria = await alpha.rows.list('Criteria')
  const value = (words) =>
    criteria.find((c) =>
      String(c.values.Criterion ?? '')
        .toLowerCase()
        .startsWith(words),
    )?.values.Value
  const down = value('down payment') ?? 10
  const rate = value('interest') ?? 10.5
  const years = value('loan term') ?? 10
  const gates = criteria.filter((c) => c.values.Kind === 'Gate' && c.values['Deals field'])
  const r = rate / 100 / 12
  const yearly = (loan) => ((loan * r) / (1 - (1 + r) ** -(years * 12))) * 12
  let changed = 0
  const fits = []
  for (const d of await alpha.rows.list('Deals')) {
    const v = d.values
    const out = {}
    const formula = {}
    const notes = {}
    const price = amount(v['Asking price'])
    const sde = amount(v.SDE)
    if (price) {
      const loan = price * (1 - down / 100)
      const pay = yearly(loan)
      out['Loan needed'] = usd(loan)
      formula['Loan needed'] = 'Asking price × (1 − down payment)'
      notes['Loan needed'] = `${k(price)} × ${100 - down}%`
      out['Debt service'] = usd(pay)
      formula['Debt service'] = 'yearly payments on the loan'
      notes['Debt service'] = `${rate}% over ${years} years`
      if (sde) {
        out['SDE after debt service'] = usd(sde - pay)
        formula['SDE after debt service'] = 'SDE − Debt service'
        notes['SDE after debt service'] = `${k(sde)} − ${k(pay)}`
        out['Multiple of SDE'] = Math.round((price / sde) * 100) / 100
        formula['Multiple of SDE'] = 'Asking price ÷ SDE'
        notes['Multiple of SDE'] = `${k(price)} ÷ ${k(sde)}`
      }
    }
    const said = gates.map((g) => {
      const f = g.values['Deals field']
      const n = amount(out[f] ?? v[f])
      const limit = g.values.Value
      if (n === null || n === undefined)
        return { ok: null, words: `${g.values.Criterion}: not known yet` }
      const ok = g.values.Test === 'At most' ? n <= limit : n >= limit
      const show = (x) => (f === 'Staff' ? String(x) : k(x))
      return {
        ok,
        words: `${g.values.Criterion}: ${show(n)} ${ok ? 'passes' : 'fails'} (${g.values.Test.toLowerCase()} ${show(limit)})`,
      }
    })
    out.Fit = said.some((s) => s.ok === false)
      ? 'Does not fit'
      : said.every((s) => s.ok)
        ? 'Fits'
        : 'Not enough to say'
    out.Why = said.map((s) => s.words).join('; ')
    formula.Fit = 'every gate passes'
    notes.Fit = out.Why
    const differs = Object.entries(out).filter(
      ([f, x]) => JSON.stringify(v[f]) !== JSON.stringify(x),
    )
    if (!differs.length) continue
    if (out.Fit === 'Fits' && v.Fit !== 'Fits') fits.push(d.id)
    const keep = (o) => Object.fromEntries(differs.filter(([f]) => f in o).map(([f]) => [f, o[f]]))
    await alpha.rows.compute('Deals', d.id, Object.fromEntries(differs), keep(formula), keep(notes))
    changed++
  }
  if (fits.length)
    await alpha.tell(
      `${fits.length} new deal${fits.length === 1 ? '' : 's'} fit${fits.length === 1 ? 's' : ''} your criteria.`,
      {
        table: 'Deals',
        rows: fits,
        choice: { field: 'Stage', value: 'Passed', label: 'Pass' },
      },
    )
  return {
    words: `${changed} deal${changed === 1 ? '' : 's'} refigured, ${fits.length} newly fitting.`,
  }
}
