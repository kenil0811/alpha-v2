// Rows a schedule puts to the person (design §12, D7: batch cards): one card in Needs you with the
// rows it is about, each with the few choices it offers (In or Left out; Draft a note or Not now)
// and one button for all. A choice is the person's word on that row's field, journaled as when
// they set it in the window, so a later run never writes over it; the card is answered when every
// row has one of its choices.
import type { Card } from '../world/cards.ts'
import { Refused } from '../world/kinds.ts'
import type { Table, WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'

export const REVIEW = 'rows_review'

export interface ReviewInput {
  words: string
  table: string // its id
  field: string // the choice field the person decides, by name
  choices: string[] // two or three of its choices, the first the usual yes
  rows: string[]
  note: string | null // a field shown under each row: why the schedule put it there
}

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
  open(
    input: Omit<ReviewInput, 'table'> & { table: Table },
    by: { schedule: string; module: string; run: string },
  ): Card {
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
      actor: { kind: 'schedule', id: by.schedule },
      module: by.module,
      run: by.run,
      user: this.owner,
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
}
