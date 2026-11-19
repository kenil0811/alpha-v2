// The Interviewer's defaults, in config.yaml beside the plugin: what it reads, never walls.
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { z } from 'zod'

const Config = z.object({ lookback_days: z.number().int().positive() })

export const config = Config.parse(
  parse(readFileSync(new URL('../config.yaml', import.meta.url), 'utf8')),
)
