// Onboarding against the plugin host's contract, the host made up here: the overview it starts
// from, every tool of the closer look in the person's own zone, every check on the answer, the
// lines landing in About you, a question answered, Keep, Edit and Drop, what starts a
// conversation, Forget. The model is a function here that uses the tools as Claude would.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Input, PluginHost, PluginTool, Row } from '@alpha/plugin-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { check, fromWords } from './answer.ts'
import { type Run, register } from './index.ts'
import { readSources } from './sources.ts'
import { buildSummary } from './summary.ts'
import { appRuns, seriesOf, shapeOf, toolsOf } from './tools.ts'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'alpha-onboarding-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

// A moment in October 2026, in UTC; the person is in Singapore, eight hours ahead.
const z = (d: number, h: number, m = 0) =>
  `2026-10-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`

type Use = (tool: string, input?: Record<string, unknown>) => Promise<unknown>
type Model = (use: Use, prompt: string) => Promise<unknown>

const none: Model = async () => ({ about: [], routines: [], suggestions: [], questions: [] })

function made(model: Model = none, connected = true) {
  const own = new Map<string, Row>()
  let next = 1
  const routes = new Map<string, (i: Input) => Promise<unknown>>()
  const starts: (() => string | null)[] = []
  const lines: string[] = []
  const prompts: string[] = []
  const tables: Record<string, Row[]> = {
    'Calendar/Events': [
      ...['20', '21', '22'].map((d, i) => ({
        id: `e${i}`,
        values: {
          Title: 'Pipeline review',
          Starts: z(Number(d), 2),
          Ends: z(Number(d), 3),
          Attendees: i === 2 ? 'Marco Ruiz' : 'Priya Shah, me@x.example',
          'Your address': 'me@x.example',
        },
      })),
      { id: 'e9', values: { Title: 'Therapy', Starts: z(20, 9), Ends: z(20, 10) } },
    ],
    'Contacts/Contacts': [
      {
        id: 'k1',
        values: { Name: 'Kenil Shah', Title: 'Founder', Company: 'Bridge', 'Is you': 'yes' },
      },
      {
        id: 'k2',
        values: {
          Name: 'Priya Shah',
          Company: 'Harbor',
          Emails: 'priya@harbor.example',
          Phones: '+65 9123 4567',
        },
      },
      { id: 'k3', values: { Name: 'Sam Lee', Company: 'Harbor' } },
    ],
    'Mail/Mail': [
      {
        id: 'm1',
        values: {
          Date: z(20, 4),
          Direction: 'sent',
          'To addresses': 'priya@harbor.example',
          Subject: 'Harbor deal: next steps',
        },
      },
      {
        id: 'm2',
        values: {
          Date: z(21, 4),
          Direction: 'sent',
          'To addresses': 'priya@harbor.example',
          Subject: 'Re: Harbor deal: next steps',
          Attachments: 'Harbor LOI.docx',
        },
      },
      {
        id: 'm3',
        values: {
          Date: z(20, 5),
          Direction: 'received',
          From: 'Bank <no-reply@bank.example>',
          'From address': 'no-reply@bank.example',
          Subject: 'Your statement 123456789',
        },
      },
      ...[20, 21].map((d) => ({
        id: `m${d}`,
        values: {
          Date: z(d, 0),
          Direction: 'received',
          From: 'BizBuySell',
          'From address': 'alerts@bizbuysell.com',
          Subject: `New listings: ${d - 8} car washes`,
        },
      })),
    ],
  }
  const reads: Record<string, Record<string, unknown>> = {
    'browsing/sites': {
      sites: [
        { site: 'bizbuysell.com', visits: 140, days: 22, last: z(31, 2), titles: ['Car wash'] },
        { site: 'docs.example.org', visits: 9, days: 3, last: z(30, 2), titles: [] },
      ],
    },
    'browsing/visits': {
      visits: [
        { at: z(20, 1), site: 'bizbuysell.com', title: 'Car wash for sale' },
        { at: z(20, 1, 10), site: 'bizbuysell.com', title: 'Laundromat for sale' },
        { at: z(20, 2), site: 'docs.example.org', title: 'Harbor model' },
        { at: z(21, 1), site: 'bizbuysell.com', title: 'Car wash for sale' },
      ],
    },
    'apps/apps': { apps: [{ name: 'Microsoft Excel', hoursWeek: 4.2, launches: 40 }] },
    'apps/spans': {
      spans: [
        { app: 'Mail', start: z(20, 0, 30), end: z(20, 1, 15) },
        { app: 'Microsoft Excel', start: z(20, 1, 20), end: z(20, 2, 20) },
        { app: 'Microsoft Excel', start: z(20, 2, 21), end: z(20, 2, 30) },
        { app: 'Mail', start: z(20, 2, 35), end: z(20, 2, 50) },
      ],
    },
    'filenames/files': {
      tree: [{ folder: 'documents', path: 'Deals/Harbor', files: 3, kinds: { pdf: 2, docx: 1 } }],
      recent: [{ folder: 'documents', path: 'Deals/Harbor/LOI draft.docx', modified: z(30, 2) }],
    },
    'filenames/names': {
      names: [
        {
          folder: 'documents',
          path: 'Deals/Harbor/LOI draft.docx',
          kind: 'docx',
          modified: z(20, 3),
        },
        ...[41, 42, 43].map((n) => ({
          folder: 'documents',
          path: `Invoices/Invoice_00${n}.pdf`,
          kind: 'pdf',
          modified: z(n - 30, 9),
        })),
        { folder: 'downloads', path: 'CIM Car Wash.pdf', kind: 'pdf', modified: z(20, 1, 15) },
      ],
    },
    'filenames/downloads': {
      downloads: [{ name: 'CIM Car Wash.pdf', sites: ['bizbuysell.com'], at: z(20, 1, 15) }],
    },
  }
  const host: PluginHost = {
    name: 'onboarding',
    dir,
    person: () => ({ name: 'Kenil Shah', region: 'SG', zone: 'Asia/Singapore', language: 'en' }),
    catalogue: () => ({
      modules: [
        {
          name: 'DealPilot',
          installed: true,
          case: { for: 'deals', keeps: 'listings', decides: 'what to buy' },
        },
        { name: 'About you', installed: true, case: null },
      ],
      connectors: [
        { name: 'outlook', title: 'Outlook', connected: false, private: false },
        { name: 'browsing', title: 'Browsing history', connected: true, private: true },
        { name: 'calendar', title: 'Calendar', connected: true, private: false },
      ],
    }),
    people: () => [{ name: 'Priya Shah', company: 'Harbor', contact: 5, last: z(21, 4) }],
    rows: (m, t) => tables[`${m}/${t}`] ?? [],
    // the never-use list as the core answers it, cut down to what these rows need
    never: (words) => /\b(bank|therapy)\b/i.test(words),
    connectorTool: async (connector, tool) => {
      const out = reads[`${connector}/${tool}`]
      if (!connected || !out) throw new Error('not connected')
      return out
    },
    ask: async () => {
      throw new Error('onboarding asks nothing without its tools')
    },
    // as the core does: each call given its id as it starts, every one kept with what it got
    explore: async (_system, prompt, tools: PluginTool[]) => {
      prompts.push(prompt)
      const calls: { id: string; tool: string; input: unknown; output: unknown }[] = []
      const use: Use = async (name, input = {}) => {
        const t = tools.find((x) => x.name === name)
        if (!t) throw new Error(`no tool ${name}`)
        const id = `t${calls.length + 1}`
        const output = await t.run(input)
        calls.push({ id, tool: name, input, output })
        return output
      }
      return { answer: await model(use, prompt), calls }
    },
    own: {
      add: (_t, rows) =>
        rows.map((r) => {
          const id = `a${next++}`
          own.set(id, { id, values: r.values })
          return id
        }),
      set: (_t, id, values) => {
        const r = own.get(id)
        if (r) own.set(id, { id, values: { ...r.values, ...values } })
      },
      rows: () => [...own.values()],
    },
    route: (method, path, fn) => routes.set(`${method} ${path}`, fn),
    startBlock: (w) => starts.push(w),
    journal: (words) => lines.push(words),
  }
  register(host)
  const call = (route: string, body: unknown = {}, params: Record<string, string> = {}) => {
    const fn = routes.get(route)
    if (!fn) throw new Error(`no route ${route}`)
    return fn({ params, query: {}, body })
  }
  // the session runs on after Look answers: until it is done
  const settled = async () => {
    let run: Run | null = null
    await vi.waitFor(async () => {
      run = (await call('GET /run')) as Run
      expect(run.state).not.toBe('looking')
    })
    return run as unknown as Run
  }
  return { host, own, call, settled, starts, lines, prompts }
}

