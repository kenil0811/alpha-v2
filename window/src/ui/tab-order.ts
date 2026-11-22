// The person's own order and hidden tabs for a module's table tabs (keys `t:<id>`), kept per
// person and module by the core (tabs:<module>). Tabs saved in no order keep the order they came
// in, after the ordered ones; the tab on screen is never hidden. Pages and Setup stay where they are.
import type { TableSummary, TabsKept } from '@alpha/core/api'
import type { Tab } from './tabs.tsx'

export const NO_TABS: TabsKept = { order: [], hidden: [], pinned: [] }

type Tabbed = Pick<TableSummary, 'id' | 'place' | 'tab'>

// What the module shows for everyone: its main tables, and a part or setup table kept as a tab.
const byDefault = (t: Tabbed) => t.place === 'main' || t.tab

// Whether a table is among the module's header tabs for this person: what the module shows for
// everyone and what they pinned, never what they hid.
export const inBar = (t: Tabbed, kept: TabsKept) =>
  (byDefault(t) || kept.pinned.includes(t.id)) && !kept.hidden.includes(t.id)

// A table pinned to the person's header, or hidden from it: theirs alone either way.
export function pinTab(t: Tabbed, kept: TabsKept, on: boolean): TabsKept {
  const off = (ids: string[]) => ids.filter((x) => x !== t.id)
  return on
    ? {
        ...kept,
        hidden: off(kept.hidden),
        pinned: byDefault(t) ? off(kept.pinned) : [...off(kept.pinned), t.id],
      }
    : {
        ...kept,
        pinned: off(kept.pinned),
        hidden: byDefault(t) ? [...off(kept.hidden), t.id] : off(kept.hidden),
      }
}

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
  hidden: Tab[] // hidden from the header (the layout's barHidden), to show again
  move: (key: string, before: string | null) => void // drag: before that tab, or last
  step: (key: string, by: -1 | 1) => void // Move left, Move right
  show: (key: string) => void
}
