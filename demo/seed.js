// Demo rows for the two sample modules, Deal sourcing and Case desk. Every name, company, amount
// and date is made up (word lists below, seeded random); links and addresses are on .example.
// Rows go in through the core's own API, parents first; dates are counted back from today.
//
//   node demo/seed.js http://127.0.0.1:4790 <token>
const [base, token] = process.argv.slice(2)
if (!base || !token) throw new Error('Say: node demo/seed.js <core address> <token>')

let s = 11
const rnd = () => {
  s = (s * 16807) % 2147483647
  return s / 2147483647
}
const pick = (a) => a[Math.floor(rnd() * a.length)]
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
const weighted = (pairs) => {
  let r = rnd() * pairs.reduce((a, [, w]) => a + w, 0)
  for (const [v, w] of pairs) {
    r -= w
    if (r <= 0) return v
  }
  return pairs[0][0]
}
const usd = (n) => ({ amount: Math.round(n), currency: 'USD' })
const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10)
const slug = (x) =>
  x
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const mail = (name, at) => `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@${at}`

const api = async (path, body) => {
  const r = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-alpha-token': token, 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`)
  return r.json()
}
const tables = new Map()
for (const m of await api('/api/modules')) for (const t of m.tables ?? []) tables.set(t.name, t.id)
const add = async (table, values) => {
  const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v != null))
  return (await api(`/api/tables/${tables.get(table)}/rows`, { values: clean })).id
}
const task = async (title, due, table, row, state = 'todo', priority = 'normal') => {
  const t = await api('/api/tasks', { title, due, priority, on: { table: tables.get(table), row } })
  if (state !== 'todo') await api(`/api/tasks/${t.id}/state`, { state })
}

const FIRST = [
  'Maren',
  'Theo',
  'Priya',
  'Owen',
  'Lucia',
  'Darius',
  'Inez',
  'Callum',
  'Rosa',
  'Felix',
  'Nadia',
  'Hugo',
  'Elena',
  'Marcus',
  'Ivy',
  'Jonah',
  'Clara',
  'Silas',
  'Amara',
  'Reid',
]
const LAST = [
  'Ashby',
  'Brennan',
  'Calloway',
  'Darrow',
  'Elmsworth',
  'Faraday',
  'Galloway',
  'Hollis',
  'Ingram',
  'Jessop',
  'Kincaid',
  'Lattimer',
  'Merriweather',
  'Northcott',
  'Oakley',
  'Pemberton',
  'Quarrie',
  'Redfern',
  'Sallow',
  'Thackeray',
]
const person = () => `${pick(FIRST)} ${pick(LAST)}`

// --- Deal sourcing ---------------------------------------------------------------------------
const SOURCES = [
  ['Northgate Practice Brokers', 'Practice broker', 18],
  ['Harbor M&A', 'M&A adviser', 9],
  ['Ledgerline Advisors', 'Practice broker', 14],
  ['Bluestem Business Sales', 'Business broker', 8],
  ['Copperfield Exchange', 'Marketplace', 16],
  ['Summit Ridge Partners', 'M&A adviser', 5],
  ['Tallgrass Brokerage', 'Business broker', 6],
  ['Keystone Deal Room', 'Aggregator', 12],
  ['Willowbrook Advisors', 'Practice broker', 7],
  ['Cedar & Vale Capital', 'M&A adviser', 4],
  ['Riverbend Business Brokers', 'Business broker', 5],
  ['Brightwater Listings', 'Marketplace', 9],
  ['Granite Peak Advisors', 'M&A adviser', 3],
  ['Fieldstone Practice Sales', 'Practice broker', 8],
  ['Lantern Street Brokers', 'Business broker', 4],
  ['Meadowlark M&A', 'M&A adviser', 3],
  ['Open Ledger Market', 'Marketplace', 6],
  ['Ironwood Transition Partners', 'Practice broker', 5],
  ['Silver Birch Brokers', 'Business broker', 2],
  ['Quarry Hill Deal Feed', 'Aggregator', 4],
]
const sources = []
for (const [name, kind, weight] of SOURCES) {
  const contact = person()
  const state = weighted([
    ['Working', 14],
    ['Needs your sign-in', 2],
    ['Blocked', 2],
    ['Not read yet', 2],
  ])
  const id = await add('Sources', {
    Name: name,
    Kind: kind,
    Link: `https://${slug(name)}.example/listings`,
    On: state === 'Blocked' ? 'Off' : 'On',
    State: state,
    'Last checked': state === 'Working' ? day(-int(0, 2)) : day(-int(5, 40)),
    Contact: contact,
    'Contact email': mail(contact, `${slug(name)}.example`),
  })
  sources.push({ id, name, weight, contact, email: mail(contact, `${slug(name)}.example`), n: 0 })
}