describe('the overview', () => {
  it('holds every part as lines with ids, counted, and nothing raw', async () => {
    const { host } = made()
    const s = await buildSummary(host, 'About you')
    expect(s.text).toContain('[P1] Kenil Shah; region SG; time zone Asia/Singapore; language en.')
    expect(s.text).toMatch(/\[C\d+\] Met Priya Shah in 2 meetings\./)
    expect(s.text).toMatch(/\[C\d+\] "Pipeline review" comes back: 3 times\./)
    expect(s.text).toContain('Their own card: Kenil Shah, Founder, Bridge.')
    expect(s.text).toContain('Harbor: 2 contacts.')
    expect(s.text).toContain('Wrote to priya@harbor.example 2 times.')
    expect(s.text).toMatch(/\[B1\] bizbuysell\.com: 140 visits on 22 days, last 31 Oct 2026/)
    expect(s.text).toMatch(/\[A1\] Microsoft Excel; 4\.2 hours a week; opened 40 times\./)
    expect(s.text).toContain('Documents/Deals/Harbor: 3 files (pdf 2, docx 1).')
    expect(s.text).toContain(
      'Module DealPilot (installed): for deals; keeps listings; decides what to buy.',
    )
    // its own module is not on offer; nothing a received message holds goes in
    expect(s.text).not.toContain('Module About you')
    expect(s.text).not.toContain('123456789')
    // a message or a meeting touching the never-use list is not read at all
    expect(s.counts).toEqual({ meetings: 3, contacts: 3, mail: 4, sites: 2, apps: 1, files: 3 })
    expect(s.text).not.toMatch(/bank|therapy/i)
  })

  it('says a part was not read where its connector is not connected', async () => {
    const { host } = made(none, false)
    expect((await buildSummary(host, 'About you')).text).toContain(
      '[B1] Browsing history: nothing read (not connected).',
    )
  })
})

