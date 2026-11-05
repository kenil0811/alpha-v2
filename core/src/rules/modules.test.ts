// Who may change a module (docs/rules.md, M1 to M5), each rule tried through every door that can
// break it. M6 to M8 are written with step 8.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { api } from '../modules/runs/api.ts'
import type { AgentRunner } from '../modules/runs/runner.ts'
import type { Act } from './doors.ts'
import type { Acts } from './drive.ts'
import { drive, refusal, refusedWith, rule } from './rule.ts'
import type { RuleWorld } from './world.ts'

const NEW_FIELD = 'Priority'

// What an act would change in a module, tried on a table and its module.
async function tryShape(a: Acts, act: Act, table: string, module: string) {
  if (act === 'addField') return a.addField(table, NEW_FIELD)
  if (act === 'renameTable') return a.renameTable(table, `${table} renamed`)
  if (act === 'renameField') return a.renameField(table, fieldOf(table), 'Renamed')
  if (act === 'describe') return a.describe(table, 'Something the rule test says.')
  if (act === 'keep') return a.keep(module, 'NOTES.md', 'Notes the rule test keeps.')
}
const fieldOf = (table: string) =>
  ({ Cases: 'Status', Parts: 'Name', Decisions: 'Decision', Notes: 'Line', Messages: 'Subject' })[
    table
  ] ?? 'Name'

// Whether the module is as it was: the table there by its name, its fields, its words, its notes.
function unchanged(w: RuleWorld, act: Act, table: string, module: string, about: string | null) {
  const t = w.world.shape.table(table)
  if (!t) return false
  if (act === 'addField') return !t.fields.some((f) => f.name === NEW_FIELD)
  if (act === 'renameTable') return t.name === table
  if (act === 'renameField') return t.fields.some((f) => f.name === fieldOf(table))
  if (act === 'describe') return (t.about ?? null) === about
  const m = w.world.shape.module(module)
  const notes = m ? join(m.dir, 'NOTES.md') : ''
  return !existsSync(notes) || !readFileSync(notes, 'utf8').includes('the rule test keeps')
}

const SHAPE: Act[] = ['addField', 'renameTable', 'renameField', 'describe', 'keep']
let about: string | null = null

rule('M1', 'every module is open or managed; Alpha’s own, a plugin’s and a connector’s by Alpha', {
  world: [['alpha'], { plugin: true }],
  cases: {
    // each tried through Alpha's shape tool; M2 tries every door
    'Alpha’s own kit is managed: a new field on Decisions is refused': async (w) => {
      const refused = await refusal(() => drive(w, 'alpha: shape').addField('Decisions', NEW_FIELD))
      return refusedWith(refused, /manag/i) && unchanged(w, 'addField', 'Decisions', 'Alpha', null)
    },
    'a plugin’s module is managed: a new field on its Notes is refused': async (w) => {
      const refused = await refusal(() => drive(w, 'alpha: shape').addField('Notes', NEW_FIELD))
      return refusedWith(refused, /manag/i) && unchanged(w, 'addField', 'Notes', 'Kept notes', null)
    },
    'a connector’s module keeps its source fields: renaming Subject is refused': async (w) => {
      const refused = await refusal(() =>
        drive(w, 'alpha: shape').renameField('Messages', 'Subject', 'Topic'),
      )
      return (
        refusedWith(refused, /manag|kept in|mailbox/i) &&
        unchanged(w, 'renameField', 'Messages', 'Mailbox', null)
      )
    },
  },
  waits: {
    'Alpha’s own kit is managed: a new field on Decisions is refused': 6,
    'a plugin’s module is managed: a new field on its Notes is refused': 6,
    'a connector’s module keeps its source fields: renaming Subject is refused': 6,
  },
  later: { 'a kit marked managed in a folder not signed by Kenil’s key is open': 6 },
})

