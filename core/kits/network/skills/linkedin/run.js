// LinkedIn export: LinkedIn's own Connections.csv, when the person drops it in, read into LinkedIn
// row by row, each connection kept by their profile link, so a newer export changes them in place.
// The file opens with a few lines of notes before its header; any other spreadsheet is not this
// kit's and is left alone.

const HEADER = [
  'first name',
  'last name',
  'url',
  'email address',
  'company',
  'position',
  'connected on',
]
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const colNumber = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
const pad = (n) => String(n).padStart(2, '0')

// "21 Oct 2026" or "2026-10-21" as a date; anything else, none
function dateOf(words) {
  const t = String(words ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = /^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/.exec(t)
  const i = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1
  return i < 0 ? null : `${m[3]}-${pad(i + 1)}-${pad(m[1])}`
}

// the first sheet's rows in order, each its cells by column number
function rowsOf(cells) {
  const sheet = cells[0]?.sheet
  const rows = new Map()
  for (const c of cells) {
    if (c.sheet !== sheet || !c.row || !c.cell) continue
    const r = rows.get(c.row) ?? new Map()
    r.set(colNumber(c.cell.replace(/\d+$/, '')), {
      words: String(c.words ?? '').trim(),
      cell: c.cell,
    })
    rows.set(c.row, r)
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r)
}

export default async (alpha) => {
  const filed = alpha.input.filed ?? []
  let landed = 0
  const read = []
  for (const f of filed) {
    if (f.kind !== 'sheet') continue
    const rows = rowsOf(await alpha.documents.read(f.file))
    const at = rows.findIndex((r) =>
      HEADER.every((h) => [...r.values()].some((c) => c.words.toLowerCase() === h)),
    )
    if (at < 0) continue
    const col = new Map([...rows[at]].map(([n, c]) => [c.words.toLowerCase(), n]))
    const get = (r, h) => r.get(col.get(h))?.words ?? ''
    const place = (r, h) => ({ file: f.file, sheet: undefined, cell: r.get(col.get(h))?.cell })
    const items = []
    for (const r of rows.slice(at + 1)) {
      const url = get(r, 'url')
      if (!/^https?:\/\//.test(url)) continue
      const name = [get(r, 'first name'), get(r, 'last name')].filter(Boolean).join(' ')
      const values = {
        Name: name || url,
        Profile: url,
        ...(get(r, 'email address') ? { Email: get(r, 'email address') } : {}),
        ...(get(r, 'company') ? { Company: get(r, 'company') } : {}),
        ...(get(r, 'position') ? { Position: get(r, 'position') } : {}),
        ...(dateOf(get(r, 'connected on'))
          ? { 'Connected on': dateOf(get(r, 'connected on')) }
          : {}),
      }
      const places = Object.fromEntries(
        [
          ['Name', 'first name'],
          ['Profile', 'url'],
          ['Email', 'email address'],
          ['Company', 'company'],
          ['Position', 'position'],
          ['Connected on', 'connected on'],
        ]
          .filter(([field]) => values[field] !== undefined)
          .map(([field, h]) => {
            const p = place(r, h)
            return [field, { file: p.file, ...(p.cell ? { cell: p.cell } : {}) }]
          }),
      )
      items.push({ key: url.replace(/\/+$/, '').toLowerCase(), values, places })
    }
    if (!items.length) continue
    await alpha.rows.land('LinkedIn', items)
    landed += items.length
    read.push(f.name)
  }
  if (!read.length) return { words: 'No LinkedIn export among the files.' }
  await alpha.tell(
    `Read ${landed} LinkedIn connection${landed === 1 ? '' : 's'} from ${read.join(', ')}; each is one of your people now.`,
  )
  return { words: `Read ${landed} connections from ${read.join(', ')}.` }
}
