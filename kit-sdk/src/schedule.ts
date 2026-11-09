// A schedule's file as the kit API says it (decision 6): its front matter is
// declared here and enforced by the core; the body stays the brief, prose for the model's
// judgement. A trigger may be one, or a list.
import { parse } from 'yaml'
import { z } from 'zod'

export const Trigger = z.union([
  z.object({
    every: z.enum(['hour', 'day', 'week']),
    at: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
  }),
  z.object({ cron: z.string() }),
  z.object({ changes: z.union([z.string(), z.array(z.string())]) }), // a row added or changed in a table
  z.object({ filed: z.literal(true) }), // a document filed and read (an export dropped, say)
])
export type Trigger = z.infer<typeof Trigger>

export const Runs = z.object({
  script: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
})
export type Runs = z.infer<typeof Runs>

export const BUDGET = { minutes: 15, runs: 24 } as const

export const ScheduleFront = z.object({
  name: z.string().optional(),
  description: z.string().optional(), // one line for Settings and the kit directory
  trigger: z.union([Trigger, z.array(Trigger).min(1)]),
  runs: Runs,
  touches: z.array(z.string()).default([]), // the tables it may write: a wall
  // the gated calls it may make (draft.email, browser.open); any other is refused before a
  // card. A file that says nothing is an older one: allowed, and said in the run
  effects: z.array(z.string()).optional(),
  // what it depends on, checked at install and shown when missing
  needs: z
    .object({
      connectors: z.array(z.string()).default([]),
      tables: z.array(z.string()).default([]),
    })
    .default({ connectors: [], tables: [] }),
  // its settings, each with a default, so Settings shows them as a form; a value may come from
  // a setup row (its table, key and field)
  input: z
    .record(
      z.string(),
      z.object({
        default: z.unknown().optional(),
        about: z.string().optional(),
        setup: z.object({ table: z.string(), key: z.string(), field: z.string() }).optional(),
      }),
    )
    .optional(),
  budget: z
    .object({
      minutes: z.number().positive().default(BUDGET.minutes),
      runs: z.number().int().positive().default(BUDGET.runs),
    })
    .default({ minutes: BUDGET.minutes, runs: BUDGET.runs }),
})
export type ScheduleFrontMatter = z.infer<typeof ScheduleFront>

// A trigger, or a list of them, as a list.
export function triggersOf(t: Trigger | Trigger[] | null | undefined): Trigger[] {
  if (!t) return []
  return Array.isArray(t) ? t : [t]
}

// The front matter and the brief of one schedule file.
export function parseScheduleText(
  text: string,
  file: string,
): { front: ScheduleFrontMatter; brief: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!m) throw new Error(`${file} has no front matter.`)
  return { front: ScheduleFront.parse(parse(m[1] as string)), brief: (m[2] as string).trim() }
}
