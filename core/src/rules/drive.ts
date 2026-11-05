// Each door driven as the core drives it (docs/rules.md, R3): the window through its routes, as
// the person; Alpha's tools through the gate and then the tool, as a turn does; an agent through
// the scripts' API; a connector through its landing; a plugin through its host; a kit through its
// installer. A door that refuses throws Refused, with its words; anything else that goes wrong
// is the test's own failure, never taken for a refusal.
import { SERVER, worldTools } from '../engine/tools/index.ts'
import { update } from '../modules/kits/index.ts'
import { api } from '../modules/runs/api.ts'
import type { AgentRunner } from '../modules/runs/runner.ts'
import { Refused } from '../world/kinds.ts'
import { revert } from '../world/records/index.ts'
import { KITS, type RuleWorld, type Target } from './world.ts'

export interface Acts {
  set(t: Target, value: unknown): Promise<void>
  clear(t: Target): Promise<void>
  add(table: string, values: Record<string, unknown>, key?: string): Promise<void>
  remove(t: Target): Promise<void>
  reset(t: Target): Promise<void>
  land(t: Target, value: unknown): Promise<void>
  revert(run: string): Promise<void>
  addField(table: string, name: string): Promise<void>
  renameTable(table: string, to: string): Promise<void>
  renameField(table: string, field: string, to: string): Promise<void>
  describe(table: string, about: string): Promise<void>
  keep(module: string, path: string, content: string): Promise<void>
}

// The window's answer: a refusal is a 409 with the core's words; a 400 or a 500 is a broken test.
async function window(w: RuleWorld, url: string, body: unknown): Promise<void> {
  const r = await w.post(url, body)
  if (r.status === 409) throw new Refused(String(r.body.problem))
  if (r.status !== 200) throw new Error(`${url} answered ${r.status}: ${JSON.stringify(r.body)}`)
}

// One of Alpha's tools, as a turn calls it: the gate first (a card is not a yes), then the tool.
export async function alpha(
  w: RuleWorld,
  tool: string,
  input: Record<string, unknown>,
): Promise<string> {
  const d = await w.gate.before(`mcp__${SERVER}__${tool}`, input, { callId: 'c1', subagent: null })
  if (!d.allow) throw new Refused(d.reason ?? 'The gate put it on a card.')
  const entry = worldTools(w.world, w.here).find((t) => t.name === tool)
  if (!entry) throw new Error(`Alpha has no tool ${tool}.`)
  const r = await entry.handler(input)
  const text = r.content.map((c) => ('text' in c ? c.text : '')).join('')
  if (!r.isError) return text
  if (text.startsWith('Something went wrong')) throw new Error(text)
  throw new Refused(text)
}

// The scripts' API an agent of the open kit is given, as its runner gives it (no walls: a run's
// own are tried with its agent's touches, M5).
function script(w: RuleWorld, table: string) {
  const t = w.table(table)
  const runner = { world: w.world } as unknown as AgentRunner
  return api(runner, t.module, 'Counter', 'run_rules', { user: w.user.id, turn: null }, null)
}

export const asPerson = (w: RuleWorld) => ({
  actor: { kind: 'person' as const, id: w.user.id },
  user: w.user.id,
})
const id = (w: RuleWorld, table: string) => w.table(table).id
const assumed = { kind: 'assumed' as const, basis: 'the rule test' }

