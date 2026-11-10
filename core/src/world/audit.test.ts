// The audit journal: every line chained to the one before by hash, so a line changed with another
// tool is found; a secret and a sensitive value never reach a line; read lines older than the
// fold's days fold into a checkpoint that keeps the chain.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Gatekeeper } from '../engine/gate.ts'
import type { Here } from '../engine/tools/index.ts'
import { COLUMNS, exportLines, fold, hashOf, verify, verifyExport } from './audit.ts'
import type { User } from './world.ts'
import { World } from './world.ts'

let home: string
let world: World
let user: User
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-audit-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const say = (words: string, kind = 'said', data: Record<string, unknown> = {}) =>
  world.line({ actor: { kind: 'person', id: user.id }, kind, words, data, user: user.id })

describe('the chain', () => {
  it('holds over every line, and breaks at a line changed with another tool', () => {
    say('one')
    say('two')
    const three = say('three')
    expect(verify(world.db)).toEqual({ ok: true, lines: expect.any(Number) })
    // what the triggers refuse, another tool does
    world.db.exec('DROP TRIGGER journal_unchanged')
    world.db.exec(`UPDATE journal SET words = 'two, changed' WHERE id = ${three.id - 1}`)
    const broken = verify(world.db)
    expect(broken.ok).toBe(false)
    expect(broken).toMatchObject({ at: three.id - 1 })
  })

  it('keeps a secret the person signed in with, and a sensitive value, out of every line', async () => {
    world.keepOut('app-pass-7')
    expect(() => say('the password is app-pass-7')).toThrow(/secret/)
    const t = world.shape.makeTable(
      world.shape.makeModule('Payroll', { actor: { kind: 'person', id: user.id } }).id,
      'People paid',
      [
        { name: 'Name', kind: 'text' },
        { name: 'SSN', kind: 'text', sensitive: true },
      ],
      { actor: { kind: 'person', id: user.id } },
    )
    expect(t.fields.find((f) => f.name === 'SSN')?.sensitive).toBe(true)
    const here: Here = {
      current: { user, turn: '1', said: null, message: 'add Ann' },
      fromSubagent: false,
      touched: new Set<string>(),
      afterTurn: [],
    }
    const gate = new Gatekeeper(world, here, user)
    await gate.before(
      'mcp__alpha__write',
      { table: 'People paid', rows: [{ values: { Name: 'Ann', SSN: '123-45-6789' } }] },
      { callId: 'c1', subagent: null },
    )
    const call = world.lines({ kinds: ['call'] }).at(-1)
    expect(JSON.stringify(call)).not.toContain('123-45-6789')
    expect(JSON.stringify(call)).toContain('(kept out)')
  })
})

describe('the export', () => {
  it('carries the chain, and proves itself or says where it was changed', () => {
    say('one')
    say('two')
    const text = exportLines(world.db)
    expect(verifyExport(text)).toEqual({ ok: true, lines: expect.any(Number) })
    const changed = text.replace('"words":"two"', '"words":"two, changed"')
    expect(changed).not.toBe(text)
    expect(verifyExport(changed).ok).toBe(false)
  })
})

describe('the fold', () => {
  it('folds old read lines into a checkpoint a day, keeps everything else, and the chain verifies', () => {
    const old = (kind: string, words: string, data: Record<string, unknown> = {}) => {
      const l = world.line({ actor: { kind: 'alpha' }, kind, words, data, user: user.id })
      world.db.exec('DROP TRIGGER IF EXISTS journal_unchanged')
      world.db.exec(`UPDATE journal SET at = '2026-06-01T10:00:00.000Z' WHERE id = ${l.id}`)
      return l
    }
    old('call', 'Looked through the tables', { tool: 'query', input: {}, call: 'a' })
    old('called', 'Done.', { call: 'a', ok: true })
    const kept = old('call', 'Added a row to Meals', { tool: 'write', input: {}, call: 'b' })
    old('called', 'Done.', { call: 'b', ok: true })
    old('connector_call', 'Gmail: sync', { call: 'sync', ok: true })
    say('now')
    // the chain is rewritten from the changed lines on, as another tool would have to
    rechain(world)
    const before = world.lines({}).length
    const out = fold(world.db, 90, { actor: { kind: 'system' } })
    expect(out).toEqual({ folded: 3, checkpoints: 1 })
    const after = world.lines({})
    expect(after.length).toBe(before - 3 + 1)
    expect(after.map((l) => l.id)).toContain(kept.id)
    const cp = after.find((l) => l.kind === 'journal_fold')
    expect(cp?.words).toMatch(/^Folded 3 lines of 1 June 2026 that only said something was read/)
    expect(verify(world.db).ok).toBe(true)
    // nothing old is left to fold
    expect(fold(world.db, 90, { actor: { kind: 'system' } })).toEqual({ folded: 0, checkpoints: 0 })
  })
})

// A test's hand on the chain: every line's hash again, in order, as the core does when it first
// chains a journal.
function rechain(w: World) {
  w.db.exec('DROP TRIGGER IF EXISTS journal_unchanged')
  let prev: string | null = null
  for (const l of w.db.prepare(`SELECT ${COLUMNS} FROM journal ORDER BY id`).all() as never[]) {
    prev = hashOf(prev, l)
    w.db.prepare('UPDATE journal SET hash = ? WHERE id = ?').run(prev, (l as { id: number }).id)
  }
}
