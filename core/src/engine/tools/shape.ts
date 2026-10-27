// The shape tool (design §4): tables, fields, views and a module's place, as the desk changes
// them; on a kit someone else maintains, a shape change goes on a card first (decision 3b).

import { z } from 'zod'
import { installedKits } from '../../modules/kits/index.ts'
import { FIELD_KINDS, Refused } from '../../world/kinds.ts'
import type { WriteCtx } from '../../world/shape/index.ts'
import { namedConfig, ViewConfig } from '../../world/views.ts'
import type { World } from '../../world/world.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { Field, guard, ok, tableOf, tool } from './common.ts'

// A shape change as the desk's tool takes it.
const SHAPE_INPUT = {
  action: z.enum([
    'make_table',
    'add_fields',
    'rename',
    'set_choices',
    'remove_table',
    'save_view',
    'remove_view',
    'place_module',
    'describe',
    'part_of',
    'setup',
  ]),
  module: z.string().optional(),
  within: z.string().optional(),
  table: z.string().optional(),
  fields: z.array(Field).optional(),
  field: z.string().optional(),
  to: z.string().optional(),
  choices: z.array(z.string()).optional(),
  asked_in: z.string().optional(),
  view: ViewConfig.partial().optional(),
  default: z.boolean().optional(),
  about: z.string().optional(), // one sentence on what a table, a field or a view means
  what: z.enum(['table', 'field', 'view']).optional(), // what describe describes; field when field is given
  setup: z.boolean().optional(), // make_table and setup: a table the module's agents read
  part_of: z.boolean().optional(), // part_of: the relation field's rows are part of their row, or not
}
export type ShapeAction = z.infer<z.ZodObject<typeof SHAPE_INPUT>>

export const MAINTAINED_SHAPE = 'maintained_shape'

// The module a shape change is to, and its kit, when someone else maintains it. Arrangement
// (views, placement) is the person's under any mark; shape is what goes to the maintainer.
function maintainedKit(world: World, a: ShapeAction) {
  // where a table shows (setup) is arrangement, the person's under any mark; part of is shape
  if (['save_view', 'remove_view', 'place_module', 'setup'].includes(a.action)) return null
  const module =
    a.action === 'make_table'
      ? world.shape.module(a.module?.trim() || a.table || '')
      : a.table
        ? world.shape.table(a.table)?.module
        : undefined
  if (!module) return null
  const kit = installedKits(world).find((k) => k.module === module.id)
  return kit?.maintainer ? { ...kit, maintainer: kit.maintainer, module } : null
}

export function describeShape(a: ShapeAction): string {
  const fields = (a.fields ?? []).map((f) => `${f.name} (${f.kind})`).join(', ')
  switch (a.action) {
    case 'make_table':
      return `make the table ${a.table}${fields ? ` with ${fields}` : ''}`
    case 'add_fields':
      return `add ${fields || 'fields'} to ${a.table}`
    case 'rename':
      return `rename ${a.field ? `${a.field} in ${a.table}` : `the table ${a.table}`} to ${a.to}`
    case 'set_choices':
      return `give ${a.field} in ${a.table} the choices ${(a.choices ?? []).join(', ')}`
    case 'remove_table':
      return `remove the table ${a.table}`
    case 'describe':
      return `say what ${a.field ? `${a.field} in ${a.table}` : a.table} means`
    case 'part_of':
      return `make a row of ${a.table} ${a.part_of === false ? 'no longer ' : ''}part of the row its ${a.field} names`
    default:
      return a.action.replace('_', ' ')
  }
}

