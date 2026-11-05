// Who owns the data, mirrors of a system outside (docs/rules.md, D6 to D12): the made-up mailbox's
// Messages, each rule tried through every door that can break it. D11 is written with step 8.
import { revert } from '../world/records/index.ts'
import { asPerson } from './drive.ts'
import { drive, refusal, rule } from './rule.ts'
import type { RuleWorld } from './world.ts'

const SOURCE = 'The Harbor deal' // what the mailbox read for m1
const CORRECTED = 'The Harbor deal (Priya’s, not Ann’s)'
const NEWER = 'Re: the Harbor deal'

const message = (w: RuleWorld) => w.target({ by: 'connector' })

rule('D6', 'a mirror’s source field takes a correction kept in Alpha, never sent back', {
  cases: {
    'a correction stands through the next read': async (w) => {
      const t = message(w)
      await w.personSets(t, CORRECTED)
      w.landMail('m1', { Subject: NEWER })
      return w.value(t.table, t.row, t.field) === CORRECTED
    },
    'each read keeps the source’s value beside it': async (w) => {
      const t = message(w)
      await w.personSets(t, CORRECTED)
      w.landMail('m1', { Subject: NEWER })
      return w.provenance(t.table, t.row, t.field)?.beside?.value === NEWER
    },
    'Reset puts the source’s value back': async (w) => {
      const t = message(w)
      await w.personSets(t, CORRECTED)
      const refused = await refusal(() => drive(w, 'window: Reset').reset(t))
      return refused === null && w.value(t.table, t.row, t.field) === SOURCE
    },
  },
  waits: {
    'each read keeps the source’s value beside it': 4,
    'Reset puts the source’s value back': 4,
  },
  later: {
    'a correction is marked “Corrected in Alpha; Mailbox says …”': 5,
    'an action that leaves the world on a corrected value uses it, and its card says so': 5,
  },
})

// An own field on the mailbox's Messages, with a value the person gave it, and a read after.
async function ownFieldThroughRead(w: RuleWorld, add: () => Promise<void>): Promise<boolean> {
  await add()
  const t = { ...message(w), field: 'Deal' }
  await w.personSets(t, 'Harbor flour contract')
  w.landMail('m1', { From: 'priya@harbor.example', Subject: NEWER })
  return (
    w.table('Messages').fields.some((f) => f.name === 'Deal') &&
    w.value(t.table, t.row, 'Deal') === 'Harbor flour contract'
  )
}

rule('D7', 'Alpha’s own fields may sit beside the source’s on a mirror’s row', {
  cases: {
    'an own field added in the window keeps its value through the next read': (w) =>
      ownFieldThroughRead(w, () =>
        drive(w, 'window: a table’s about, name, fields, tab').addField('Messages', 'Deal'),
      ),
    'an own field Alpha adds keeps its value through the next read': (w) =>
      ownFieldThroughRead(w, () => drive(w, 'alpha: shape').addField('Messages', 'Deal')),
  },
})

rule('D8', 'a mirror’s rows come and go only with the source', {
  acts: ['remove'],
  attempt: (a, _act, _d, w) => a.remove(message(w)),
  holds: (w, refused) =>
    refused !== null && w.world.records.byKey(w.table('Messages').id, 'm1') !== undefined,
  cases: {
    'a revert of the mailbox’s read leaves its message': async (w) => {
      const landed = w.world
        .lines({ kinds: ['landed'] })
        .filter((l) => l.actor.kind === 'connector')
        .at(-1)
      if (!landed) throw new Error('The mailbox read nothing.')
      await refusal(async () => {
        revert(w.world.records, { line: landed.id }, asPerson(w), 'the mailbox’s read')
      })
      return w.world.records.byKey(w.table('Messages').id, 'm1') !== undefined
    },
  },
  waits: {
    'window: remove': 5,
    'alpha: change': 5,
    'a revert of the mailbox’s read leaves its message': 5,
  },
  later: { 'a record deleted at the source is marked gone and kept, out of the default lists': 5 },
})

rule(
  'D9',
  'each mirror’s connector declares what may change at the source, and nothing else is sent',
  {
    later: {
      'a connector declares what may change at the source, each through one named action': 5,
      'what a connector does not declare is never sent, and the mailbox declares nothing': 5,
    },
  },
)

rule('D10', 'a change to a declared field is a request that leaves the world, never a write', {
  later: {
    'a change to a declared field goes out on a card, as a step that leaves the world': 5,
    'a request is refused when the record changed since the value it was based on': 8,
  },
})

rule('D12', 'a mirror’s row says when it was last read, and is read fresh before an action on it', {
  later: {
    'a mirror’s row says when it was last read': 5,
    'an action that leaves the world on a mirror’s value reads that row fresh first': 8,
  },
})
