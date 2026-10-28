// A module's folder: module.yaml written from its tables and views on every change (by field
// name, so it stays portable); and the check that the world's tables and the file agree.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml, stringify } from 'yaml'
import { all, one, parse } from '../db.ts'
import { columnsOf, junctionName, OWN_COLUMNS, quote } from '../ddl.ts'
import { append } from '../journal.ts'
import { Refused } from '../kinds.ts'
import { namedConfig, ViewConfig } from '../views.ts'
import type { Shape } from './shape.ts'
import { summaryNamed } from './summary.ts'
import type { Module, Table, WriteCtx } from './types.ts'
import { spec } from './types.ts'

// Only the parts of a view that say something, so module.yaml stays short to read.
function given(c: ViewConfig): Partial<ViewConfig> {
  const plain = ViewConfig.parse({})
  return Object.fromEntries(
    Object.entries(c).filter(
      ([k, v]) =>
        JSON.stringify(v) !== JSON.stringify(plain[k as keyof ViewConfig]) &&
        !(k === 'filters' && !c.filters.rules.length),
    ),
  )
}

// The catalogue and the file must agree: every table's columns and junction tables as the
// catalogue says. A difference means a bug or a hand edit, and the world refuses to open on it
// rather than misread rows.
export function check(shape: Shape): string[] {
  const drift: string[] = []
  for (const t of shape.tables()) {
    const have = new Set(
      all<{ name: string }>(shape.db, `PRAGMA table_info(${quote(t.slug)})`).map((c) => c.name),
    )
    if (!have.size) {
      drift.push(`${t.name}: no table ${t.slug} in the file`)
      continue
    }
    const want = [
      ...OWN_COLUMNS,
      ...t.fields.flatMap((f) => columnsOf(spec(f)).map((c) => c.name)),
    ].filter((c) => !['rowid', 'oid', '_rowid_'].includes(c))
    for (const c of want) if (!have.has(c)) drift.push(`${t.name}: no column ${c}`)
    for (const f of t.fields)
      if (
        f.kind === 'relation' &&
        f.many &&
        !one(shape.db, 'SELECT 1 FROM sqlite_master WHERE name = ?', junctionName(t.slug, f.slug))
      )
        drift.push(`${t.name}: no junction table for ${f.name}`)
  }
  return drift
}

// Whether a module's module.yaml says yes to one of its marks: people (People and Organizations
// are its tabs) or core (Alpha's own).
export function manifestSays(m: Module, key: 'people' | 'core'): boolean {
  const file = join(m.dir, 'module.yaml')
  if (!existsSync(file)) return false
  try {
    return (parseYaml(readFileSync(file, 'utf8')) as Record<string, unknown> | null)?.[key] === true
  } catch {
    return false
  }
}

// A module's business case (core step 3e): who it is for, what it keeps track of, the decisions it
// serves, and whose words they are. Kept in its module.yaml, beside what the file mirrors.
export interface BusinessCase {
  for: string
  keeps: string
  decides: string
  by: 'kit' | 'alpha' | 'person'
}

export function businessCase(m: Module): BusinessCase | null {
  const file = join(m.dir, 'module.yaml')
  if (!existsSync(file)) return null
  try {
    const c = (parseYaml(readFileSync(file, 'utf8')) as Record<string, unknown> | null)
      ?.business_case as Partial<BusinessCase> | undefined
    if (!c?.for || !c.keeps || !c.decides) return null
    return {
      for: String(c.for),
      keeps: String(c.keeps),
      decides: String(c.decides),
      by: c.by === 'kit' || c.by === 'person' ? c.by : 'alpha',
    }
  } catch {
    return null
  }
}

