// Alpha's workspace skills (30 Oct): Research, Governance and the Builder, used from two modules'
// agents through the kit API and from the desk, with a made-up model and a made-up web. No model
// is called and nothing leaves the machine.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { skillTools } from '../engine/tools/skills.ts'
import type { Ask } from '../files/reading.ts'
import { run as exec, newId } from '../world/db.ts'
import type { Module } from '../world/shape/index.ts'
import { businessCase } from '../world/shape/manifest.ts'
import { World } from '../world/world.ts'
import { agents, syncAgents } from './agents.ts'
import { BUILD, type BuildInput, build } from './builder.ts'
import { DEFAULT_KITS, keepDefaults } from './defaults.ts'
import { saveOnCard, walls } from './governance.ts'
import type { Web } from './research.ts'
import { AgentRunner } from './runs/index.ts'

let home: string
let world: World
let clinic: Module
let shop: Module
let runner: AgentRunner
const alpha = { kind: 'alpha' as const }

// the web: two results a search, a page each; one cited page that no longer resolves
const web: Web = {
  search: async (q) => [
    { title: `${q} one`, url: 'https://open.example/tool' },
    { title: `${q} two`, url: 'https://rival.example/' },
  ],
  open: async (url) => ({ url, title: url, text: `About ${url}.` }),
  resolves: async (url) => url === 'https://practice.example/guide',
}
const asked: string[] = []
const model: Ask = async (prompt) => {
  asked.push(prompt)
  if (prompt.startsWith('Step 1, plan'))
    return { answer: { searches: ['booking software', 'open source booking'] }, tokens: 5 }
  if (prompt.startsWith('Step 2, brief'))
    return {
      answer: {
        lines: [
          {
            kind: 'competitor',
            name: 'Rival',
            line: 'Books and reminds.',
            impact: 3,
            reach: 3,
            effort: 3,
            sources: ['https://rival.example/'],
          },
          {
            kind: 'open_source',
            name: 'OpenTool',
            line: 'Self-hosted booking.',
            licence: 'MIT',
            use: 'reuse',
            impact: 5,
            reach: 4,
            effort: 2,
            sources: ['https://open.example/tool'],
          },
          {
            kind: 'practice',
            name: 'Reminders',
            line: 'A text the day before.',
            impact: 4,
            reach: 5,
            effort: 1,
            sources: ['https://practice.example/guide'],
          },
          {
            kind: 'practice',
            name: 'Made up',
            line: 'Cited nowhere real.',
            impact: 5,
            reach: 5,
            effort: 1,
            sources: ['https://gone.example/x'],
          },
        ],
      },
      tokens: 7,
    }
  return {
    answer: { plain: 'It may only change its own tables.', fix: 'Add Orders to its file.' },
    tokens: 3,
  }
}

function withAgent(m: Module, name: string, script: string, front = ''): void {
  mkdirSync(join(m.dir, 'agents'), { recursive: true })
  mkdirSync(join(m.dir, 'skills'), { recursive: true })
  writeFileSync(join(m.dir, `skills/${name}.js`), script)
  writeFileSync(
    join(m.dir, `agents/${name}.md`),
    `---\nname: ${name}\ntrigger: { every: day, at: "06:00" }\nruns: { script: skills/${name}.js }\n${front}---\nA test agent.\n`,
  )
  syncAgents(world, m, 'on')
}
const agentOf = (m: Module, name: string) =>
  agents(world, m.id).find((a) => a.name === name) as never

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-skills-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  const me = world.owner('Kenil')
  await keepDefaults(world, { actor: { kind: 'system' }, user: me.id }, DEFAULT_KITS)
  clinic = world.shape.makeModule('Clinic', { actor: alpha })
  world.shape.makeTable(clinic.id, 'Patients', [{ name: 'Name', kind: 'text', about: 'Who.' }], {
    actor: alpha,
  })
  shop = world.shape.makeModule('Shop', { actor: alpha })
  world.shape.makeTable(shop.id, 'Orders', [{ name: 'Item', kind: 'text', about: 'What.' }], {
    actor: alpha,
  })
  runner = new AgentRunner(world, () => ({}) as BrowserEngine, { owner: me.id, ask: model, web })
  asked.length = 0
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('Research, from any module', { timeout: 60_000 }, () => {
  it('gives two modules a brief ranked by value, every line cited by a source that resolves', async () => {
    const script =
      'export default async (alpha) => alpha.research({ ask: "How do others book clients?" })'
    withAgent(clinic, 'Scout', script)
    withAgent(shop, 'Scout2', script)
    for (const [m, n] of [
      [clinic, 'Scout'],
      [shop, 'Scout2'],
    ] as const) {
      const out = await runner.runAgent(agentOf(m, n))
      expect(out.state).toBe('ok')
      const r = out.result as { lines: { name: string; value: number }[]; dropped: number }
      expect(r.lines.map((l) => [l.name, l.value])).toEqual([
        ['Reminders', 20],
        ['OpenTool', 10],
        ['Rival', 3],
      ])
      expect(r.dropped).toBe(1)
    }
    expect(asked.filter((p) => p.startsWith('Step 1')).length).toBe(2)
  })

  it('is refused to an agent whose file names other effects', async () => {
    withAgent(
      shop,
      'Mailer',
      'export default async (alpha) => alpha.research({ ask: "x" })',
      'effects: [draft.email]\n',
    )
    const out = await runner.runAgent(agentOf(shop, 'Mailer'))
    expect(out.state).toBe('failed')
    expect(out.words).toMatch(/may not research/)
  })
})