export const DRIVERS: Record<string, (w: RuleWorld) => Partial<Acts>> = {
  'window: set a value': (w) => ({
    set: (t, value) =>
      window(w, `/api/tables/${id(w, t.table)}/rows/${t.row}`, { field: t.field, value }),
    clear: (t) =>
      window(w, `/api/tables/${id(w, t.table)}/rows/${t.row}`, { field: t.field, value: null }),
  }),
  'window: add a row': (w) => ({
    add: (table, values) => window(w, `/api/tables/${id(w, table)}/rows`, { values }),
  }),
  'window: paste': (w) => ({
    set: (t, value) =>
      window(w, `/api/tables/${id(w, t.table)}/rows/many`, {
        set: [{ row: t.row, values: { [t.field]: value } }],
      }),
    add: (table, values) =>
      window(w, `/api/tables/${id(w, table)}/rows/many`, { add: [{ values }] }),
  }),
  'window: remove': (w) => ({
    remove: (t) => window(w, `/api/tables/${id(w, t.table)}/rows/remove`, { rows: [t.row] }),
  }),
  'window: Reset': (w) => ({
    reset: (t) =>
      window(w, `/api/tables/${id(w, t.table)}/rows/${t.row}/reset`, { field: t.field }),
  }),
  // the route reverts what an Activity entry did; the world's revert is what it calls
  'window: Revert, Bring back': (w) => ({
    revert: async (run) => {
      revert(w.world.records, { run }, asPerson(w), 'what the run did')
    },
  }),
  'alpha: write': (w) => ({
    add: async (table, values) => {
      await alpha(w, 'write', { table, rows: [{ values, provenance: assumed }] })
    },
  }),
  'alpha: change': (w) => ({
    set: async (t, value) => {
      await alpha(w, 'change', {
        table: t.table,
        rows: [{ id: t.row, values: { [t.field]: value }, provenance: assumed }],
      })
    },
    clear: async (t) => {
      await alpha(w, 'change', {
        table: t.table,
        rows: [{ id: t.row, values: { [t.field]: null }, provenance: assumed }],
      })
    },
    remove: async (t) => {
      await alpha(w, 'change', { table: t.table, remove: [t.row] })
    },
  }),
  'agent: a script': (w) => ({
    // a script's figure for a value: what it works out
    set: async (t, value) => {
      await script(w, t.table)['rows.compute']({
        table: t.table,
        id: t.row,
        values: { [t.field]: value },
      })
    },
    add: async (table, values, key) => {
      await script(w, table)['rows.land']({ table, items: [{ key: key ?? 'new', values }] })
    },
    land: async (t, value) => {
      await script(w, t.table)['rows.land']({
        table: t.table,
        items: [{ key: t.key ?? '', values: { [t.field]: value } }],
      })
    },
  }),
  'connector: landing': (w) => ({
    set: async (t, value) => {
      w.landMail(t.key ?? '', { [t.field]: value })
    },
    add: async (_table, values, key) => {
      w.landMail(key ?? 'new', values)
    },
    land: async (t, value) => {
      w.landMail(t.key ?? '', { [t.field]: value })
    },
  }),
  'plugin: own rows': (w) => ({
    add: async (table, values) => {
      ;(await w.plugin()).own.add(table, [{ values, basis: 'the rule test' }])
    },
  }),
  'alpha: shape': (w) => ({
    addField: async (table, name) => {
      await alpha(w, 'shape', {
        action: 'add_fields',
        table,
        fields: [{ name, kind: 'text', about: 'A field the rule test adds.' }],
      })
    },
    renameTable: async (table, to) => {
      await alpha(w, 'shape', { action: 'rename', table, to })
    },
    renameField: async (table, field, to) => {
      await alpha(w, 'shape', { action: 'rename', table, field, to })
    },
    describe: async (table, about) => {
      await alpha(w, 'shape', { action: 'describe', table, about })
    },
  }),
  'alpha: keep': (w) => ({
    keep: async (module, path, content) => {
      await alpha(w, 'keep', { module, path, content })
    },
  }),
  'window: a table’s about, name, fields, tab': (w) => ({
    addField: (table, name) =>
      window(w, `/api/tables/${id(w, table)}/fields`, { name, kind: 'text' }),
    renameTable: (table, to) => window(w, `/api/tables/${id(w, table)}/name`, { name: to }),
    describe: (table, about) => window(w, `/api/tables/${id(w, table)}/about`, { about }),
  }),
  // a newer version of the managed kit, from a folder, as an update installs it
  'kit: install and update': (w) => ({
    addField: async (table) => {
      await update(w.world, w.table(table).module.name, KITS.managedNext, asPerson(w))
    },
  }),
}
