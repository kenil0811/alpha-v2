// Who may change a module (docs/rules.md, M1 to M5), each rule tried through every door that can
// break it. M6 to M8 are written with Dell's contract.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkSigned, install } from '../modules/kits/index.ts'
import { api } from '../modules/runs/api.ts'
import type { ScheduleRunner } from '../modules/runs/runner.ts'
import type { Act } from './doors.ts'
import type { Acts } from './drive.ts'
import { CONTRACT, drive, refusal, refusedWith, rule } from './rule.ts'
import { KITS, type RuleWorld } from './world.ts'

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
    'a connector’s module takes a field of the person’s, and its table may be renamed': async (
      w,
    ) => {
      const shape = drive(w, 'alpha: shape')
      await shape.addField('Messages', NEW_FIELD)
      await shape.renameTable('Messages', 'Inbox')
      return w.table('Inbox').fields.some((f) => f.name === NEW_FIELD)
    },
    'a kit marked managed in a folder not signed by Kenil’s key is open': async (w) => {
      await install(w.world, KITS.managed, {
        actor: { kind: 'person', id: w.user.id },
        user: w.user.id,
      })
      await drive(w, 'alpha: shape').addField('Cases', NEW_FIELD)
      return w.table('Cases').fields.some((f) => f.name === NEW_FIELD)
    },
  },
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
  later: {
    'in a managed mirror the kit decides whether its source fields take corrections (D6)': CONTRACT,
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
    'a newer pack signed by Kenil’s key changes it': async (w) => {
      await w.installSigned(KITS.managedNext)
      return w.table('Cases').fields.some((f) => f.name === 'Court')
    },
    'a changed file of a managed kit does not load at start, and says what changed': async (w) => {
      const m = w.world.shape.module('Case desk')
      if (!m) throw new Error('The rule world has no Case desk.')
      writeFileSync(join(m.dir, 'NOTES.md'), 'Changed by hand.')
      const said = checkSigned(w.world, w.user.id)
      return (
        said.some((s) => /NOTES\.md changed/.test(s)) &&
        w.world.cards.waiting().some((c) => /NOTES\.md changed/.test(c.words))
      )
    },
  },
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
    cases: {
      // a file the firm adds to the module, as a source's own reader, is theirs
      'a file the kit did not ship is the firm’s to keep, with no card': async (w) => {
        await drive(w, 'alpha: keep').keep('Supply', 'files/our-suppliers.md', 'Ours.')
        const m = w.world.shape.module('Supply')
        return (
          !!m &&
          existsSync(join(m.dir, 'files', 'our-suppliers.md')) &&
          !w.world.cards.waiting().some((c) => /Mira maintains Supply/.test(c.words))
        )
      },
    },
  },
)

// The scripts' API the Counter schedule is given, its walls from its file (touches: [Orders]).
function counter(w: RuleWorld) {
  const bakery = w.world.shape.module('Bakery')
  if (!bakery) throw new Error('The rule world has no Bakery.')
  const runner = { world: w.world } as unknown as ScheduleRunner
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
    'a schedule’s script still lands in its table after the person renames it': async (w) => {
      await drive(w, 'window: a table’s about, name, fields, tab').renameTable(
        'Orders',
        'Purchases',
      )
      return (await landsOrder(w, 'Orders', { Item: 'Flour' })) && w.rows('Purchases') === 1
    },
    'a schedule’s script still lands a field after the person has it renamed': async (w) => {
      await drive(w, 'alpha: shape').renameField('Orders', 'Item', 'Product')
      return (
        (await landsOrder(w, 'Orders', { Item: 'Flour' })) &&
        w.value('Orders', w.rowOf('Orders', 'o1'), 'Product') === 'Flour'
      )
    },
    // the person's rename of a source field is refused (M1); a field the connector calls by its
    // key lands whatever it is called now
    'a connector still lands its field whatever it is called now': async (w) => {
      w.world.shape.rename({ table: w.table('Messages').id, field: 'Subject' }, 'Topic', {
        actor: { kind: 'system' },
      })
      const read = await refusal(async () => {
        w.landMail('m2', { From: 'ann@example.com', Subject: 'Lunch' })
      })
      return read === null && w.value('Messages', w.rowOf('Messages', 'm2'), 'Topic') === 'Lunch'
    },
  },
})
