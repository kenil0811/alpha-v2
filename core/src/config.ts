// What changes more often than the mechanisms lives in core/config/, out of the code: the
// prompt, the models, the judgements. Read on use, so an edit reaches the next turn.
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'

const DIR = join(import.meta.dirname, '..', 'config')

const Models = z.object({
  desk: z.string().min(1),
  eyes: z.string().min(1),
  agents: z.array(z.string().min(1)).min(1),
})

const Limits = z.object({
  query_page_rows: z.number().int().positive(),
  memory_characters: z.number().int().positive(),
  asks_per_request: z.number().int().positive(),
  hops_in_a_chain: z.number().int().positive(),
  tasks_at_once: z.number().int().positive(),
  essential_memory_bytes: z.number().int().positive(),
  handover_characters: z.number().int().positive(),
  messages_after_compaction: z.number().int().min(0),
  search_hits: z.number().int().positive(),
  hint_lines: z.number().int().positive(),
  changed_lines: z.number().int().positive(),
  document_page_chunks: z.number().int().positive(),
  journey_step_minutes: z.number().positive(),
  connector_retries: z.number().int().min(0),
  health_fewer_rows_ratio: z.number().positive().max(1),
  health_quiet_days: z.number().positive(),
  browser_pace_min_ms: z.number().int().min(0),
  browser_pace_max_ms: z.number().int().min(0),
  run_retries: z.number().int().min(1),
  connector_busy_wait_seconds: z.number().int().min(0),
  yes_hours: z.number().positive(),
  keep_removed_days: z.number().int().min(1),
  journal_fold_days: z.number().int().min(1),
  journey_times: z.number().int().min(1),
  journeys_at_once: z.number().int().min(1),
  question_characters: z.number().int().min(1),
  parts_shown: z.number().int().min(1),
  explore_turns: z.number().int().min(1),
  explore_look_tokens: z.number().int().min(1),
})

const Words = z.object({
  removal: z.array(z.string().min(1)).min(1),
  periods: z.object({
    words: z.array(z.string().min(1)).min(1),
    patterns: z.array(z.string().min(1)),
  }),
})

const People = z.object({
  mail_services: z.array(z.string().min(1)),
  second_levels: z.array(z.string().min(1)),
  meeting_most_people: z.number().int().min(2),
  contact_days: z.number().int().positive(),
  role_addresses: z.array(z.string().min(1)),
})

export type ModelsConfig = z.infer<typeof Models>
export type LimitsConfig = z.infer<typeof Limits>

const cache = new Map<string, { mtime: number; value: unknown }>()

function load<T>(name: string, read: (text: string) => T, dir = DIR): T {
  const file = join(dir, name)
  const mtime = statSync(file).mtimeMs
  const hit = cache.get(file)
  if (hit && hit.mtime === mtime) return hit.value as T
  const value = read(readFileSync(file, 'utf8'))
  cache.set(file, { mtime, value })
  return value
}

function yamlOf<S extends z.ZodType>(schema: S, name: string) {
  return (text: string): z.infer<S> => {
    const out = schema.safeParse(parse(text))
    if (!out.success)
      throw new Error(`core/config/${name} is not right: ${z.prettifyError(out.error)}`)
    return out.data
  }
}

export const config = {
  models: (dir?: string) => load('models.yaml', yamlOf(Models, 'models.yaml'), dir),
  limits: (dir?: string) => load('limits.yaml', yamlOf(Limits, 'limits.yaml'), dir),
  people: (dir?: string) => load('people.yaml', yamlOf(People, 'people.yaml'), dir),
  words: (dir?: string) => load('words.yaml', yamlOf(Words, 'words.yaml'), dir),
  systemPrompt: (person: string, dir?: string) =>
    load('system.md', (t) => t.trim(), dir).replaceAll('{person}', person),
  // who an agent is: its name, title, description and instructions fill the blanks
  agentPrompt: (
    a: { name: string; title: string; description: string; instructions: string },
    dir?: string,
  ) =>
    load('agent.md', (t) => t.trim(), dir)
      .replaceAll('{name}', a.name)
      .replaceAll('{title}', a.title)
      .replaceAll('{description}', a.description)
      .replaceAll('{instructions}', a.instructions),
  // how the model reads a document into the values a kit names
  reading: (dir?: string) => load('reading.md', (t) => t.trim(), dir),
  // how the model sorts a person's items into the groups they named
  judging: (dir?: string) => load('judging.md', (t) => t.trim(), dir),
}
