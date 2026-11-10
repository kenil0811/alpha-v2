// The builder's walls: structure is not the model's judgement alone. In the shape tool, a module's
// first table waits for its business case; a table that is only a name is a choice on the table
// that would point at it; a table named for a period is one table with a date on each row
// (world/shape/naming.ts, where the core rename meets it too). Each refuses in words that say what
// to make instead, so the model builds the better shape in the same turn. Kits are checked, not
// walled.
import { config } from '../../config.ts'
import { Refused } from '../../world/kinds.ts'
import type { FieldInput, Module, Table } from '../../world/shape/index.ts'
import { businessCase } from '../../world/shape/manifest.ts'
import type { World } from '../../world/world.ts'

export interface CaseInput {
  for: string
  keeps: string
  decides: string
}

// A module's first table needs its business case, given now if it has none.
export function caseFirst(module: Module | undefined, name: string, given: CaseInput | undefined) {
  if (given || (module && businessCase(module))) return
  throw new Refused(
    `${module?.name ?? name} has no business case yet. Give business_case with the table: who it is for, what it keeps track of, and the decisions it serves, from the person’s words.`,
  )
}

// One text field, notes aside, is a name and nothing more.
export function notOnlyAName(table: string, fields: FieldInput[]) {
  const own = fields.filter((f) => f.kind !== 'notes')
  if (own.length !== 1 || own[0]?.kind !== 'text') return
  throw new Refused(
    `${table} would hold only a name. If it is a list to pick from (industries, stages), make it a choice field on the table that would point at it, with these as its choices. If each is a thing of its own the person keeps (a client, a deal, a home), make the table now with what it keeps beyond its name (an email, a status, when it began): assume what fits, ask nothing, and say what you added.`,
  )
}

// A table its module adds to only on the person's word (added_on: a module's sources, added twice
// without their page read): Alpha's row waits for a card they answered with it, and one answer lets
// one write in.
export function addedOnAnswer(world: World, table: Table, user: string | null) {
  const word = table.addedOn
  if (!word) return
  if (user && world.cards.takeAnswer(user, word, config.limits().yes_hours)) return
  throw new Refused(
    `${table.name} takes a row only after the person answers ${word} on a card: show them first what the row would be (its module's notes say how, and what to look at before asking), ask with ${word} as an option, then add it.`,
  )
}
