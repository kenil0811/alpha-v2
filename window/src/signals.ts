// What each module holds, as one signal for the rail's dot (Batch E, 66.18): its cards (a question
// needs the person now; a yes waits on a permission, a draft, a file, a match, rows to decide or
// tasks proposed; a suggestion is there to read) and its agents running now.
import type { Stream } from '@alpha/core/api'
import { type Signal, strongest } from './ui/dot.tsx'

export function moduleSignals(stream: Stream | null): Record<string, Signal> {
  const by: Record<string, Signal[]> = {}
  const add = (module: string | null, s: Signal) => {
    if (module) by[module] = [...(by[module] ?? []), s]
  }
  for (const c of stream?.cards ?? [])
    add(c.module, c.kind === 'question' ? 'now' : c.kind === 'suggestion' ? 'read' : 'yes')
  for (const r of stream?.running ?? []) add(r.module, 'running')
  return Object.fromEntries(
    Object.entries(by).flatMap(([m, all]) => {
      const s = strongest(all)
      return s ? [[m, s]] : []
    }),
  )
}
