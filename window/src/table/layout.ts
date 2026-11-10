// How a table is laid out, kept with its saved list in the core: how many columns
// stay in place at the left as it scrolls across, and which columns wrap their words onto more
// lines. Changing either changes the list on screen, saved like a filter or a width.
import type { ViewConfig } from '@alpha/core/api'

export function layoutOf(config: ViewConfig, onConfig: (c: ViewConfig) => void) {
  const { wrap } = config
  return {
    frozen: Math.max(1, config.frozen), // the first column always stays
    wrap,
    setFrozen: (frozen: number) => onConfig({ ...config, frozen }),
    toggleWrap: (id: string) =>
      onConfig({
        ...config,
        wrap: wrap.includes(id) ? wrap.filter((x) => x !== id) : [...wrap, id],
      }),
    setWrap: (next: string[]) => onConfig({ ...config, wrap: next }),
  }
}
export type LayoutNow = ReturnType<typeof layoutOf>