// The shape change itself, as the tool and a card's "Do it now anyway" both apply it.
export function applyShape(world: World, a: ShapeAction, c: WriteCtx): string {
  const say = (words: string) => words
  const fields = (a.fields ?? []).map((f) => ({
    name: f.name,
    kind: f.kind,
    about: f.about,
    aboutBy: 'alpha' as const,
    ...(f.choices ? { choices: f.choices } : {}),
    ...(f.tones ? { tones: f.tones } : {}),
    ...(f.relates_to ? { relatesTo: f.relates_to } : {}),
    ...(f.many ? { many: true } : {}),
    ...(f.part_of ? { partOf: true } : {}),
  }))
  if (a.action === 'place_module') {
    if (!a.module) throw new Refused('place_module needs module.')
    const m = world.shape.place(a.module, a.within?.trim() || null, c)
    const parent = m.parent ? world.shape.module(m.parent) : undefined
    return say(`${m.name} is ${parent ? `inside ${parent.name}` : 'at the top level'}.`)
  }
  const table = a.table
  if (!table) throw new Refused(`${a.action} needs table.`)
  switch (a.action) {
    case 'make_table': {
      if (!a.about?.trim())
        throw new Refused(`make_table needs about: one sentence on what a row of ${table} is.`)
      const moduleName = a.module?.trim() || table
      const existing = world.shape.module(moduleName)
      const module = existing ?? world.shape.makeModule(moduleName, c)
      // a main table keeps notes on each row (core step 3b); a part or a setup table does not
      const main = !a.setup && !fields.some((f) => f.partOf)
      if (main && !fields.some((f) => f.kind === 'notes' || f.name.toLowerCase() === 'notes'))
        fields.push({
          name: 'Notes',
          kind: 'notes',
          about: 'Free notes on this row, with people and rows mentioned in them.',
          aboutBy: 'alpha',
        })
      const t = world.shape.makeTable(module.id, table, fields, c, {
        about: a.about,
        aboutBy: 'alpha',
        ...(a.setup ? { setup: true } : {}),
      })
      return say(
        `${existing ? '' : `Made the module ${module.name}. `}Made the table ${t.name} (view ${t.slug}) with ${
          t.fields.map((f) => `${f.name} (${f.kind})`).join(', ') || 'no fields yet'
        }.`,
      )
    }
    case 'add_fields': {
      const t = world.shape.addFields(tableOf(world, table).id, fields, c)
      return say(`${t.name} now has ${t.fields.map((f) => `${f.name} (${f.kind})`).join(', ')}.`)
    }
    case 'rename': {
      if (!a.to) throw new Refused('rename needs to.')
      const t = world.shape.rename(
        { table: tableOf(world, table).id, ...(a.field ? { field: a.field } : {}) },
        a.to,
        c,
      )
      return say(`Renamed. ${t.name} has ${t.fields.map((f) => f.name).join(', ')}.`)
    }
    case 'set_choices': {
      if (!a.field || !a.choices) throw new Refused('set_choices needs field and choices.')
      world.shape.setChoices(tableOf(world, table).id, a.field, a.choices, c)
      return say(`${a.field} now offers ${a.choices.join(', ')}.`)
    }
    case 'remove_table': {
      const t = tableOf(world, table)
      world.shape.removeTable(t.id, c)
      return say(`Removed the table ${t.name}.`)
    }
    case 'save_view': {
      if (!a.field) throw new Refused('save_view needs field: the view’s name.')
      const t = tableOf(world, table)
      const was = world.views
        .list(t.id)
        .find((v) => v.name.toLowerCase() === a.field?.toLowerCase())
      const v = world.views.save(
        {
          table: t.id,
          ...(was ? { id: was.id } : {}),
          name: a.to ?? a.field,
          // a change names only what changes; the rest stays as it was
          config: { ...(was ? namedConfig(t, was.config) : {}), ...(a.view ?? {}) },
          ...(a.default !== undefined ? { isDefault: a.default } : {}),
        },
        c,
      )
      return say(
        `${was ? 'Saved' : 'Made'} the view ${v.name} on ${t.name}${v.isDefault ? ', which the table opens on' : ''}.`,
      )
    }
    case 'describe': {
      const t = tableOf(world, table)
      const by = c.actor.kind === 'person' ? 'person' : 'alpha'
      const what = a.what ?? (a.field ? 'field' : 'table')
      if (what === 'view') {
        if (!a.field) throw new Refused('describe a view: field is the view’s name.')
        const v = world.views
          .list(t.id)
          .find((x) => x.name.toLowerCase() === a.field?.toLowerCase())
        if (!v) throw new Refused(`${t.name} has no view called ${a.field}.`)
        world.views.save(
          {
            table: t.id,
            id: v.id,
            name: v.name,
            config: namedConfig(t, v.config),
            about: a.about ?? null,
          },
          c,
        )
        return say(`The view ${v.name}: ${a.about ?? 'no sentence now.'}`)
      }
      const where = what === 'field' && a.field ? { table: t.id, field: a.field } : { table: t.id }
      const changed = world.shape.describe(where, a.about ?? null, by, c)
      const name = where.field ? `${where.field} in ${t.name}` : t.name
      return say(
        changed
          ? `${name}: ${a.about ?? 'no sentence now.'}`
          : `${name} keeps the person’s own sentence; theirs stands.`,
      )
    }
    case 'part_of': {
      if (!a.field) throw new Refused('part_of needs field: the relation to the row it is part of.')
      const t = world.shape.setPartOf(tableOf(world, table).id, a.field, a.part_of !== false, c)
      return say(
        a.part_of === false
          ? `A row of ${t.name} is its own now.`
          : `A row of ${t.name} is part of the row its ${a.field} names: it shows there, and goes and comes back with it.`,
      )
    }
    case 'setup': {
      const t = world.shape.setSetup(tableOf(world, table).id, a.setup !== false, c)
      return say(
        t.setup
          ? `${t.name} is setup now, under ${t.module.name}'s Agents and notes.`
          : `${t.name} is one of ${t.module.name}'s main tables again.`,
      )
    }
    case 'remove_view': {
      const t = tableOf(world, table)
      const views = world.views.list(t.id)
      const v = views.find((x) => x.name.toLowerCase() === a.field?.toLowerCase())
      if (!v)
        throw new Refused(
          `${t.name} has no view called ${a.field}; it has ${views.map((x) => x.name).join(', ') || 'none'}.`,
        )
      world.views.remove(v.id, c)
      return say(`Removed the view ${v.name} from ${t.name}.`)
    }
  }
}

