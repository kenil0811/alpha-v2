// The interviews plugin (plugins/interviews) as an Alpha with it switched on starts it: it loads
// from this repository's plugins folder, and its kit makes Your work with the Interviewer in it.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Connector } from '@alpha/connector-sdk'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { landIn } from '../connectors/places.ts'
import { ScheduleRunner } from '../modules/runs/runner.ts'
import { schedules } from '../modules/schedules.ts'
import { one } from '../world/db.ts'
import { World } from '../world/world.ts'
import { switchOn } from './plugins.ts'

let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-interviews-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

it('loads where alpha.yaml names it, and its kit makes Your work with the Interviewer', async () => {
  const user = world.owner('Kenil')
  // a client's module already holding a table called Sources, as Deal pilot does
  landIn(world, {
    manifest: { name: 'deals', title: 'Deals' },
    module: 'Deal pilot',
    tables: [{ name: 'Sources', fields: [{ name: 'Name', kind: 'text' }] }],
  } as unknown as Connector)
  const { plugins, problems } = await switchOn(['interviews'], {
    world,
    user,
    home,
    region: () => null,
    ask: async () => ({ answer: null }),
    connectors: null,
  })
  expect(problems).toEqual([])
  expect(plugins.on()).toEqual(['interviews'])
  await plugins.keepKits({ actor: { kind: 'system' }, user: user.id })
  const m = world.shape.ownModule('Your work')
  expect(world.shape.tables(m?.id).map((t) => t.name)).toEqual([
    'Workflows',
    'Steps',
    'Proposals',
    'About you',
    'Questions',
    'Interview sources',
  ])
  expect(one(world.db, 'SELECT plugin FROM kits WHERE module_id = ?', m?.id ?? '')).toEqual({
    plugin: 'interviews',
  })
  const interviewer = world.agents.list().find((a) => a.name === 'Interviewer')
  expect(interviewer?.title).toBe('Learns how you work and what would help')
  expect(interviewer?.source).toBe(m?.id)
  // its regular check, on: it wakes the Interviewer only when something changed
  expect(
    schedules(world)
      .filter((x) => x.agent === interviewer?.id)
      .map((x) => [x.name, x.state]),
  ).toEqual([['A short interview', 'on']])
})

const MAIL = {
  manifest: { name: 'gmail', title: 'Gmail' },
  module: 'Mail',
  tables: [
    {
      name: 'Mail',
      fields: [
        { name: 'From', kind: 'text' },
        { name: 'Subject', kind: 'text' },
        { name: 'Date', kind: 'date' },
      ],
    },
  ],
} as unknown as Connector