describe('the closer look’s tools', () => {
  const tools = async (connected = true) => {
    const { host } = made(none, connected)
    const all = toolsOf(await readSources(host), host)
    const run = (name: string, input: Record<string, unknown> = {}) =>
      all.find((t) => t.name === name)?.run(input) as Promise<Record<string, unknown>>
    return { all, run }
  }

  it('are read-only, the same eight every time', async () => {
    expect((await tools()).all.map((t) => t.name)).toEqual([
      'day',
      'sites',
      'apps',
      'files',
      'mail',
      'calendar',
      'contacts',
      'search',
    ])
  })

  it('lay a day out in the person’s own time, every source in order', async () => {
    const { run } = await tools()
    const days = (await run('day')).days as { day: string }[]
    expect(days.map((d) => d.day)).toEqual([
      '2026-10-22',
      '2026-10-21',
      '2026-10-20',
      '2026-10-13',
      '2026-10-12',
      '2026-10-11',
    ])
    expect(days[2]).toMatchObject({ weekday: 'Tue', visits: 3, received: 1, sent: 1 })
    const items = (await run('day', { date: '2026-10-20' })).items as Record<string, unknown>[]
    expect(
      items.map((i) => [
        i.at,
        i.app ?? i.site ?? i.meeting ?? i.mail ?? i.fileChanged ?? i.downloaded,
      ]),
    ).toEqual([
      ['08:00', 'received'],
      ['08:30', 'Mail'],
      ['09:00', 'bizbuysell.com'],
      ['09:15', 'downloads/CIM Car Wash.pdf'],
      ['09:15', 'CIM Car Wash.pdf'],
      ['09:20', 'Microsoft Excel'],
      ['10:00', 'docs.example.org'],
      ['10:00', 'Pipeline review'],
      ['10:35', 'Mail'],
      ['11:00', 'documents/Deals/Harbor/LOI draft.docx'],
      ['12:00', 'sent'],
    ])
    // two visits on one site, one after another, are one time on it; Excel's two spans are one
    expect(items[2]).toMatchObject({
      visits: 2,
      titles: ['Car wash for sale', 'Laundromat for sale'],
    })
    expect(items[5]).toMatchObject({ until: '10:30', minutes: 70 })
  })

  it('show a site’s pages, when, and what was downloaded from it', async () => {
    const { run } = await tools()
    expect(await run('sites', { site: 'www.bizbuysell.com' })).toMatchObject({
      visits: 3,
      days: 2,
      weekdays: { Tue: 2, Wed: 1 },
      hours: { '09': 3 },
      titles: [
        { title: 'Car wash for sale', visits: 2, last: '2026-10-21' },
        { title: 'Laundromat for sale', visits: 1 },
      ],
      downloads: [{ name: 'CIM Car Wash.pdf', day: '2026-10-20' }],
    })
    expect(await run('sites', { words: 'harbor' })).toEqual({
      pages: [
        { site: 'docs.example.org', title: 'Harbor model', visits: 1, days: 1, last: '2026-10-20' },
      ],
    })
  })

  it('show what comes before and after an app', async () => {
    const { run } = await tools()
    expect(await run('apps', { app: 'microsoft excel' })).toMatchObject({
      times: 1,
      usualMinutes: 70,
      before: [{ app: 'Mail', times: 1 }],
      after: [{ app: 'Mail', times: 1 }],
    })
    expect(appRuns([])).toEqual([])
  })

  it('find the series made again and again, and a folder’s names with where downloads came from', async () => {
    const { run } = await tools()
    expect(shapeOf('Report Oct 2026.xlsx')).toBe('Report <month> #.xlsx')
    expect((await run('files')).series).toEqual([
      {
        pattern: 'documents/Invoices/Invoice_#.pdf',
        names: 3,
        first: '2026-10-11',
        last: '2026-10-13',
        like: ['Invoice_0043.pdf', 'Invoice_0042.pdf', 'Invoice_0041.pdf'],
      },
    ])
    expect(seriesOf([])).toEqual([])
    expect(await run('files', { folder: 'Downloads' })).toEqual({
      folder: 'downloads',
      names: [
        { name: 'CIM Car Wash.pdf', kind: 'pdf', changed: '2026-10-20', from: ['bizbuysell.com'] },
      ],
      folders: [],
    })
  })

  it('count mail by its headers alone: automated senders, what comes back, nothing on the never-use list', async () => {
    const { run } = await tools()
    const m = await run('mail')
    expect(m.senders).toEqual([
      { from: 'BizBuySell', domain: 'bizbuysell.com', messages: 2, automated: true },
    ])
    expect(m.youWriteTo).toEqual([{ address: 'priya@harbor.example', messages: 2 }])
    expect(m.subjectsThatComeBack).toEqual([
      { subject: 'Harbor deal: next steps', messages: 2, sent: 2, last: '2026-10-21' },
      { subject: 'New listings: # car washes', messages: 2, sent: 0, last: '2026-10-21' },
    ])
    expect((await run('mail', { who: 'bank' })).messages).toEqual([])
    expect((await run('calendar', { words: 'therapy' })).meetings).toEqual([])
    expect(JSON.stringify(await run('search', { words: 'statement' }))).not.toMatch(/statement/i)
  })

  it('count meetings and contacts, never a phone number, and search everything', async () => {
    const { run } = await tools()
    expect(await run('calendar')).toMatchObject({
      comeBack: [
        {
          title: 'Pipeline review',
          times: 3,
          usualTime: '10:00',
          with: ['Priya Shah', 'Marco Ruiz'],
        },
      ],
    })
    const c = await run('contacts')
    expect(JSON.stringify(c)).not.toMatch(/9123|priya@/)
    expect(c).toMatchObject({
      yourCard: { name: 'Kenil Shah', company: 'Bridge', title: 'Founder' },
      companies: [{ company: 'Harbor', contacts: 2 }],
      dealtWithMost: [{ name: 'Priya Shah', contact: 5 }],
    })
    const found = await run('search', { words: 'harbor' })
    expect(
      [found.pages, found.files, found.mail, found.contacts].map((x) => (x as unknown[]).length),
    ).toEqual([1, 1, 2, 2])
  })

  it('say what was not read where a connector is not connected', async () => {
    const { run } = await tools(false)
    expect(await run('sites')).toEqual({ browsing: 'not read: not connected' })
    expect(await run('files')).toEqual({ fileNames: 'not read: not connected' })
  })
})

