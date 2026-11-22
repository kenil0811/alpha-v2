// A table's fields as the world keeps them: a field a kit no longer uses is hidden, its column
// kept and the table not showing it; what a field holds beyond its kind is in its options.
import { all, type Db, parse } from '../db.ts'
import type { FieldKind } from '../kinds.ts'
import type { AboutBy, Field, SummarySpec, Tone } from './types.ts'

export function fieldsOf(db: Db, tableId: string): Field[] {
  return all<{
    id: string
    name: string
    slug: string
    kind: FieldKind
    options: string
    key: string | null
    about: string | null
    about_by: AboutBy | null
  }>(
    db,
    'SELECT id, name, slug, kind, options, key, about, about_by FROM fields WHERE table_id = ? AND hidden = 0 ORDER BY position',
    tableId,
  ).map((f) => {
    const o = parse<{
      choices?: string[]
      tones?: Record<string, Tone>
      default?: string
      relatesTo?: string
      many?: boolean
      partOf?: boolean
      indexed?: boolean
      sensitive?: boolean
      summary?: SummarySpec
      per?: 'person'
    }>(f.options, {})
    return {
      id: f.id,
      name: f.name,
      slug: f.slug,
      kind: f.kind,
      choices: o.choices ?? [],
      tones: o.tones ?? {},
      default: f.kind === 'choice' && !o.many ? (o.default ?? null) : null,
      relatesTo: o.relatesTo ?? null,
      many: f.kind === 'relation' && !!o.many,
      tags: f.kind === 'choice' && !!o.many,
      summary: f.kind === 'summary' ? (o.summary ?? null) : null,
      per: f.kind === 'person' && o.per === 'person' ? ('person' as const) : null,
      partOf: f.kind === 'relation' && !o.many && !!o.partOf,
      indexed: !!o.indexed,
      sensitive: !!o.sensitive,
      key: f.key,
      about: f.about,
      aboutBy: f.about_by,
    }
  })
}