describe('the Builder, from any module', { timeout: 60_000 }, () => {
  const propose = (extra: string) =>
    `export default async (alpha) => alpha.builder.propose({ ask: "Track deliveries", ${extra} })`
  it('refuses without the business case, and outside the agent’s own module', async () => {
    withAgent(shop, 'NoCase', propose('changes: [{ action: "add_fields", table: "Orders" }]'))
    const a = await runner.runAgent(agentOf(shop, 'NoCase'))
    expect(a.words).toMatch(/no business case yet/)
    withAgent(
      shop,
      'Reach',
      propose(
        'case: { for: "me", keeps: "x", decides: "y" }, exact: true, changes: [{ action: "add_fields", table: "Patients", fields: [{ name: "Age", kind: "number", about: "Years." }] }]',
      ),
    )
    const b = await runner.runAgent(agentOf(shop, 'Reach'))
    expect(b.words).toMatch(/proposes changes to Shop only/)
  })

  it('researches an ask that is not exact, proposes on one card, and builds only on the yes', async () => {
    withAgent(
      shop,
      'Builder',
      propose(
        'case: { for: "the owner", keeps: "deliveries", decides: "when to chase a courier" }, changes: [{ action: "add_fields", table: "Orders", fields: [{ name: "Shipped", kind: "date", about: "When it left." }] }]',
      ),
    )
    const out = await runner.runAgent(agentOf(shop, 'Builder'))
    expect(out.state).toBe('ok')
    const card = world.cards.waiting().find((c) => c.call?.tool === BUILD)
    expect(card?.options).toEqual(['Build it', 'Not now'])
    expect(card?.detail).toMatch(/Research on “Track deliveries”/)
    const orders = () => world.shape.table('Orders')?.fields.map((f) => f.name) ?? []
    expect(orders()).not.toContain('Shipped')
    const said = await build(world, card?.call?.input as unknown as BuildInput, {
      actor: { kind: 'person', id: world.owner().id },
      user: world.owner().id,
    })
    expect(said).toMatch(/^Built:/)
    expect(orders()).toContain('Shipped')
    expect(businessCase(shop)?.for).toBe('the owner')
  })
})

describe('Governance, from any module', { timeout: 60_000 }, () => {
  const infer = (m: Module) =>
    world.rules.infer(
      { side: 'deny', module: m.id, agent: null, covers: { does: ['send'] }, said: null },
      [],
      { actor: alpha },
    )
  it('puts each module’s noticed rule on its Save card, its own only, and the Save approves it', async () => {
    const rc = infer(clinic)
    const rs = infer(shop)
    withAgent(shop, 'Steward', 'export default async (alpha) => alpha.governance.review()')
    await runner.runAgent(agentOf(shop, 'Steward'))
    const noticed = () =>
      world.cards.waiting().map((c) => (c.call?.input as { noticed?: string })?.noticed)
    expect(noticed()).toEqual([rs.id])
    // from Clinic's thread at the desk: Clinic's own
    const [, governance] = skillTools({
      world,
      here: {
        current: {
          user: world.owner(),
          turn: null,
          said: null,
          message: null,
          from: { id: clinic.id, name: 'Clinic' },
        },
        fromSubagent: false,
        touched: new Set(),
      },
      hands: { runner, browser: () => ({}) as BrowserEngine },
      ctx: () => ({ actor: alpha, user: world.owner().id, turn: null, said: null }),
    })
    await governance?.handler({ action: 'review' })
    expect(noticed().sort()).toEqual([rc.id, rs.id].sort())
    // never approved by the skill; the person's Save approves the rule itself, made once
    expect(world.rules.get(rs.id)?.kind).toBe('inferred')
    const card = world.cards
      .waiting()
      .find((c) => (c.call?.input as { noticed?: string } | undefined)?.noticed === rs.id)
    saveOnCard(world, card?.call?.input, {
      actor: { kind: 'person', id: world.owner().id },
      user: world.owner().id,
      card: card?.id ?? '',
    })
    expect(world.rules.get(rs.id)?.kind).toBe('approved')
    expect(world.rules.list().length).toBe(2)
  })

  it('names an agent that keeps hitting a wall, and explains a refusal in plain words', async () => {
    withAgent(clinic, 'Walled', 'export default async () => ({ words: "ok" })')
    const a = agents(world, clinic.id).find((x) => x.name === 'Walled')
    for (let i = 0; i < 3; i++) {
      const run = newId('r')
      exec(
        world.db,
        "INSERT INTO runs (id, agent_id, module_id, started_at, state, data) VALUES (?, ?, ?, ?, 'ok', '{}')",
        run,
        a?.id ?? '',
        clinic.id,
        new Date().toISOString(),
      )
      world.line({
        actor: { kind: 'agent', id: 'Walled' },
        kind: 'run_step',
        words: 'Refused: Walled does not touch Orders.',
        run,
        module: clinic.id,
      })
    }
    expect(walls(world).map((w) => [w.agent, w.runs])).toEqual([['Walled', 3]])
    withAgent(
      clinic,
      'Explainer',
      'export default async (alpha) => alpha.governance.explain({ refusal: "Walled does not touch Orders." })',
    )
    const out = await runner.runAgent(agentOf(clinic, 'Explainer'))
    expect((out.result as { words: string }).words).toBe(
      'It may only change its own tables. Add Orders to its file.',
    )
  })
})