describe('the checks on the answer', () => {
  const read = {
    text: '[B1] bizbuysell.com: 140 visits\n{"names":[{"name":"documents/LOI draft.docx"}]}',
    ids: ['B1', 'T1', 't1', 't2'],
  }
  const can = { modules: ['DealPilot'], connectors: ['outlook'] }

  it('keep what was read backs, however much, and drop the rest with why', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      line: `You look at listings, ${i}`,
      from: ['B1'],
      sure: 'likely',
    }))
    const out = check(
      {
        about: [
          ...many,
          { line: 'You invented this', from: ['Z9'], sure: 'likely' },
          { line: 'You bank at chase.com', from: ['t1'], sure: 'guess' },
          { line: 'You keep an LOI draft.docx', from: ['[t2]'], sure: 'guess' },
          { line: 'You dropped this before.', from: ['B1'], sure: 'guess' },
        ],
        routines: [
          {
            what: 'You check new listings each morning',
            evidence: 'bizbuysell.com at 09:00 on most days',
            alpha: 'yes',
            how: 'A daily reader',
            from: ['t1'],
          },
          { what: 'You pay rent', evidence: 'none', alpha: 'no', how: '', from: [] },
        ],
        suggestions: [
          { kind: 'kit', name: 'DealPilot', words: 'Track deals', why: 'listings', from: ['B1'] },
          { kind: 'kit', name: 'Nowhere', words: 'A kit Alpha has not', why: 'x', from: ['B1'] },
          {
            kind: 'connector',
            name: 'outlook',
            words: 'Connect Outlook',
            why: 'mail',
            from: ['T1'],
          },
          { kind: 'build', name: null, words: 'Track it', why: 'none', from: [] },
        ],
        questions: [
          { question: 'Do you buy for yourself or a fund?', why: 'deals', from: ['B1'] },
          { question: 'Who is at acme.example?', why: 'x', from: ['t1'] },
        ],
      },
      read,
      can,
      { lines: ['you dropped this before'], declined: ['Track deals!'], asked: [] },
    )
    // no cap of ours: all fourteen kept
    expect(out.about.map((a) => a.line)).toEqual([
      ...many.map((m) => m.line),
      'You keep an LOI draft.docx',
    ])
    expect(out.routines.map((r) => [r.what, r.alpha])).toEqual([
      ['You check new listings each morning', 'yes'],
    ])
    expect(out.suggestions.map((s) => s.words)).toEqual(['Connect Outlook'])
    expect(out.questions.map((q) => q.question)).toEqual(['Do you buy for yourself or a fund?'])
    expect(out.dropped.map((d) => d.why)).toEqual([
      'it cites nothing that was read',
      'it names chase.com, which nothing read holds',
      'it was proposed before',
      'it cites nothing that was read',
      'it was declined before',
      'Nowhere is not one Alpha can set up',
      'it cites nothing that was read',
      'it names acme.example, which nothing read holds',
    ])
    // a question answered once is never asked again
    expect(
      check(
        {
          questions: [{ question: 'Do you buy for yourself or a fund?', why: 'x', from: ['B1'] }],
        },
        read,
        can,
        { lines: [], asked: ['Do you buy for yourself, or a fund?'] },
      ).dropped,
    ).toEqual([{ what: 'Do you buy for yourself or a fund?', why: 'it was answered before' }])
    expect(fromWords(['B1', 't1', 't2', 'F2'], { t1: 'day', t2: 'files' })).toBe(
      'Browsing, Your days, File names',
    )
  })
})

