// The person's own order and hidden tabs for a module's table tabs (keys `t:<id>`), kept per
// person. Tabs saved in no order keep the order they came in, after the ordered ones; the tab
// on screen is never hidden. Pages and Setup stay where they are.
import type { Tab } from './tabs.tsx'

const idOf = (t: Tab) => (t.key.startsWith('t:') ? t.key.slice(2) : null)

export function arrangeTabs(
  tabs: Tab[],
  order: string[] = [],
  hidden: string[] = [],
): { shown: Tab[]; hidden: Tab[] } {
  const rank = (t: Tab) => {
    const i = order.indexOf(idOf(t) ?? '')
    return i < 0 ? order.length : i
  }
  // sort is stable, so unranked tabs keep their created order
  const sorted = tabs.filter((t) => idOf(t)).sort((a, b) => rank(a) - rank(b))
  const at = tabs.map((t) => (idOf(t) ? (sorted.shift() as Tab) : t))
  const off = (t: Tab) => !t.sel && hidden.includes(idOf(t) ?? '')
  return { shown: at.filter((t) => !off(t)), hidden: at.filter(off) }
}

// `id` moved before `before` (or last, with none): the whole order of `ids`, hidden ones too.
export function moveBefore(ids: string[], id: string, before: string | null): string[] {
  const rest = ids.filter((x) => x !== id)
  const i = before === null ? -1 : rest.indexOf(before)
  return i < 0 ? [...rest, id] : [...rest.slice(0, i), id, ...rest.slice(i)]
}

// What a module's header does with its table tabs, by their keys; the pill switch draws it.
export interface TabKeeping {
  hidden: Tab[]
  move: (key: string, before: string | null) => void // drag: before that tab, or last
  step: (key: string, by: -1 | 1) => void // Move left, Move right
  hide: (key: string) => void
  show: (key: string) => void
}
