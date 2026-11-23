// Rows a schedule puts to the person (D7: batch cards): one card in Needs you with the
// rows it is about, each with the few choices it offers (In or Left out; Draft a note or Not now)
// and one button for all. A choice is the person's word on that row's field, journaled as when
// they set it in the window, so a later run never writes over it; the card is answered when every
// row has one of its choices. A plugin's agent puts lines for How to work the same way (rules P2):
// a row the person keeps is written there as theirs, and nothing is written without their Keep.
import type { Card } from '../world/cards.ts'
import { keepLine } from '../world/how-to-work.ts'
import type { Actor } from '../world/journal.ts'
import { Refused } from '../world/kinds.ts'
import type { Table, WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { CHANGE_KINDS } from './runs/types.ts'

export const REVIEW = 'rows_review'

// Alpha's guesses put to the person (Vikas, 23 Nov): after a run or a turn writes to a table that
// holds values Alpha assumed or estimated, one To check card for that table, never a second. Its
// lines are read from the table each time it shows, so it is never stale; the person keeps or
// changes each value where it is (the same write as a grey value's ✓ in the table), and the card
// closes when none is left. Worked out from the world, never asked of the model.
export const TO_CHECK = 'rows_to_check'

export interface Guess {
  row: string
  name: string
  field: string
  value: unknown
  kind: 'assumed' | 'estimated'
  why: string // the words it rests on
}

export function guesses(world: World, t: Table): Guess[] {
  return world.records.list(t.id).flatMap((r) =>
    t.fields.flatMap((f) => {
      const p = r.provenance[f.slug]
      if ((p?.kind !== 'assumed' && p?.kind !== 'estimated') || r.values[f.slug] == null) return []
      const name = world.rowName(t, r.values) || 'A row'
      return [
        {
          row: r.id,
          name,
          field: f.name,
          value: r.values[f.slug],
          kind: p.kind,
          why: p.basis ?? '',
        },
      ]
    }),
  )
}

export function raiseToCheck(
  world: World,
  where: { run: string } | { turn: string },
  by: { actor: Actor; user: string | null },
): void {
  const touched = new Set(
    world.lines({ ...where, kinds: CHANGE_KINDS }).map((l) => (l.data as { table?: string }).table),
  )
  for (const id of touched) {
    const t = id ? world.shape.table(id) : undefined
    if (!t || world.cards.waitingFor(TO_CHECK, { table: t.id }) || !guesses(world, t).length)
      continue
    world.cards.open({
      kind: 'review',
      gate: 'to_check',
      words: `Alpha's guesses in ${t.name} to check`,
      help: 'Keep makes a value yours; Change puts yours in its place. Either updates the row, and whatever runs on its changes runs again.',
      call: { tool: TO_CHECK, input: { table: t.id } },
      actor: by.actor,
      user: by.user,
      module: t.module.id,
      ...where,
    })
  }
}

// A table's To check card, answered once it has nothing left to check.
export function checkedOff(world: World, tableId: string, by: Actor): void {
  const card = world.cards.waitingFor(TO_CHECK, { table: tableId })
  const t = world.shape.table(tableId)
  if (card && t && !guesses(world, t).length) world.cards.answer(card.id, 'Checked', by)
}

export interface ReviewInput {
  words: string
  table: string // its id
  field: string // the choice field the person decides, by name
  choices: string[] // two or three of its choices, the first the usual yes
  rows: string[]
  note: string | null // a field shown under each row: why the schedule put it there
  // rows that are lines for How to work: the field holding the line, whose How to work, and the
  // heading they go under; the first choice keeps a line
  howToWork?: { line: string; for: 'me' | 'everyone'; heading: string }
}

// Who puts the rows to the person: a schedule's run, or a plugin's agent in its chat with them.
export type ReviewBy =
  | { schedule: string; module: string; run: string }
  | { agent: string; turn: string; module: string; user: string }

export interface ReviewView {
  table: string
  field: string
  choices: string[]
  rows: { id: string; name: string; note: string | null; value: string | null }[]
  open: number
}

export class Reviews {
  private world: World
  private owner: string | null

  constructor(world: World, owner: string | null) {
    this.world = world
    this.owner = owner
  }

  // A card for these rows, checked against the table: the field is a choice and the choices are
  // its own.
  open(input: Omit<ReviewInput, 'table'> & { table: Table }, by: ReviewBy): Card {
    const t = input.table
    const f = t.fields.find((x) => x.name === input.field)
    if (f?.kind !== 'choice') throw new Refused(`${t.name} has no choice field ${input.field}.`)
    const wrong = input.choices.filter((c) => !f.choices.includes(c))
    if (!input.choices.length || wrong.length)
      throw new Refused(
        `${input.field} takes ${f.choices.join(', ')}; ${wrong.join(', ') || 'no choice'} given.`,
      )
    if (input.note && !t.fields.some((x) => x.name === input.note))
      throw new Refused(`${t.name} has no field ${input.note}.`)
    const h = input.howToWork
    if (h && !t.fields.some((x) => x.name === h.line))
      throw new Refused(`${t.name} has no field ${h.line}.`)
    const known = new Set(this.world.records.list(t.id).map((r) => r.id))
    const rows = [...new Set(input.rows)].filter((r) => known.has(r))
    if (!rows.length) throw new Refused('There are no rows of that table to put to the person.')
    return this.world.cards.open({
      kind: 'review',
      gate: 'rows',
      words: input.words,
      call: {
        tool: REVIEW,
        input: { ...input, table: t.id, rows, choices: input.choices } satisfies ReviewInput,
      },
      ...('schedule' in by
        ? { actor: { kind: 'schedule', id: by.schedule }, run: by.run, user: this.owner }
        : { actor: { kind: 'alpha', id: by.agent }, turn: by.turn, user: by.user }),
      module: by.module,
    })
  }

  private input(card: Card | undefined): ReviewInput | null {
    return card?.call?.tool === REVIEW ? (card.call.input as ReviewInput) : null
  }

  view(card: Card): ReviewView | null {
    const r = this.input(card)
    const t = r ? this.world.shape.table(r.table) : undefined
    if (!r || !t) return null
    const field = t.fields.find((f) => f.name === r.field)
    const note = r.note ? t.fields.find((f) => f.name === r.note) : undefined
    const byId = new Map(this.world.records.list(t.id).map((x) => [x.id, x]))
    const rows = r.rows.flatMap((id) => {
      const row = byId.get(id)
      if (!row) return []
      const v = field ? row.values[field.slug] : null
      const n = note ? row.values[note.slug] : null
      return [
        {
          id,
          name: this.world.rowName(t, row.values),
          note: typeof n === 'string' && n ? n : null,
          value: typeof v === 'string' && r.choices.includes(v) ? v : null,
        },
      ]
    })
    return {
      table: t.id,
      field: r.field,
      choices: r.choices,
      rows,
      open: rows.filter((x) => !x.value).length,
      ...(r.howToWork ? { edits: r.howToWork.line } : {}),
    }
  }

  // The person's choice on one row, or on every row not yet decided; the card is answered once
  // none is left.
  choose(cardId: string, rows: string[] | 'rest', value: string, ctx: WriteCtx): ReviewView {
    const card = this.world.cards.get(cardId)
    const r = this.input(card)
    if (!card || !r) throw new Refused('That card is not there.')
    if (card.state !== 'waiting') throw new Refused('That card is decided already.')
    if (!r.choices.includes(value)) throw new Refused(`${value} is not one of this card's choices.`)
    const t = this.world.shape.table(r.table)
    if (!t) throw new Refused('Its table is not there any more.')
    const now = this.view(card) as ReviewView
    const ids =
      rows === 'rest' ? now.rows.filter((x) => !x.value).map((x) => x.id) : rows.filter(Boolean)
    for (const id of ids) {
      const row = now.rows.find((x) => x.id === id)
      if (!row) throw new Refused('That row is not on this card.')
      // the change's own line, decided on the card (rules A1)
      this.world.records.change(
        t.id,
        [
          {
            id,
            values: { [r.field]: value },
            provenance: { kind: 'stated', source: { card: cardId } },
          },
        ],
        { ...ctx, byHand: { words: `Set ${r.field} to ${value} on ${row.name}`, card: cardId } },
      )
      if (r.howToWork && value === r.choices[0]) this.keep(t, id, r.howToWork, card, ctx)
    }
    const after = this.view(this.world.cards.get(cardId) as Card) as ReviewView
    if (!after.open) {
      const counts = r.choices
        .map((c) => [c, after.rows.filter((x) => x.value === c).length] as const)
        .filter(([, n]) => n)
        .map(([c, n]) => `${c} ${n}`)
      this.world.cards.answer(cardId, counts.join(', '), ctx.actor)
    }
    return after
  }

  // A line the person kept, written to How to work as theirs (rules P2): For everyone here only
  // when they are the owner.
  private keep(
    t: Table,
    id: string,
    h: NonNullable<ReviewInput['howToWork']>,
    card: Card,
    ctx: WriteCtx,
  ): void {
    const person = ctx.actor.kind === 'person' ? this.world.user(ctx.actor.id ?? '') : undefined
    if (!person || (card.user && person.id !== card.user))
      throw new Refused('Only the person the lines were put to keeps them.')
    if (h.for === 'everyone' && person.role !== 'owner')
      throw new Refused('Only the owner keeps a line for everyone here.')
    const slug = t.fields.find((f) => f.name === h.line)?.slug ?? ''
    const words = String(this.world.records.get(id)?.record.values[slug] ?? '').trim()
    if (!words) return
    keepLine(this.world, h.for === 'me' ? person.id : null, words, h.heading)
    this.world.line({
      actor: ctx.actor,
      kind: 'remembered',
      words: `Will remember: ${words}`,
      data: { for: h.for, card: card.id },
      user: person.id,
    })
  }
}
