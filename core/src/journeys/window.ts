// A journey's steps the person takes in the window (rules step 1), through the window's own routes
// as the window calls them: a value typed over a row's, a row removed, Reset on a value. A row is
// named by its name as the window shows it, or by its own key as a reader landed it.
import { z } from 'zod'
import type { buildServer } from '../api/server.ts'
import type { World } from '../world/world.ts'

const Row = { table: z.string(), row: z.string() }
export const Edit = z.object({ ...Row, field: z.string(), to: z.unknown() })
export const Remove = z.object(Row)
export const Reset = z.object({ ...Row, field: z.string() })

export interface WindowStep {
  edit?: z.infer<typeof Edit> | undefined
  remove?: z.infer<typeof Remove> | undefined
  reset?: z.infer<typeof Reset> | undefined
}

const HEADERS = { host: '127.0.0.1:4700', 'x-alpha-token': 'journey' }

// What the step did, in words. A row that is not there fails the journey; a refusal is said in the
// window's own words and judged by the step's checks, as some refusals are the point (D8).
export async function inWindow(
  app: ReturnType<typeof buildServer>,
  world: World,
  step: WindowStep,
): Promise<{ ok: boolean; what: string }> {
  const s = step.edit ?? step.remove ?? step.reset
  if (!s) throw new Error('A step in the window edits, removes or resets.')
  const t = world.shape.table(s.table)
  const row = t
    ? (world.records.list(t.id).find((r) => world.rowName(t, r.values) === s.row)?.id ??
      world.records.byKey(t.id, s.row))
    : undefined
  if (!t || !row) return { ok: false, what: `**No row ${s.row} in ${s.table}.**` }
  const [url, body, what] = step.edit
    ? [
        `/api/tables/${t.id}/rows/${row}`,
        { field: step.edit.field, value: step.edit.to },
        `Typed ${JSON.stringify(step.edit.to)} over ${s.row}'s ${step.edit.field} in ${t.name}`,
      ]
    : step.remove
      ? [`/api/tables/${t.id}/rows/remove`, { rows: [row] }, `Removed ${s.row} from ${t.name}`]
      : [
          `/api/tables/${t.id}/rows/${row}/reset`,
          { field: step.reset?.field },
          `Pressed Reset on ${s.row}'s ${step.reset?.field} in ${t.name}`,
        ]
  const r = await app.inject({ method: 'POST', url, headers: HEADERS, payload: body })
  if (r.statusCode === 200) return { ok: true, what }
  if (r.statusCode === 409)
    return { ok: true, what: `${what}: the window refused it: ${r.json().problem}` }
  return { ok: false, what: `**${what}: the window answered ${r.statusCode}:** ${r.body}` }
}