describe('onboarding through its host', () => {
  it('looks closer, proposes its lines, takes an answer, and keeps only what the person keeps', async () => {
    const { call, own, settled, starts, lines, prompts } = made(async (use) => {
      await use('day', { date: '2026-10-20' })
      await use('files')
      return {
        about: [
          {
            line: 'You look at small businesses for sale most days',
            from: ['B1', 't1'],
            sure: 'likely',
          },
          { line: 'You work with Priya Shah at Harbor', from: ['C2', 'M2'], sure: 'likely' },
          { line: 'You spend hours in Excel', from: ['A1'], sure: 'guess' },
        ],
        routines: [
          {
            what: 'You number your invoices by hand',
            evidence: 'Invoice_#.pdf three times in October',
            alpha: 'partly',
            how: 'Alpha could keep the numbers',
            from: ['t2'],
          },
        ],
        suggestions: [
          {
            kind: 'kit',
            name: 'DealPilot',
            words: 'Track the deals',
            why: 'listings',
            from: ['B1'],
          },
        ],
        questions: [{ question: 'Do you buy for yourself or a fund?', why: 'deals', from: ['B1'] }],
      }
    })
    const run = (await call('POST /look')) as Run
    expect(run.state).toBe('looking')
    expect(lines[0]).toMatch(
      /^Started getting to know the person from 3 meetings, 3 contacts, 4 messages/,
    )
    // one session at a time
    await expect(call('POST /look')).rejects.toThrow(/already/)
    const done = await settled()
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain(`# Overview\n\n${run.overview}`)
    // every look kept with what it got: Show the work
    expect(done.calls.map((c) => [c.id, c.tool])).toEqual([
      ['t1', 'day'],
      ['t2', 'files'],
    ])
    expect(done.checked?.routines).toHaveLength(1)
    expect(lines.at(-1)).toBe(
      'Looked closer 2 times, then wrote 3 lines about the person, 1 routine, 1 suggestion and 1 question; left out 0 nothing read backed.',
    )
    const rows = [...own.values()]
    expect(rows.map((r) => [r.values.State, r.values.Sure, r.values.From])).toEqual([
      ['Proposed', 'Likely', 'Browsing, Your days'],
      ['Proposed', 'Likely', 'Calendar, Mail'],
      ['Proposed', 'Guess', 'Apps'],
    ])
    // nothing kept starts a conversation until the person keeps it
    expect(starts.map((s) => s())).toEqual([null])
    const [a, b, c] = rows.map((r) => r.id) as [string, string, string]
    await call('POST /about/:id/keep', {}, { id: a })
    await call('POST /about/:id/edit', { line: 'You buy small businesses' }, { id: b })
    await call('POST /about/:id/drop', {}, { id: c })
    // a question answered is the person's own line, kept
    await call('POST /answer', { run: run.id, question: 0, answer: 'For myself.' })
    await expect(call('POST /answer', { run: run.id, question: 3, answer: 'x' })).rejects.toThrow(
      /not here any more/,
    )
    expect(starts[0]?.()).toBe(
      [
        '## About the person (they kept these)',
        '- You look at small businesses for sale most days',
        '- You buy small businesses',
        '- Do you buy for yourself or a fund? For myself.',
      ].join('\n'),
    )
    expect(((await call('GET /run')) as Run).answered).toEqual({ '0': 'For myself.' })
    // the sources Start lists, Home's row, Add and Decline
    expect(((await call('GET /sources')) as { name: string }[]).map((x) => x.name)).toEqual([
      'calendar',
      'outlook',
      'browsing',
    ])
    expect(await call('GET /home')).toEqual({
      state: 'waiting',
      waits: { lines: 0, questions: 0, routines: 1, suggestions: 1 },
    })
    await call('POST /decide', { run: run.id, kind: 'routine', at: 0, decision: 'added' })
    await call('POST /decide', { run: run.id, kind: 'suggestion', at: 0, decision: 'declined' })
    await expect(
      call('POST /decide', { run: run.id, kind: 'suggestion', at: 5, decision: 'added' }),
    ).rejects.toThrow(/not here any more/)
    expect(((await call('GET /home')) as { state: string }).state).toBe('done')
    // Forget deletes everything that was sent
    await call('POST /forget', { run: run.id })
    expect(await call('GET /run')).toBeNull()
  })

  it('never proposes a line again, and says it when the session fails', async () => {
    let fail = false
    const { call, settled, lines } = made(async () => {
      if (fail) throw new Error('The model did not settle on an answer in the turns it had.')
      return {
        about: [{ line: 'You are in Singapore', from: ['P1'], sure: 'likely' }],
        routines: [],
        suggestions: [],
        questions: [],
      }
    })
    await call('POST /look')
    await settled()
    await call('POST /look')
    const again = await settled()
    expect(again.checked?.about).toEqual([])
    expect(again.checked?.dropped).toEqual([
      { what: 'You are in Singapore', why: 'it was proposed before' },
    ])
    fail = true
    await call('POST /look')
    expect(await settled()).toMatchObject({
      state: 'failed',
      problem: 'The model did not settle on an answer in the turns it had.',
    })
    expect(lines.at(-1)).toBe(
      'Could not finish getting to know the person: The model did not settle on an answer in the turns it had.',
    )
  })
})
