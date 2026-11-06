// A kit someone else maintains (decision 3b; docs/rules.md, M4): a change to its shape, by any
// door, is not made straight away. Each shape change asks first; the world (maintained.ts) opens
// the card for the person (ask the maintainer, or do it now and they are told later) and refuses
// in its words. Their "do it now anyway" makes it, as the change was asked (`redo`, ctx.anyway).
// How a table shows (a tab, setup, a saved list, where a module sits) is the person's under any
// mark, and asks nothing.
import { Refused } from '../kinds.ts'
import { setBusinessCase } from './manifest.ts'
import type { Shape } from './shape.ts'
import type { AboutBy, FieldInput, Table, Tone, WriteCtx } from './types.ts'

export type Redo = { words: string } & (
  | { method: 'makeTable'; args: [string, string, FieldInput[], Parameters<Shape['makeTable']>[4]] }
  | { method: 'addFields'; args: [string, FieldInput[]] }
  | { method: 'rename'; args: [{ table: string; field?: string }, string] }
  | { method: 'setChoices'; args: [string, string, string[]] }
  | { method: 'setTones'; args: [string, string, Record<string, Tone>] }
  | { method: 'describe'; args: [{ table: string; field?: string }, string | null, AboutBy] }
  | { method: 'setMany' | 'setOne' | 'toNotes' | 'removeField'; args: [string, string] }
  | { method: 'setPartOf' | 'setPer'; args: [string, string, boolean] }
  | { method: 'removeTable'; args: [string] }
  | {
      method: 'setBusinessCase'
      args: [string, { for: string; keeps: string; decides: string }, 'person' | 'alpha' | 'kit']
    }
  // a file kept in the module: made by the modules' keep, on the card's answer
  | { method: 'keep'; args: [string, string, string] }
)

export type Asks = (moduleId: string, redo: Redo, ctx: WriteCtx) => void

// Asked before the change, outside its transaction, so the card stays when the change is refused.
export function asks(
  shape: Shape,
  at: { table: string } | { module: string },
  redo: (t: Table | undefined) => Redo,
  ctx: WriteCtx,
): void {
  if (!shape.asks) return
  const t = 'table' in at ? shape.table(at.table) : undefined
  const module = 'module' in at ? at.module : t?.module.id
  if (module) shape.asks(module, redo(t), ctx)
}

// A new table in a module, and new fields on a table: the shape's own two (shape.ts).
export function asksMake(
  shape: Shape,
  moduleId: string,
  name: string,
  fields: FieldInput[],
  options: Parameters<Shape['makeTable']>[4],
  ctx: WriteCtx,
): void {
  const words = `make the table ${name.trim()}`
  asks(
    shape,
    { module: moduleId },
    () => ({ words, method: 'makeTable', args: [moduleId, name, fields, options] }),
    ctx,
  )
}
export function asksAdd(shape: Shape, tableId: string, fields: FieldInput[], ctx: WriteCtx): void {
  const added = fields.map((f) => `${f.name} (${f.kind})`).join(', ')
  asks(
    shape,
    { table: tableId },
    (t) => ({ words: `add ${added} to ${t?.name}`, method: 'addFields', args: [tableId, fields] }),
    ctx,
  )
}

// The change the card asked about, made on the person's word: what it says it did.
export function redo(shape: Shape, r: Redo, ctx: WriteCtx): string {
  const c = { ...ctx, anyway: true }
  switch (r.method) {
    case 'makeTable':
      shape.makeTable(r.args[0], r.args[1], r.args[2], c, r.args[3])
      break
    case 'addFields':
      shape.addFields(r.args[0], r.args[1], c)
      break
    case 'rename':
      shape.rename(r.args[0], r.args[1], c)
      break
    case 'setChoices':
      shape.setChoices(r.args[0], r.args[1], r.args[2], c)
      break
    case 'setTones':
      shape.setTones(r.args[0], r.args[1], r.args[2], c)
      break
    case 'describe':
      shape.describe(r.args[0], r.args[1], r.args[2], c)
      break
    case 'setMany':
    case 'setOne':
    case 'toNotes':
    case 'removeField':
      shape[r.method](r.args[0], r.args[1], c)
      break
    case 'setPartOf':
    case 'setPer':
      shape[r.method](r.args[0], r.args[1], r.args[2], c)
      break
    case 'removeTable':
      shape.removeTable(r.args[0], c)
      break
    case 'setBusinessCase': {
      const m = shape.module(r.args[0])
      if (!m) throw new Refused('That module is not there any more.')
      setBusinessCase(shape, m, r.args[1], r.args[2], c)
      break
    }
    case 'keep':
      throw new Error('A kept file is made by the modules’ keep, not the shape.')
  }
  return `${r.words[0]?.toUpperCase() ?? ''}${r.words.slice(1)}.`
}
