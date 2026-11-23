// How a table is laid out, kept with its saved list in the core: how many columns stay in place at
// the left as it scrolls across, and how each column shows words longer than it is wide, as in a
// spreadsheet (Vikas, 23 Nov): Overflow into the empty cells after it (the default), Wrap onto
// more lines, or Clip at its edge. Changing either changes the list on screen, saved like a filter
// or a width.
import type { ViewConfig } from '@alpha/core/api'

export type Spill = 'overflow' | 'wrap' | 'clip'

export function layoutOf(config: ViewConfig, onConfig: (c: ViewConfig) => void) {
  const { wrap, clip } = config
  const spillOf = (id: string): Spill =>
    wrap.includes(id) ? 'wrap' : clip.includes(id) ? 'clip' : 'overflow'
  return {
    frozen: Math.max(1, config.frozen), // the first column always stays
    wrap,
    spillOf,
    setFrozen: (frozen: number) => onConfig({ ...config, frozen }),
    setSpill: (id: string, to: Spill) =>
      onConfig({
        ...config,
        wrap: [...wrap.filter((x) => x !== id), ...(to === 'wrap' ? [id] : [])],
        clip: [...clip.filter((x) => x !== id), ...(to === 'clip' ? [id] : [])],
      }),
    setWrap: (next: string[]) => onConfig({ ...config, wrap: next }),
  }
}
export type LayoutNow = ReturnType<typeof layoutOf>

// Overflow across one row: how far each cell's words may run on over the empty cells after it
// (0 for none), and which empty cells are run over. `can` says which cells may run on at all.
export function runOn(blank: boolean[], widths: number[], can: boolean[]) {
  const more = blank.map(() => 0)
  const under = blank.map(() => false)
  let from = -1
  blank.forEach((b, i) => {
    if (!b) from = can[i] ? i : -1
    else if (from >= 0) {
      more[from] = (more[from] ?? 0) + (widths[i] ?? 0)
      under[i] = true
    }
  })
  return { more, under }
}
