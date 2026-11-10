// The world's shape, every version in the order it runs; `schema.ts` runs them.
// One version today: schema.sql, edited directly until the first client is installed (Kenil,
// 9 Nov). From that day a change is a numbered migration here, SQL or code, after it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from './db.ts'

export const SCHEMA = readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8')

export const MIGRATIONS: (string | ((db: Db) => void))[] = [SCHEMA]