it('adds Get to know you and What I learned to Set up Alpha: reads what is left on, drafts once, asks the blanks as a set', async () => {
  const user = world.owner('Kenil')
  const prompts: string[] = []
  // the model, stood in for: each draft as the person's answers so far make it
  const ask = async (_system: string, prompt: string) => {
    prompts.push(prompt)
    const rows = [...prompt.matchAll(/^(row \S+):/gm)].map((m) => m[1] as string)
    const answer = /^answer (\S+): asked .* they said/m.exec(prompt)?.[1]
    const quoting = {
      name: 'Writing quotes',
      shows: 'Three clients asked for a kitchen quote.',
      means: 'Each quote is written by hand.',
      times_rows: rows,
      rests_on: rows,
      steps: [{ what: 'Write the quote from the site notes', rests_on: rows }],
    }
    if (!answer)
      return {
        answer: {
          about: [
            { line: 'Writes kitchen quotes for clients.', for: 'me', rests_on: rows },
            { line: 'Works alone.', for: 'me', rests_on: [] }, // cites nothing: left out (I1)
          ],
          workflows: [{ ...quoting, proposal: null }],
          questions: [
            {
              words: 'Three clients asked for a quote: how long does each take you?',
              options: ['Under an hour', 'An hour or more'],
              workflow: 'Writing quotes',
              rests_on: rows,
            },
          ],
        },
      }
    return {
      answer: {
        about: [],
        workflows: [
          {
            ...quoting,
            minutes_answer: `answer ${answer}`,
            proposal: {
              kind: 'module',
              name: 'a quote tracker',
              does: 'Keeps each quote request and drafts the quote from the site notes.',
              rests_on: [...rows, `answer ${answer}`],
            },
          },
        ],
        questions: [],
      },
    }
  }
  const { plugins } = await switchOn(['interviews'], {
    world,
    user,
    home,
    region: () => null,
    ask,
    connectors: null,
  })
  await plugins.keepKits({ actor: { kind: 'system' }, user: user.id })
  landIn(world, MAIL)
  const mail = world.shape.ownModule('Mail')
  const t = mail && world.shape.ownTable(mail.id, 'Mail')
  if (!t) throw new Error('No Mail table.')
  world.records.land(
    t.id,
    [1, 2, 3].map((n) => ({
      key: `q${n}`,
      values: {
        From: `client${n}@example.com`,
        Subject: 'Quote for a kitchen',
        Date: new Date(Date.now() - n * 7 * 86_400_000).toISOString(),
      },
    })),
    { connector: 'gmail', account: 'sam@oak.example' },
    { actor: { kind: 'connector', id: 'gmail' } },
  )

  expect(plugins.chapters.map((c) => [c.key, c.after, c.who])).toEqual([
    ['know', 'connect', 'everyone'],
    ['learned', 'people', 'everyone'],
  ])
  const [know, learned] = plugins.chapters as [
    (typeof plugins.chapters)[number],
    (typeof plugins.chapters)[number],
  ]
  const person = { id: user.id, name: user.name, owner: true }
  const input = (body: unknown = {}) => ({ params: {}, query: {}, body, person })
  type Learned = {
    drafting: boolean
    question: { id: string; words: string } | null
    about: { id: string; line: string; decided: boolean }[]
    playbacks: { id: string; words: string; decided: boolean }[]
    workflows: { name: string; hours: number | null }[]
  }
  const settled = async (): Promise<Learned> => {
    for (let i = 0; i < 100; i++) {
      const v = (await learned.screen(input())) as unknown as Learned
      if (!v.drafting) return v
      await new Promise((ok) => setTimeout(ok, 20))
    }
    throw new Error('The draft never came.')
  }

  // one screen of every source, with how much there is; switched off, a source is never read
  const screen = (await know.screen(input())) as unknown as {
    sources: { key: string; has: string; available: boolean }[]
  }
  expect(screen.sources.find((s) => s.key === 'mail')).toMatchObject({ available: true })
  expect(screen.sources.find((s) => s.key === 'mail')?.has).toMatch(/3 mails/)
  expect(await know.act(input({ off: ['alpha'] }))).toEqual({ on: true })
  const sources = world.shape.ownTable(
    world.shape.ownModule('Your work')?.id ?? '',
    'Interview sources',
  )
  const states = world.records.list(sources?.id ?? '').map((r) =>
    Object.values(r.values)
      .filter((v) => typeof v === 'string')
      .slice(0, 2),
  )
  expect(states).toContainEqual(['Mail', 'Kenil'])
  // what each source found, as the person sees it: a line or two, with no ids
  const shown = (await know.screen(input())) as unknown as {
    found: { key: string; shown?: string[] }[]
  }
  const mailShown = shown.found.find((f) => f.key === 'mail')?.shown ?? []
  expect(mailShown[0]).toMatch(/^Most from: client\d@example\.com \(1\)/)
  expect(mailShown.join(' ')).not.toMatch(/row r_/)

  // one draft: the line that cites nothing left out, one blank asked, numbers from code
  let v = await settled()
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).not.toMatch(/## What you have in Alpha/)
  expect(v.about.map((a) => a.line)).toEqual(['Writes kitchen quotes for clients.'])
  expect(v.question?.words).toMatch(/how long/)
  expect(v.playbacks).toEqual([])

  // the set answered: the answers go back together, and the playback comes
  expect(
    await learned.act(input({ answer: { id: v.question?.id, choice: 'About 45 minutes each' } })),
  ).toEqual({ on: false })
  v = await settled()
  expect(prompts).toHaveLength(2)
  expect(v.question).toBeNull()
  expect(v.workflows[0]?.hours).toBe(0.8) // 3 in 90 days, 1 a month, by 45 minutes
  expect(v.playbacks[0]?.words).toMatch(/We'd build a quote tracker/)

  // About you kept here goes to How to work as theirs; nothing else does
  await learned.act(input({ about: { keep: 'rest', drop: [] } }))
  expect(world.lines({ kinds: ['remembered'] }).map((l) => l.words)).toEqual([
    'Will remember: Writes kitchen quotes for clients.',
  ])

  // Not this: written again, and the declined one never comes back (I4)
  await learned.act(input({ playback: { id: v.playbacks[0]?.id, choice: 'Not this' } }))
  v = await settled()
  expect(prompts).toHaveLength(3)
  expect(v.playbacks.filter((p) => !p.decided)).toEqual([])
  expect(await learned.act(input())).toEqual({ on: true })
})

it('lets the readers that come with it make their tables in Your work, which Alpha manages', async () => {
  const user = world.owner('Kenil')
  const { plugins } = await switchOn(['interviews'], {
    world,
    user,
    home,
    region: () => null,
    ask: async () => ({ answer: null }),
    connectors: null,
  })
  await plugins.keepKits({ actor: { kind: 'system' }, user: user.id })
  const reader = (plugin?: string) =>
    ({
      manifest: { name: 'browsing', title: 'Browsing', ...(plugin ? { plugin } : {}) },
      module: 'Your work',
      tables: [{ name: 'Sites', fields: [{ name: 'Site', kind: 'text' }] }],
    }) as unknown as Connector
  // a connector of anyone else's is turned away as every door is (rules M2)
  expect(() => landIn(world, reader())).toThrow(/managed by Alpha/)
  const [sites] = landIn(world, reader('interviews'))
  const m = world.shape.ownModule('Your work')
  expect([sites?.name, sites?.module.id, sites?.mirror]).toEqual(['Sites', m?.id, 'Browsing'])
})

it('looks each month, waking the Interviewer only when something changed', async () => {
  // the check as its schedule runs it, given a made-up month: a file outside this package, by path
  const at = join(import.meta.dirname, '..', '..', '..', 'plugins', 'interviews', 'kit', 'agents')
  const check = (await import(join(at, 'interviewer', 'checks', 'a-short-interview', 'check.js')))
    .default as (alpha: unknown) => Promise<{ wake: boolean; found?: { again: unknown[] } }>
  const month = (said: string[], wrote = 0) => ({
    input: { lastRun: '2026-10-01T00:00:00Z' },
    journal: {
      list: async () => [
        ...said.map((words, i) => ({ id: i, who: 'person u_1', kind: 'said', words })),
        ...Array.from({ length: wrote }, (_, i) => ({
          id: 100 + i,
          who: 'person u_1',
          kind: 'wrote',
          words: 'Set Total',
        })),
        { id: 200, who: 'alpha ag_1', kind: 'said', words: 'not theirs' },
      ],
    },
    rows: { list: async () => [] },
  })
  expect(await check(month(['What is on today?']))).toEqual({ wake: false })
  const again = await check(month(Array(3).fill('Draft the weekly invoice for Lakeside')))
  expect(again.wake).toBe(true)
  expect(again.found?.again).toEqual([
    { request: 'draft the weekly invoice for lakeside', times: 3 },
  ])
  expect((await check(month([], 3))).wake).toBe(true)
})

it('runs its regular check a month on and, with nothing new, wakes no one', async () => {
  const user = world.owner('Kenil')
  const { plugins } = await switchOn(['interviews'], {
    world,
    user,
    home,
    region: () => null,
    ask: async () => ({ answer: null }),
    connectors: null,
  })
  await plugins.keepKits({ actor: { kind: 'system' }, user: user.id })
  const runner = new ScheduleRunner(
    world,
    () => {
      throw new Error('No browser here.')
    },
    { owner: user.id },
  )
  await runner.runDue(Date.now() + 31 * 86_400_000)
  expect(runner.runs(5).map((r) => r.words)).toEqual(['Nothing new.'])
  expect(world.tasks.list().filter((t) => t.title === 'A short interview')).toEqual([])
})
