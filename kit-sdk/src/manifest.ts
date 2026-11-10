// module.yaml and setup.yaml as the kit API says them: what a kit is, its tables and fields,
// where it sits, what it uses of other kits, who keeps it, and how its shape changed between
// versions. The core installs by this schema; `alpha kit check` reads it.
import { z } from 'zod'
import { CONDITION_OPS, FIELD_KINDS, SUMMARY_OPS } from './kinds.ts'

export const TONES = ['good', 'warn', 'bad', 'accent'] as const
export type Tone = (typeof TONES)[number]

// A summary field: the rows of `of` that point at this row through `through` (the
// one relation they have to this table when left out), counted, or their `field` summed, the
// least, the most or the latest (by the date `by`, or when added), where one condition holds,
// in the words of a view's filter. Worked out when read; never written.
const value = z.union([z.string(), z.number()]).nullable().optional()
export const Summary = z.object({
  of: z.string(),
  through: z.string().optional(),
  op: z.enum(SUMMARY_OPS),
  field: z.string().optional(),
  by: z.string().optional(),
  where: z
    .object({
      field: z.string(),
      op: z.enum(CONDITION_OPS),
      value,
      value2: value,
      values: z.array(z.string()).optional(),
    })
    .optional(),
})

const Field = z.object({
  name: z.string(),
  kind: z.enum(FIELD_KINDS),
  choices: z.array(z.string()).optional(),
  tones: z.record(z.string(), z.enum(TONES)).optional(),
  relates_to: z.string().optional(),
  many: z.boolean().optional(), // a relation holding a list of rows, a choice holding several
  summary: Summary.optional(), // a summary field's: what it sums up
  // a person field whose table holds one row per person: a second is refused, and
  // a merge of two people folds their rows into one
  per: z.enum(['person']).optional(),
  // a relation to one row whose rows are part of it: shown there, removed and brought back with
  // it, never empty, and no tab of its own
  part_of: z.boolean().optional(),
  indexed: z.boolean().optional(), // an index on it, for a field filtered on often
  // its values never reach a journal line (an SSN, a bank account): "(kept out)" there
  sensitive: z.boolean().optional(),
  key: z.string().optional(), // the kit's stable name for the field; its name at install when absent
  about: z.string().optional(), // one sentence on what the field means (the semantic layer)
})

export const Manifest = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  // the kit API it was written for; core says which it serves
  api: z.number().int().positive().optional(),
  // the other kits, or the connectors, whose tables it reads, relates to or triggers on: a kit by
  // name and the version it needs at least, a connector by name
  uses: z
    .array(
      z
        .object({
          kit: z.string().min(1).optional(),
          connector: z.string().min(1).optional(),
          min: z.string().optional(),
          tables: z.array(z.string()).default([]),
        })
        .refine((u) => !!u.kit !== !!u.connector, {
          message: 'A use names a kit or a connector, one of the two.',
        }),
    )
    .default([]),
  // whose kit it is to keep; none means the person's own
  maintainer: z.object({ name: z.string().min(1), address: z.string().email() }).optional(),
  // changed only by a newer pack signed by Kenil's key (rules M1): counts only from a signed pack
  managed: z.boolean().optional(),
  // Alpha's own kit: installed and kept up to date by the core, never uninstalled;
  // its schedules can still be paused
  core: z.boolean().optional(),
  // the module People and Organizations live in, as its tabs: Network's
  people: z.boolean().optional(),
  // what changed between versions, so an update renames in place and leaves a removal removed
  history: z
    .object({
      renamed: z
        .array(
          z.object({
            from: z.string(),
            to: z.string(),
            in: z.string(),
            table: z.string().optional(),
          }),
        )
        .default([]),
      removed: z
        .array(z.object({ key: z.string(), in: z.string(), table: z.string().optional() }))
        .default([]),
    })
    .optional(),
  description: z.string().optional(),
  // what the module is for: who it is for, what it keeps track of, and the decisions
  // it serves; read by Alpha before anything in it, shown at the top of Schedules and notes
  business_case: z
    .object({ for: z.string().min(1), keeps: z.string().min(1), decides: z.string().min(1) })
    .optional(),
  // the module it sits inside, by name; made empty when there is none
  within: z.string().min(1).optional(),
  tables: z
    .array(
      z.object({
        name: z.string(),
        about: z.string().optional(), // one sentence on what a row of it is
        // what the module's schedules read (sources, goals, rules): under Schedules and notes, not a tab
        setup: z.boolean().optional(),
        // a part or a setup table kept as a tab too, every row of it; the person's choice stands
        tab: z.boolean().optional(),
        // Alpha adds a row only once the person has answered this word on a card (Add): a row
        // that should be looked at and shown first (a source's page), never written on a hunch
        added_on: z.string().min(1).optional(),
        fields: z.array(Field),
        // the kinds of document its rows take (a deal's teaser, CIM, NDA), filed on a row
        documents: z.array(z.string().min(1)).optional(),
        // how its rows name people, by its fields' names (world/shape.ts PeopleMap)
        people: z
          .union([
            z.object({
              each: z.literal('person'),
              name: z.string().optional(),
              emails: z.string().optional(),
              phones: z.string().optional(),
              profile: z.string().optional(),
              company: z.string().optional(),
              title: z.string().optional(),
              you: z.object({ field: z.string(), is: z.string() }).optional(),
            }),
            z.object({
              each: z.literal('exchange'),
              channel: z.string(),
              at: z.string(),
              from: z.string().optional(),
              to: z.array(z.string()).optional(),
              with: z.array(z.string()).optional(),
              sent: z.object({ field: z.string(), is: z.string() }).optional(),
              by: z.string().optional(),
              about: z.string().optional(),
              you: z.string().optional(),
            }),
          ])
          .optional(),
        // saved views by field name: name, default, then the view (world/views.ts ViewConfig)
        views: z
          .array(
            z.looseObject({
              name: z.string(),
              default: z.boolean().optional(),
              about: z.string().optional(), // the question the view answers
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  network: z.array(z.string()).default([]),
})

// A setup row: its values by field name, and the ones the kit only assumes, each with what the
// assumption rests on (a thesis's financing, say), so they show as assumed until the person says.
export const Setup = z.record(
  z.string(),
  z.array(
    z.object({
      key: z.string(),
      values: z.record(z.string(), z.unknown()),
      assumed: z.record(z.string(), z.string()).optional(),
    }),
  ),
)

export type KitManifest = z.infer<typeof Manifest>
