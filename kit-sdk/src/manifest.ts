// module.yaml and setup.yaml as the kit API says them (decisions 5 and 8): what a kit is, its
// tables and fields, where it sits, what it uses of other kits, who keeps it, and how its shape
// changed between versions. The core installs by this schema; `alpha kit check` reads it.
import { z } from 'zod'
import { FIELD_KINDS } from './kinds.ts'

export const TONES = ['good', 'warn', 'bad', 'accent'] as const
export type Tone = (typeof TONES)[number]

const Field = z.object({
  name: z.string(),
  kind: z.enum(FIELD_KINDS),
  choices: z.array(z.string()).optional(),
  tones: z.record(z.string(), z.enum(TONES)).optional(),
  relates_to: z.string().optional(),
  many: z.boolean().optional(), // a relation holding a list of rows
  indexed: z.boolean().optional(), // an index on it, for a field filtered on often
  key: z.string().optional(), // the kit's stable name for the field; its name at install when absent
})

export const Manifest = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  // the kit API it was written for (decision 5); core says which it serves
  api: z.number().int().positive().optional(),
  // the other kits, or the connectors, whose tables it reads, relates to or triggers on
  // (decision 8): a kit by name and the version it needs at least, a connector by name
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
  // whose kit it is to keep (decision 3b); none means the person's own
  maintainer: z.object({ name: z.string().min(1), address: z.string().email() }).optional(),
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
  // the module it sits inside, by name; made empty when there is none (Kenil, 20 Oct)
  within: z.string().min(1).optional(),
  tables: z
    .array(
      z.object({
        name: z.string(),
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
          .array(z.looseObject({ name: z.string(), default: z.boolean().optional() }))
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
export type KitSetup = z.infer<typeof Setup>