export function shapeTools({ world, ctx }: Tooling): ToolEntry[] {
  return [
    tool(
      'shape',
      [
        'Make or change tables, and place modules. Every table and field carries an about: one sentence on what a row or a value means, in the person’s own terms; you write it when you make one (it shows as assumed until they edit it), and the person’s own sentence always stands. Actions:',
        'make_table: a table with its fields, in a module (made if it is not there yet); give module, table, about, fields (each with about).',
        'add_fields: give table and fields (each with about).',
        'describe: give table and about for the table; table, field and about for a field; table, field (the view’s name), what: view and about for a view.',
        'rename: give table, and field if it is a field, and to.',
        'set_choices: give table, field and choices.',
        'remove_table: give table; if it holds the person’s own entries and they asked for it, asked_in quotes their words asking.',
        'save_view: a saved view of a table, shared by everyone, shown as a tab over it; give table, field (the view’s name; to renames it), view and default (true to open the table on it). Read the view grammar with guide (about: views) before you save one.',
        'remove_view: give table and field (the view’s name).',
        'place_module: put a module inside another; give module and within (the module it goes inside; leave within out for the top level). A module never goes inside itself or one of its own.',
        'part_of: give table, field (a relation to one row) and part_of (false to undo): its rows become part of the row they point at, as a deal’s yearly figures are part of the deal. A part shows on its row, not as a tab; it goes and comes back with it; it is never without one. A table whose rows each belong to one row of another is made with that relation part_of: true; then it needs no tab of its own.',
        'setup: give table and setup (false to undo): a table the module’s agents read (sources, goals, rules, templates), shown under Agents and notes, not as a tab. make_table takes setup: true too.',
        `Field kinds: ${FIELD_KINDS.join(', ')}. A main table gets Notes (kind notes) on its own: a row's free notes, one per table. A relation names the table it relates_to, and many: true when it holds a list of rows, or part_of: true when its rows are part of that one row. A choice may carry tones (a choice: good, warn, bad or accent) where it means a state.`,
      ].join('\n'),
      SHAPE_INPUT,
      async (a) =>
        guard(() => {
          const c = ctx()
          // a kit someone else maintains (decision 3b): a change to its shape goes to them as a
          // request, or in now with them told later; the person decides on a card
          const kit = a.action === 'place_module' ? null : maintainedKit(world, a)
          if (kit) {
            const card = world.cards.open({
              kind: 'suggestion',
              words: `${kit.maintainer.name} maintains ${kit.module.name}: ${describeShape(a)}. Ask them to put it in the kit's next version, or do it now and they are told later.`,
              restsOn: [`${kit.kit} ${kit.version} is maintained by ${kit.maintainer.name}`],
              options: [`Ask ${kit.maintainer.name}`, 'Do it now anyway'],
              call: { tool: MAINTAINED_SHAPE, input: a as Record<string, unknown> },
              actor: c.actor,
              user: c.user ?? null,
              turn: c.turn ?? null,
              module: kit.module.id,
            })
            return ok(
              `${kit.maintainer.name} maintains ${kit.module.name}, so this change is on a card for the person: ask ${kit.maintainer.name}, or do it now (card ${card.id}). Nothing changed yet.`,
            )
          }
          return ok(applyShape(world, a, c))
        }),
      { alwaysLoad: true },
    ),
  ]
}