const KINDS = [
  'Bookkeeping practice',
  'CPA firm',
  'Tax and advisory practice',
  'Payroll services firm',
  'Bookkeeping and tax practice',
  'Outsourced accounting firm',
  'Small-business advisory practice',
]
const TRAITS = [
  'Established',
  'Recurring-revenue',
  'Cloud-based',
  'Owner-retiring',
  'Growing',
  'Family-run',
  'Virtual',
]
const PLACES = [
  ['Columbus', 'Ohio'],
  ['Raleigh', 'North Carolina'],
  ['Tampa', 'Florida'],
  ['Boise', 'Idaho'],
  ['Austin', 'Texas'],
  ['Denver', 'Colorado'],
  ['Madison', 'Wisconsin'],
  ['Richmond', 'Virginia'],
  ['Tucson', 'Arizona'],
  ['Omaha', 'Nebraska'],
  ['Spokane', 'Washington'],
  ['Knoxville', 'Tennessee'],
  ['Sacramento', 'California'],
  ['Albany', 'New York'],
  ['Savannah', 'Georgia'],
  ['Portland', 'Maine'],
]
// Passed is the last choice, so a passed deal counts toward every stage's goal: a few only
const STAGES = [
  ['New', 80],
  ['Pending questions', 7],
  ['CIM requested', 5],
  ['CIM reviewed', 3.5],
  ['Call', 1.5],
  ['LOI sent', 0.6],
  ['Diligence', 0.4],
  ['Passed', 1],
]
const ORDER = STAGES.map(([x]) => x)
const deals = []
for (let i = 0; i < 250; i++) {
  const src = weighted(sources.map((x) => [x, x.weight]))
  src.n++
  const [city, state] = pick(PLACES)
  const stage = weighted(STAGES)
  // a long tail of prices: most between $300k and $1.5M, a few far above
  const price =
    Math.round(Math.exp(Math.log(700_000) + (rnd() + rnd() + rnd() - 1.5) * 1.3) / 5000) * 5000
  const revenue = price / (0.7 + rnd() * 0.9)
  const sde = revenue * (0.18 + rnd() * 0.3)
  const seen = -Math.floor(180 * rnd() ** 1.6) // more of them recent
  const past = ORDER.indexOf(stage) > 0
  const reviewed = past ? day(Math.max(seen, -int(0, 40))) : rnd() < 0.08 ? day(-int(0, 6)) : null
  const id = `${src.name.split(' ')[0].slice(0, 3).toUpperCase()}-${String(1000 + i * 7 + int(0, 6))}`
  const d = { stage, src, name: `${pick(TRAITS)} ${pick(KINDS).toLowerCase()} near ${city}` }
  d.id = await add('Deals', {
    Name: d.name,
    'Listing ID': id,
    Sources: src.id,
    Link: `https://${slug(src.name)}.example/listings/${id}`,
    Stage: stage,
    'Status at source': weighted([
      ['Listed', 55],
      ['Under LOI', 30],
      ['On hold', 8],
      ['Sold', 5],
      ['Gone', 2],
    ]),
    Location: rnd() < 0.85 ? `${city}, ${state}` : null,
    'Asking price': rnd() < 0.85 || past ? usd(price) : null,
    Revenue: rnd() < 0.8 || past ? usd(revenue) : null,
    SDE: rnd() < 0.55 || past ? usd(sde) : null,
    Staff: rnd() < 0.5 || past ? int(1, 14) : null,
    'First seen': day(seen),
    Reviewed: reviewed,
    'Broker email': src.email,
  })
  deals.push(d)
}
for (const x of sources)
  await api(`/api/tables/${tables.get('Sources')}/rows/${x.id}`, {
    field: 'Deals found',
    value: x.n,
  })

