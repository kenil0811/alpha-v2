// The Interviewer's defaults, in config.yaml beside the plugin: what it reads, never walls, and
// what it is told when the person starts, carries on or finishes.
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { z } from 'zod'

const Config = z.object({
  lookback_days: z.number().int().positive(),
  briefs: z.object({ start: z.string(), carry_on: z.string(), finish: z.string() }),
})

export const config = Config.parse(
  parse(readFileSync(new URL('../config.yaml', import.meta.url), 'utf8')),
)