// A module's business case set: the kit's, Alpha's (from the person's words, shown as assumed) or
// the person's, which stands over the other two. False when theirs stood.
export function setBusinessCase(
  shape: Shape,
  m: Module,
  c: Omit<BusinessCase, 'by'>,
  by: BusinessCase['by'],
  ctx: WriteCtx,
): boolean {
  const was = businessCase(m)
  if (was?.by === 'person' && by !== 'person') return false
  const next = { for: c.for.trim(), keeps: c.keeps.trim(), decides: c.decides.trim(), by }
  if (!next.for || !next.keeps || !next.decides)
    throw new Refused(
      `${m.name}'s business case needs all three: who it is for, what it keeps track of, and the decisions it serves.`,
    )
  if (
    was &&
    was.by === by &&
    was.for === next.for &&
    was.keeps === next.keeps &&
    was.decides === next.decides
  )
    return true
  mkdirSync(m.dir, { recursive: true })
  const file = join(m.dir, 'module.yaml')
  const kept = existsSync(file)
    ? ((parseYaml(readFileSync(file, 'utf8')) ?? {}) as Record<string, unknown>)
    : { name: m.name }
  writeFileSync(file, stringify({ ...kept, business_case: next }))
  append(shape.db, {
    actor: ctx.actor,
    kind: 'shaped',
    words: `${m.name} is for ${next.for}; it keeps ${next.keeps}, for deciding ${next.decides}${by === 'alpha' ? ' (as Alpha read it, until you change it)' : ''}.`,
    data: { module: m.id, business_case: next },
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
    module: m.id,
    run: ctx.run ?? null,
  })
  return true
}

// A name no table in the world or in the file has: the world's own tables, SQL's words, and
// every kit table and junction table already there.
export function slugTaken(shape: Shape, slug: string): boolean {
  return (
    !!one(shape.db, 'SELECT 1 FROM tables WHERE slug = ?', slug) ||
    !!one(shape.db, 'SELECT 1 FROM sqlite_master WHERE name = ?', slug)
  )
}

// module.yaml mirrors the module's tables from the world; everything else in it (a kit's
// version, its network allowlist) is kept as it is.
// A table's saved views as module.yaml keeps them: by field name, so the module stays portable.
export function viewsOf(shape: Shape, t: Table): { views?: unknown[] } {
  const rows = all<{ name: string; config: string; is_default: number; about: string | null }>(
    shape.db,
    'SELECT name, config, is_default, about FROM views WHERE table_id = ? ORDER BY created_at',
    t.id,
  )
  if (!rows.length) return {}
  return {
    views: rows.map((v) => ({
      name: v.name,
      ...(v.is_default ? { default: true } : {}),
      ...(v.about ? { about: v.about } : {}),
      ...given(namedConfig(t, ViewConfig.parse(parse(v.config, {})))),
    })),
  }
}

export function writeManifest(shape: Shape, m: Module): void {
  mkdirSync(m.dir, { recursive: true })
  const file = join(m.dir, 'module.yaml')
  const kept = existsSync(file)
    ? ((parseYaml(readFileSync(file, 'utf8')) ?? {}) as Record<string, unknown>)
    : {}
  // where it sits, by the other module's name, so the folder says it too
  const { within: _within, ...rest } = kept
  const parent = m.parent ? shape.module(m.parent) : undefined
  const manifest = {
    name: m.name,
    ...(parent ? { within: parent.name } : {}),
    ...rest,
    tables: shape.tables(m.id).map((t) => ({
      name: t.name,
      ...(t.about ? { about: t.about } : {}),
      ...(t.setup ? { setup: true } : {}),
      fields: t.fields.map((f) => ({
        name: f.name,
        kind: f.kind,
        ...(f.about ? { about: f.about } : {}),
        ...(f.choices.length ? { choices: f.choices } : {}),
        ...(Object.keys(f.tones).length ? { tones: f.tones } : {}),
        ...(f.relatesTo ? { relates_to: shape.table(f.relatesTo)?.name } : {}),
        ...(f.many || f.tags ? { many: true } : {}),
        ...(f.partOf ? { part_of: true } : {}),
        ...(f.summary ? { summary: summaryNamed(shape, f.summary) } : {}),
        ...(f.per ? { per: f.per } : {}),
        ...(f.indexed ? { indexed: true } : {}),
        ...(f.key && f.key !== f.name ? { key: f.key } : {}),
      })),
      ...(t.documents ? { documents: t.documents } : {}),
      ...(t.people ? { people: t.people } : {}),
      ...viewsOf(shape, t),
    })),
    network: Array.isArray(kept.network) ? kept.network : [],
  }
  writeFileSync(file, stringify(manifest))
}
