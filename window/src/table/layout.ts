// How a table is laid out in this browser: how many columns stay in place at the left as it
// scrolls across, and which columns wrap their words onto more lines.
import { useState } from 'react'

type Layout = { frozen: number; wrap: string[] }
const BLANK: Layout = { frozen: 1, wrap: [] }

// ponytail: kept in this browser, not in the saved list; move into the view's config when Alpha's
// core keeps it
export function useLayout(tableId: string) {
  const key = `alpha-layout:${tableId}`
  const [now, setNow] = useState<Layout>(() => {
    try {
      return { ...BLANK, ...JSON.parse(localStorage.getItem(key) ?? '{}') }
    } catch {
      return BLANK
    }
  })
  const keep = (next: Layout) => {
    setNow(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {}
  }
  return {
    frozen: Math.max(1, now.frozen), // the first column always stays
    wrap: now.wrap,
    setFrozen: (frozen: number) => keep({ ...now, frozen }),
    toggleWrap: (id: string) =>
      keep({
        ...now,
        wrap: now.wrap.includes(id) ? now.wrap.filter((x) => x !== id) : [...now.wrap, id],
      }),
    setWrap: (wrap: string[]) => keep({ ...now, wrap }),
  }
}
export type LayoutNow = ReturnType<typeof useLayout>
