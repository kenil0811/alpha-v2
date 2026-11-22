// The Interviewer's defaults, in config.yaml beside the plugin: what it reads, never walls, and
// what it is told when it drafts in Set up Alpha.
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { z } from 'zod'

const Config = z.object({
  lookback_days: z.number().int().positive(),
  max_rounds: z.number().int().positive(),
  draft: z.string().min(1),
})

export const config = Config.parse(
  parse(readFileSync(new URL('../config.yaml', import.meta.url), 'utf8')),
)
