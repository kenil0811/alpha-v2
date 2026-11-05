// The journal (docs/rules.md, A1 to A5): one line per change, and a chain that a rewritten tail or
// a value changed in the file cannot pass. A2 and A5 are written with step 8.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lastHash, verify } from '../world/audit.ts'
import { backupDaily } from '../world/backups.ts'
import { run } from '../world/db.ts'
import { rule } from './rule.ts'
import type { RuleWorld } from './world.ts'

// a new row each door adds, in the table it writes
const NEW: Record<string, Record<string, unknown>> = {
  Suppliers: { Name: 'Oat Mill', Email: 'oats@mill.example' },
  Messages: { From: 'ann@example.com', Subject: 'Lunch' },
  Notes: { Line: 'Buy sugar' },
}
// lines that are not a change: what the person said, and a tool's call
const NOT_A_CHANGE = new Set(['said', 'call', 'called'])

const changeLines = (w: RuleWorld, after: number) =>
  w.linesAfter(after).filter((l) => !NOT_A_CHANGE.has(l.kind))

let before = 0
rule('A1', 'one journal line per change, written in the change’s own transaction', {
  acts: ['set', 'add'],
  given: async (w, d) => {
    if (d.by === 'plugin') await w.plugin()
    before = w.lastLine()
  },
  attempt: (a, act, d, w) => {
    const t = w.target(d)
    if (act === 'set') return a.set(t, t.table === 'Messages' ? 'Re: the Harbor deal' : 'billing@harbor.example')
    return a.add(t.table, NEW[t.table] ?? {}, 'new')
  },
  holds: (w) => changeLines(w, before).length === 1,
  cases: {
    'a refused change leaves no line': async (w) => {
      const from = w.lastLine()
      const r = await w.post(`/api/tables/${w.table('Orders').id}/rows`, {
        values: { Item: 'Flour', Quantity: 'forty' },
      })
      if (r.status === 200) throw new Error('The window took “forty” for a quantity.')
      return w.linesAfter(from).length === 0
    },
  },
  waits: {
    'window: set a value (set)': 2,
    'window: add a row (add)': 2,
    'window: paste (set)': 2,
    'window: paste (add)': 2,
  },
})

// A daily backup made in a folder of the test's own: what is beside it, and the chain's hash.
async function besideBackup(w: RuleWorld): Promise<{ hash: string | null; beside: string[] }> {
  const dir = mkdtempSync(join(tmpdir(), 'alpha-rules-backups-'))
  try {
    const made = await backupDaily(w.world.db, dir)
    if (!made || !existsSync(made)) throw new Error('No daily backup was made.')
    const beside = readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && join(e.parentPath, e.name) !== made)
      .map((e) => readFileSync(join(e.parentPath, e.name), 'utf8'))
    return { hash: lastHash(w.world.db), beside }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

rule('A3', 'the chain’s newest hash is written outside the world every day', {
  cases: {
    'the daily backup’s manifest holds the newest hash': async (w) => {
      const { hash, beside } = await besideBackup(w)
      return hash !== null && beside.some((text) => text.includes(hash))
    },
  },
  waits: { 'the daily backup’s manifest holds the newest hash': 7 },
  later: { 'the day’s report holds it too': 7 },
})

rule('A4', 'a line that writes rows carries a digest of its values, so verify finds a changed value', {
  cases: {
    'a landing’s line carries a digest of what it wrote': async (w) => {
      const landed = w.world.lines({ kinds: ['landed'] }).at(-1)
      return typeof landed?.data.digest === 'string'
    },
    'verify finds a value changed in the file': async (w) => {
      if (!verify(w.world.db).ok) throw new Error('The rule world’s chain does not verify to start with.')
      const t = w.table('Suppliers')
      const email = t.fields.find((f) => f.name === 'Email')
      if (!email) throw new Error('Suppliers has no Email.')
      run(w.world.db, `UPDATE "${t.slug}" SET "${email.slug}" = ? WHERE id = ?`, 'thief@example.com', w.rowOf('Suppliers', 'harbor'))
      if (w.value('Suppliers', w.rowOf('Suppliers', 'harbor'), 'Email') !== 'thief@example.com')
        throw new Error('The value was not changed in the file.')
      return !verify(w.world.db).ok
    },
  },
  waits: {
    'a landing’s line carries a digest of what it wrote': 7,
    'verify finds a value changed in the file': 7,
  },
})
