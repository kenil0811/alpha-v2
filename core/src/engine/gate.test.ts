// The gate adapter as Alpha's own loop will call it, with no Agent SDK in between: the same
// journal lines and the same cards as the hooks give (decision 11).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadSet, STANDARD_DIR } from '../connectors/discover.ts'
import { ConnectorService } from '../connectors/service.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'
import { Gatekeeper } from './gate.ts'
import { Registry } from './registry.ts'
import { type Here, worldTools } from './tools/index.ts'

let home: string
let world: World
let user: User
let here: Here

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-gate-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
  here = {
    current: { user, turn: '1', said: null, message: 'log two eggs' },
    fromSubagent: false,
    touched: new Set<string>(),
  }
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('the gate adapter', () => {
  it('journals a world tool’s call, lets a write on the person’s message through, and says how it went', async () => {
    const events: string[] = []
    const gate = new Gatekeeper(world, here, user, { emit: (e) => events.push(e.type) })
    const d = await gate.before(
      'mcp__alpha__write',
      { table: 'Meals', rows: [{ Food: 'two eggs' }] },
      { callId: 'c1', subagent: null },
    )
    expect(d).toEqual({ allow: true })
    expect(gate.after({ callId: 'c1', ok: true, ms: 12 })).toEqual([])
    const lines = world.lines({ kinds: ['call', 'called'] }).map((l) => [l.kind, l.words])
    expect(lines).toEqual([
      ['call', 'Added a row to Meals'],
      ['called', 'Done.'],
    ])
    expect(events).toEqual(['doing', 'lines'])
  })

  it('puts a connector’s send on a card with the connector’s own preview, and the shell’s reach outside too', async () => {
    const connectors = new ConnectorService(world, {
      secrets: new MemorySecrets(),
      known: (await loadSet(STANDARD_DIR)).connectors,
    })
    const gate = new Gatekeeper(world, here, user, { connectors })
    const mail = { to: 'priya@harbor.example', subject: 'The CIM', body: 'Could you send it?' }
    expect(
      (await gate.before('mcp__gmail__draft', mail, { callId: 'c2', subagent: null })).allow,
    ).toBe(true)
    const send = await gate.before('mcp__gmail__send', mail, { callId: 'c3', subagent: null })
    expect(send.allow).toBe(false)
    expect(send.reason).toMatch(/waits/i)
    const card = world.cards.waiting(user.id).find((c) => c.call?.tool === 'gmail_send')
    // nothing has gone to this address from here: the card says so (item 39, 25 Oct)
    expect(card?.words).toBe('Send an email to priya@harbor.example: “The CIM”, a new recipient?')
    expect(card?.restsOn).toContain('Nothing has gone to this address from here before.')
    expect(card?.options[0]).toBe('Send it')
    world.cards.answer(card?.id as string, 'Send it', { kind: 'person', id: user.id })
    await gate.before(
      'mcp__gmail__send',
      { ...mail, subject: 'The NDA' },
      { callId: 'c3b', subagent: null },
    )
    const second = world.cards.waiting(user.id).find((c) => c.call?.tool === 'gmail_send')
    expect(second?.words).toBe('Send an email to priya@harbor.example: “The NDA”?')
    expect(world.lines({ kinds: ['call'] }).map((l) => l.words)).toEqual([
      'Saved a draft to priya@harbor.example',
      'Send an email to priya@harbor.example',
      'Send an email to priya@harbor.example',
    ])
    expect(gate.network('api.example.com').allow).toBe(false)
    // the hosts whose reach waits come back once, after the call, for the model's own eyes
    expect(gate.after({ callId: 'c4', ok: false, error: 'refused' })).toEqual(['api.example.com'])
    expect(gate.after({ callId: 'c5', ok: true })).toEqual([])
  })

  it('refuses a send a rule forbids when the rule names Gmail or its send (28 Oct)', async () => {
    const connectors = new ConnectorService(world, {
      secrets: new MemorySecrets(),
      known: (await loadSet(STANDARD_DIR)).connectors,
    })
    const gate = new Gatekeeper(world, here, user, { connectors })
    const person = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
    const mail = { to: 'priya@harbor.example', subject: 'The CIM', body: 'Could you send it?' }
    for (const through of [['gmail'], ['gmail.send']]) {
      const r = world.rules.save(
        {
          side: 'deny',
          module: null,
          agent: null,
          said: 'never email outside',
          covers: { does: ['send'], through, to: { outside: ['example.com'] } },
        },
        person,
      )
      const out = await gate.before('mcp__gmail__send', mail, {
        callId: `c-${through[0]}`,
        subagent: null,
      })
      expect(out.allow).toBe(false)
      expect(out.reason).toMatch(/^Refused by the person's rule/)
      world.rules.revoke(r.id, person)
    }
    expect(world.cards.waiting(user.id).filter((c) => c.call?.tool === 'gmail_send')).toEqual([])
  })

  it('lets a route’s own tool through: the sandbox and the file walls judge those', async () => {
    const gate = new Gatekeeper(world, here, user)
    expect(await gate.before('Bash', { command: 'ls' }, { callId: 'c6', subagent: null })).toEqual({
      allow: true,
    })
    expect(gate.words('Bash', { description: 'List files' })).toBe('Ran: List files')
  })
})

describe('the tool registry', () => {
  it('holds the world’s and the connectors’ tools as one list, serves them per server, and runs one by name', async () => {
    const connectors = new ConnectorService(world, {
      secrets: new MemorySecrets(),
      known: (await loadSet(STANDARD_DIR)).connectors,
    })
    const registry = new Registry(
      [...worldTools(world, here, undefined, connectors), ...connectors.entries()],
      { alwaysLoad: ['alpha'] },
    )
    expect(registry.names()).toContain('mcp__alpha__query')
    expect(registry.names()).toContain('mcp__gmail__send')
    expect(registry.names()).toContain('mcp__calendar__events')
    expect(Object.keys(registry.servers()).sort()).toEqual([
      'alpha',
      'calendar',
      'contacts',
      'gmail',
    ])
    const out = await registry.call('mcp__alpha__query', { sql: 'SELECT 1 AS one' })
    expect(out.isError).toBeUndefined()
    expect(out.content[0]).toMatchObject({ type: 'text' })
    expect((out.content[0] as { text: string }).text).toContain('"one": 1')
    const none = await registry.call('mcp__alpha__nothing', {})
    expect(none.isError).toBe(true)
    expect(() => new Registry([...registry.all(), ...registry.all()])).toThrow(/Two tools/)
  })
})