rule('M2', 'in a managed module nobody changes its shape, and each door says who manages it', {
  world: [['managed']],
  acts: SHAPE,
  // a newer signed pack is how a managed module changes (M3)
  doors: (d) => d.by !== 'kit',
  given: (w) => {
    about = w.world.shape.table('Cases')?.about ?? null
  },
  attempt: (a, act) => tryShape(a, act, 'Cases', 'Case desk'),
  holds: (w, refused, act) =>
    refusedWith(refused, /manag/i) && unchanged(w, act, 'Cases', 'Case desk', about),
  waits: {
    'alpha: shape': 6,
    'alpha: keep': 6,
    'window: a table’s about, name, fields, tab': 6,
  },
  later: {
    'in a managed mirror the kit decides whether its source fields take corrections (D6)': 6,
  },
})

rule('M3', 'only a newer signed pack changes a managed module', {
  world: [['managed']],
  cases: {
    'a newer version not signed by Kenil’s key is refused': async (w) => {
      const refused = await refusal(() =>
        drive(w, 'kit: install and update').addField('Cases', 'Court'),
      )
      return refused !== null && !w.table('Cases').fields.some((f) => f.name === 'Court')
    },
  },
  waits: { 'a newer version not signed by Kenil’s key is refused': 6 },
  later: { 'a changed file of a managed kit does not load at start, and says what changed': 6 },
})

rule(
  'M4',
  'an open module is the firm’s; a maintained kit’s shape change is on its card from every door',
  {
    world: [['maintained']],
    acts: SHAPE,
    doors: (d) => d.by !== 'kit',
    given: (w) => {
      about = w.world.shape.table('Parts')?.about ?? null
    },
    attempt: (a, act) => tryShape(a, act, 'Parts', 'Supply'),
    // nothing changed yet, and the person has the card that asks Mira or does it anyway
    holds: (w, _refused, act) =>
      unchanged(w, act, 'Parts', 'Supply', about) &&
      w.world.cards.waiting().some((c) => /Mira maintains Supply/.test(c.words)),
  },
)

// The scripts' API the Counter agent is given, its walls from its file (touches: [Orders]).
function counter(w: RuleWorld) {
  const bakery = w.world.shape.module('Bakery')
  if (!bakery) throw new Error('The rule world has no Bakery.')
  const runner = { world: w.world } as unknown as AgentRunner
  const walls = {
    kind: 'file' as const,
    touches: new Set(['orders']),
    reads: new Set(['orders', 'suppliers']),
    effects: null,
  }
  return api(runner, bakery, 'Counter', 'run_m5', { user: w.user.id, turn: null }, null, walls)
}
const landsOrder = async (w: RuleWorld, table: string, values: Record<string, unknown>) =>
  (await refusal(() => counter(w)['rows.land']({ table, items: [{ key: 'o1', values }] }))) === null

rule('M5', 'kit code finds tables and fields by their lasting key', {
  cases: {
    'an agent’s script still lands in its table after the person renames it': async (w) => {
      await drive(w, 'window: a table’s about, name, fields, tab').renameTable(
        'Orders',
        'Purchases',
      )
      return (await landsOrder(w, 'Orders', { Item: 'Flour' })) && w.rows('Purchases') === 1
    },
    'an agent’s script still lands a field after the person has it renamed': async (w) => {
      await drive(w, 'alpha: shape').renameField('Orders', 'Item', 'Product')
      return (
        (await landsOrder(w, 'Orders', { Item: 'Flour' })) &&
        w.value('Orders', w.rowOf('Orders', 'o1'), 'Product') === 'Flour'
      )
    },
    'a connector still lands its field after the person has it renamed': async (w) => {
      await drive(w, 'alpha: shape').renameField('Messages', 'Subject', 'Topic')
      const read = await refusal(async () => {
        w.landMail('m2', { From: 'ann@example.com', Subject: 'Lunch' })
      })
      return read === null && w.value('Messages', w.rowOf('Messages', 'm2'), 'Topic') === 'Lunch'
    },
  },
})
