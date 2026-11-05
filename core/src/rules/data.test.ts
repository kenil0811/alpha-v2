// Who owns the data, Alpha's own tables (docs/rules.md, D1 to D5), each rule tried through every
// door that can break it.
import { revert } from '../world/records/index.ts'
import { alpha, asPerson } from './drive.ts'
import { drive, refusal, rule } from './rule.ts'
import type { RuleWorld, Target } from './world.ts'

// what the person typed, by table; what a machine read
const PERSON: Record<string, string> = {
  Suppliers: 'sales@harbor.example',
  Messages: 'The Harbor deal, as I put it',
}
const MACHINE: Record<string, string> = {
  Suppliers: 'billing@harbor.example',
  Messages: 'Re: the Harbor deal',
}
const theirs = (t: Target) => PERSON[t.table] ?? 'the person’s'
const read = (t: Target) => MACHINE[t.table] ?? 'a machine’s'

rule('D1', 'every table is Alpha’s own or a mirror, and a mirror names the system that keeps it', {
  later: {
    'a connector’s table names the system that keeps its record': 5,
    'a field its connector does not fill is Alpha’s own': 5,
  },
})

rule('D2', 'the person’s value beats every machine’s', {
  acts: ['set', 'clear', 'land'],
  // the machines: Alpha on its own, an agent's script, a connection
  doors: (d) => d.by === 'alpha' || d.by === 'agent' || d.by === 'connector',
  given: (w, d) => w.personSets(w.target(d), theirs(w.target(d))),
  attempt: (a, act, d, w) => {
    const t = w.target(d)
    if (act === 'clear') return a.clear(t)
    if (act === 'land') return a.land(t, read(t))
    return a.set(t, read(t))
  },
  holds: (w, _refused, _act, d) => {
    const t = w.target(d)
    return w.value(t.table, t.row, t.field) === theirs(t)
  },
  cases: {
    // a run changed the supplier's name; the person then typed its email
    'a revert of a machine’s run leaves the person’s value': async (w) => {
      const t = w.target({ by: 'agent' })
      w.world.records.land(
        w.table('Suppliers').id,
        [{ key: 'harbor', values: { Name: 'Harbor Mills Ltd', Email: MACHINE.Suppliers } }],
        { connector: 'agent:Counter', account: 'Bakery' },
        { actor: { kind: 'agent', id: 'Counter' }, run: 'run_name' },
      )
      await w.personSets(t, PERSON.Suppliers)
      revert(w.world.records, { run: 'run_name' }, asPerson(w), 'the run')
      return w.value(t.table, t.row, t.field) === PERSON.Suppliers
    },
    // the exception: the person's own words, in the turn
    'Alpha changes it in a turn that asks for it': async (w) => {
      const t = w.target({ by: 'alpha' })
      await w.personSets(t, PERSON.Suppliers)
      w.say('Change Harbor Mills’ email to accounts@harbor.example.')
      await alpha(w, 'change', {
        table: t.table,
        rows: [{ id: t.row, values: { [t.field]: 'accounts@harbor.example' }, provenance: { kind: 'stated' } }],
      })
      return w.value(t.table, t.row, t.field) === 'accounts@harbor.example'
    },
  },
  waits: { 'alpha: change (set)': 2, 'alpha: change (clear)': 2 },
})

rule('D3', 'a machine’s newer value is kept beside the person’s, with Reset', {
  acts: ['land'],
  given: (w, d) => w.personSets(w.target(d), theirs(w.target(d))),
  attempt: (a, _act, d, w) => a.land(w.target(d), read(w.target(d))),
  holds: (w, _refused, _act, d) => {
    const t = w.target(d)
    return (
      w.value(t.table, t.row, t.field) === theirs(t) &&
      w.provenance(t.table, t.row, t.field)?.beside?.value === read(t)
    )
  },
  cases: {
    'Reset puts the newer value back': async (w) => {
      const t = w.target({ by: 'connector' })
      await w.personSets(t, PERSON.Messages)
      w.landMail('m1', { Subject: MACHINE.Messages })
      const refused = await refusal(() => drive(w, 'window: Reset').reset(t))
      return refused === null && w.value(t.table, t.row, t.field) === MACHINE.Messages
    },
  },
  waits: { 'agent: a script': 4, 'connector: landing': 4, 'Reset puts the newer value back': 4 },
})

rule('D4', 'a row the person removed stays removed', {
  acts: ['land'],
  given: (w, d) => drive(w, 'window: remove').remove(w.target(d)),
  attempt: (a, _act, d, w) => a.land(w.target(d), read(w.target(d))),
  holds: (w, _refused, _act, d) => {
    const t = w.target(d)
    return w.world.records.byKey(w.table(t.table).id, t.key ?? '') === undefined
  },
  cases: {
    'Bring back returns it': async (w) => {
      const t = w.target({ by: 'agent' })
      await drive(w, 'window: remove').remove(t)
      const removed = w.world.lines({ kinds: ['removed'] }).at(-1)
      if (!removed) return false
      revert(w.world.records, { line: removed.id }, asPerson(w), 'the removal')
      return w.world.records.byKey(w.table(t.table).id, t.key ?? '') !== undefined
    },
  },
  waits: { 'agent: a script': 4, 'connector: landing': 4 },
})

// Alpha writes an order in a turn, its quantity called the person's word: what it lands as.
async function quantityCalledStated(w: RuleWorld, said: string): Promise<string | undefined> {
  w.say(said)
  const before = w.rows('Orders')
  const refused = await refusal(() =>
    alpha(w, 'write', {
      table: 'Orders',
      rows: [{ values: { Item: 'Flour', Quantity: 40 }, provenance: { kind: 'stated' } }],
    }),
  )
  if (refused !== null) return 'refused'
  if (w.rows('Orders') !== before + 1) return undefined
  const row = w.world.records.list(w.table('Orders').id).at(-1)?.id ?? ''
  return w.provenance('Orders', row, 'Quantity')?.kind
}

rule('D5', 'a number, an amount or a date called stated is in the person’s words', {
  cases: {
    'a number the person never said is not kept as stated': async (w) => {
      const kind = await quantityCalledStated(w, 'Order flour from Harbor Mills.')
      return kind === 'assumed' || kind === 'refused'
    },
    'a number in the person’s message stays stated': async (w) =>
      (await quantityCalledStated(w, 'Order 40 bags of flour from Harbor Mills.')) === 'stated',
  },
  waits: { 'a number the person never said is not kept as stated': 4 },
  later: { 'an amount and a date are checked the same way': 4 },
})