// a CIM's figures for the deals that got that far, and the CIM itself on a few
const far = deals.filter(
  (d) => ORDER.indexOf(d.stage) >= ORDER.indexOf('CIM reviewed') && d.stage !== 'Passed',
)
for (const [i, d] of far.entries()) {
  const rev = int(400, 1600) * 1000
  for (const year of [2023, 2024, 2025]) {
    const r = rev * (1 + (year - 2025) * (0.04 + rnd() * 0.06))
    const net = r * (0.12 + rnd() * 0.12)
    const back = r * (0.08 + rnd() * 0.08)
    await add('Financials', {
      Deal: d.id,
      Year: year,
      Revenue: usd(r),
      'Net income': usd(net),
      'Add-backs': usd(back),
      SDE: usd(net + back),
    })
  }
  if (i < 4) {
    const body = `# ${d.name}\n\nConfidential information memorandum (sample, made up for the demo).\n\nRevenue 2025: $${rev.toLocaleString()}\nStaff: ${int(3, 9)} full time\nReason for selling: retirement\n`
    await fetch(`${base}/api/tables/${tables.get('Deals')}/rows/${d.id}/files`, {
      method: 'POST',
      headers: {
        'x-alpha-token': token,
        'content-type': 'text/markdown',
        'x-file-name': encodeURIComponent(`CIM ${d.name}.md`),
        'x-file-kind': 'CIM',
      },
      body,
    })
  }
}
const asked = deals.filter(
  (d) => ORDER.indexOf(d.stage) >= ORDER.indexOf('CIM requested') && d.stage !== 'Passed',
)
for (const [i, d] of asked.entries())
  await add('Outreach', {
    Deal: d.id,
    To: d.src.email,
    Subject: `Request for the CIM: ${d.name}`,
    State: i < 3 ? 'Waiting for you' : pick(['Sent', 'Sent', 'Replied']),
    When: day(-int(0, 30)),
  })
for (const d of deals.filter((x) => x.stage === 'Call').slice(0, 3))
  await task(
    `Call ${d.src.contact} about ${d.name}`,
    day(int(-2, 4)),
    'Deals',
    d.id,
    pick(['todo', 'doing']),
    'high',
  )
for (const d of deals.filter((x) => x.stage === 'Pending questions').slice(0, 4))
  await task(`Send questions on ${d.name}`, day(int(-3, 5)), 'Deals', d.id)
console.log(
  `Deal sourcing: ${sources.length} sources, ${deals.length} deals, ${far.length} with figures, ${asked.length} outreach.`,
)

// --- Case desk -------------------------------------------------------------------------------
const CARRIERS = [
  'Northline Mutual',
  'Granite Shield Assurance',
  'Bayfront Life',
  'Meridian Benefit Co.',
  'Cobalt Casualty',
  'Lakeshore Guardian',
]
const carriers = new Map()
for (const name of CARRIERS)
  carriers.set(
    name,
    await add('Carriers', {
      Name: name,
      'Days to answer': int(30, 90),
      'Contact email': `claims@${slug(name)}.example`,
    }),
  )
