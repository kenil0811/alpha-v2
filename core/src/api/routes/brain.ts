// The Second Brain (Vikas, 27 Oct: "the layer which is connecting all the modules"): what each
// module holds, and the links between modules — a relation field on one module's table that points
// at another module's table. Alpha's own module (Governance) is left out.
import { all } from '../../world/db.ts'
import type { Ctx } from '../ctx.ts'
import type { BrainView } from '../types.ts'
import { isAlphas } from '../views.ts'

export function registerBrain(ctx: Ctx): void {
  const { app, world } = ctx

  app.get('/api/brain', async (): Promise<BrainView> => {
    const alpha = new Set(
      world.shape
        .modules()
        .filter(isAlphas)
        .map((m) => m.id),
    )
    const count = (sql: string) => all<{ k: string; n: number }>(world.db, sql)
    const by = (sql: string) => new Map(count(sql).map((r) => [r.k, r.n]))
    const rows = by(
      'SELECT t.module_id k, count(r.id) n FROM tables t JOIN records r ON r.table_id = t.id WHERE t.hidden = 0 GROUP BY t.module_id',
    )
    const tables = by(
      'SELECT module_id k, count(*) n FROM tables WHERE hidden = 0 GROUP BY module_id',
    )
    const agents = by('SELECT module_id k, count(*) n FROM agents GROUP BY module_id')
    const docs = by('SELECT module_id k, count(*) n FROM documents GROUP BY module_id')
    const modules = world.shape
      .modules()
      .filter((m) => !alpha.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        rows: rows.get(m.id) ?? 0,
        tables: tables.get(m.id) ?? 0,
        agents: agents.get(m.id) ?? 0,
        documents: docs.get(m.id) ?? 0,
      }))
    const ids = new Set(modules.map((m) => m.id))
    const links = all<{
      options: string
      field: string
      fromTable: string
      from: string
      to: string
      toTable: string
    }>(
      world.db,
      `SELECT f.options, f.name field, a.name fromTable, a.module_id "from", b.module_id "to", b.name toTable
         FROM fields f JOIN tables a ON a.id = f.table_id
         JOIN tables b ON b.id = json_extract(f.options, '$.relatesTo')
        WHERE f.kind = 'relation' AND a.module_id != b.module_id`,
    )
      .filter((l) => ids.has(l.from) && ids.has(l.to))
      .map(({ options: _, ...l }) => l)
    const n = (sql: string) => count(sql)[0]?.n ?? 0
    return {
      modules,
      links,
      totals: {
        people: n(
          "SELECT '' k, count(*) n FROM people WHERE kind = 'person' AND merged_into IS NULL",
        ),
        organizations: n(
          "SELECT '' k, count(*) n FROM people WHERE kind = 'company' AND merged_into IS NULL",
        ),
        decisions: n("SELECT '' k, count(*) n FROM decisions"),
        noticed: n("SELECT '' k, count(*) n FROM noticed"),
        followUps: n("SELECT '' k, count(*) n FROM follow_ups"),
      },
    }
  })
}