const HANDLERS = ['A. Morrow', 'B. Castellan', 'C. Okonjo', 'D. Whitfield', 'E. Saranne']
const NEXT = [
  'Request the latest records',
  'Call the client about the carrier’s letter',
  'Draft the claim statement',
  'Check the carrier’s decision date',
  'Send the quarterly update',
  'Review the appeal draft',
]
const clients = []
const named = new Set()
while (clients.length < 60) {
  const name = person()
  if (named.has(name)) continue
  named.add(name)
  const c = {
    name,
    risk: weighted([
      ['Stable', 60],
      ['Watch', 28],
      ['Critical', 12],
    ]),
    benefit: int(18, 95) * 100,
  }
  c.id = await add('Clients', {
    Name: name,
    Email: mail(name, 'mail.example'),
    Phone: `+1 555 01${String(int(10, 99))}`,
    Risk: c.risk,
    Handler: pick(HANDLERS),
    'Monthly benefit': usd(c.benefit),
    'Next step': pick(NEXT),
    'Next step due': day(int(-6, 21)),
    'Client since': day(-int(30, 900)),
  })
  clients.push(c)
}
const CLAIM_STAGES = [
  ['Intake', 20],
  ['Records requested', 25],
  ['Drafting', 20],
  ['Filed', 12],
  ['Under review', 12],
  ['Appeal', 5],
  ['Decided', 6],
]
let claimsN = 0
for (const c of clients) {
  for (let k = 0; k < (rnd() < 0.35 ? 2 : 1); k++) {
    const stage = weighted(CLAIM_STAGES)
    const carrier = pick(CARRIERS)
    const opened = -int(5, 170)
    await add('Claims', {
      Claim: `${c.name} v. ${carrier}`,
      Client: c.id,
      Carrier: carriers.get(carrier),
      Stage: stage,
      Outcome:
        stage === 'Decided'
          ? weighted([
              ['Approved', 7],
              ['Denied', 3],
            ])
          : stage === 'Appeal'
            ? 'Denied'
            : 'Pending',
      'Amount claimed': usd(c.benefit * int(12, 36)),
      Opened: day(opened),
      Due: day(int(-12, 45)),
      'Record pages': int(40, 2400),
    })
    claimsN++
  }
  if (c.risk !== 'Stable' || rnd() < 0.4)
    for (const m of [-60, -30, 0, 30])
      await add('Payments', {
        Payment: `${c.name}, ${day(m).slice(0, 7)}`,
        Client: c.id,
        Expected: day(m + int(-3, 3)),
        Amount: usd(c.benefit),
        State:
          m > 0
            ? 'Expected'
            : m < 0
              ? weighted([
                  ['Arrived', 9],
                  ['Late', 1],
                ])
              : weighted([
                  ['Arrived', 5],
                  ['Late', 2],
                  ['Chasing', 2],
                  ['Expected', 2],
                ]),
      })
}
// leads; the first has a client's name, so Alpha asks whether they are the same person
const LEAD_STAGES = [
  ['New', 6],
  ['Contacted', 4],
  ['Consultation', 3],
  ['Agreement sent', 2],
  ['Signed', 2],
  ['Declined', 1],
]
for (let i = 0; i < 20; i++) {
  const name = i === 0 ? clients[3].name : person()
  await add('Leads', {
    Name: name,
    Email: i === 0 ? null : mail(name, 'inbox.example'),
    Source: pick(['Website form', 'Email', 'Phone', 'Referral']),
    Stage: weighted(LEAD_STAGES),
    Received: day(-int(0, 14)),
    'Likely monthly value': usd(int(20, 80) * 100),
  })
}
let tasksN = 0
for (const c of clients.filter((x) => x.risk !== 'Stable').slice(0, 20)) {
  await task(
    `${pick(NEXT)} for ${c.name}`,
    day(int(-5, 7)),
    'Clients',
    c.id,
    pick(['todo', 'todo', 'doing', 'waiting']),
    c.risk === 'Critical' ? 'high' : 'normal',
  )
  tasksN++
}
console.log(`Case desk: ${clients.length} clients, ${claimsN} claims, 20 leads, ${tasksN} tasks.`)

// --- Agents: Alpha's and Network's own paused; the sample modules' agents stay paused and run
// once each here, so their runs, their lines on Home and Insights show. None reads a site.
// Statement check stops for want of a bank statement: on for a moment, its runs that did not
// finish make the card waiting on Home, and it is paused again.
const ours = []
for (const m of await api('/api/working'))
  for (const a of m.agents) {
    if (a.state === 'on') await api(`/api/agents/${a.id}`, { state: 'paused' })
    if (['Deal sourcing', 'Case desk'].includes(m.name)) ours.push(a)
  }
const order = ['Fit', 'Insights', 'Overdue claims', 'Lead aging']
for (const name of order) {
  const a = ours.find((x) => x.name === name)
  if (!a) continue
  const before = (await api('/api/activity')).filter((r) => r.name === name).length
  await api(`/api/agents/${a.id}/run`, {})
  for (let i = 0; i < 120; i++) {
    const runs = (await api('/api/activity')).filter((r) => r.name === name)
    if (runs.length > before && runs[0].state !== 'running') break
    await new Promise((r) => setTimeout(r, 500))
  }
}
const check = ours.find((x) => x.name === 'Statement check')
await api(`/api/agents/${check.id}`, { state: 'on' })
for (let i = 0; i < 60; i++) {
  if ((await api('/api/stream')).cards.some((c) => /did not finish/.test(c.words))) break
  await new Promise((r) => setTimeout(r, 1000))
}
await api(`/api/agents/${check.id}`, { state: 'paused' })
console.log(`Ran ${order.join(', ')} and Statement check; every agent paused.`)
