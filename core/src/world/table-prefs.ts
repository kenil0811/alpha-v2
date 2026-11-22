// How each person keeps a table (ui-rules T1): its lists in their own order (the first is where it
// opens) and how they draw it (the view: a kind and what only that kind reads); and a module's
// table tabs (M1, T19): their order, the ones hidden and the ones pinned. One preference per table,
// or per module, and person, so two windows never write over each other's other tables or modules,
// and each goes with its table, its list, its field or its module: nothing kept names a thing that
// is gone.
import { all, type Db, run } from './db.ts'

// How a table is drawn for a person; a list decides which rows show, never this.
export interface Drawn {
  kind: string
  by: string | null
  until: string | null
  group: string | null
  measure: string | null
}

// What of a list's layout a person's view takes: its kind and what only that kind reads.
export const drawnOf = (c: Drawn): Drawn => ({
  kind: c.kind,
  by: c.by,
  until: c.until,
  group: c.group,
  measure: c.measure,
})

// A module's table tabs as one person keeps them: the tables in their own order, the ones they
// hid, and the part or setup tables they pinned beside the ones the module shows for everyone.
export interface TabsKept {
  order: string[]
  hidden: string[]
  pinned: string[]
}

const ORDER = 'list_order:'
const DRAWN = 'view_of:'
const TABS = 'tabs:'

function kept<T>(db: Db, user: string, prefix: string): Record<string, T> {
  const rows = all<{ key: string; value: string }>(
    db,
    'SELECT key, value FROM preferences WHERE user_id = ? AND key LIKE ?',
    user,
    `${prefix}%`,
  )
  const out: Record<string, T> = {}
  for (const r of rows) {
    try {
      out[r.key.slice(prefix.length)] = JSON.parse(r.value) as T
    } catch {
      // a value that does not read is as good as none
    }
  }
  return out
}

function keep(db: Db, user: string, key: string, value: unknown): void {
  if (value === null) {
    run(db, 'DELETE FROM preferences WHERE user_id = ? AND key = ?', user, key)
    return
  }
  run(
    db,
    'INSERT INTO preferences (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value',
    user,
    key,
    JSON.stringify(value),
  )
}

export const listOrders = (db: Db, user: string) => kept<string[]>(db, user, ORDER)
export const drawnTables = (db: Db, user: string) => kept<Drawn>(db, user, DRAWN)

// How this person draws one table now, or none.
export function drawnTable(db: Db, user: string, table: string): Drawn | null {
  const r = all<{ value: string }>(
    db,
    'SELECT value FROM preferences WHERE user_id = ? AND key = ?',
    user,
    DRAWN + table,
  )[0]
  return r ? (JSON.parse(r.value) as Drawn) : null
}

// A table's lists in this person's order ('all' is All); none forgets it.
export function setListOrder(db: Db, user: string, table: string, ids: string[] | null): void {
  keep(db, user, ORDER + table, ids?.length ? ids : null)
}

// How this person draws a table; none opens it as the list it opens on is laid out.
export function setDrawn(db: Db, user: string, table: string, drawn: Drawn | null): void {
  keep(db, user, DRAWN + table, drawn)
}

export const keptTabs = (db: Db, user: string) => kept<TabsKept>(db, user, TABS)

// How this person keeps a module's tabs; none, or nothing in it, forgets it.
export function setTabs(db: Db, user: string, module: string, tabs: TabsKept | null): void {
  const any = tabs && (tabs.order.length || tabs.hidden.length || tabs.pinned.length)
  keep(db, user, TABS + module, any ? tabs : null)
}

// A table gone: everyone's order and view of it go too, and it leaves everyone's tabs.
export function forgetTable(db: Db, table: string): void {
  run(db, 'DELETE FROM preferences WHERE key IN (?, ?)', ORDER + table, DRAWN + table)
  for (const r of all<{ user_id: string; key: string; value: string }>(
    db,
    'SELECT user_id, key, value FROM preferences WHERE key LIKE ?',
    `${TABS}%`,
  )) {
    const t = JSON.parse(r.value) as TabsKept
    if (![t.order, t.hidden, t.pinned].some((ids) => ids.includes(table))) continue
    const off = (ids: string[]) => ids.filter((id) => id !== table)
    setTabs(db, r.user_id, r.key.slice(TABS.length), {
      order: off(t.order),
      hidden: off(t.hidden),
      pinned: off(t.pinned),
    })
  }
}

// A module gone: everyone's tabs of it go too.
export function forgetModule(db: Db, module: string): void {
  run(db, 'DELETE FROM preferences WHERE key = ?', TABS + module)
}

// A list gone: it leaves everyone's order of its table.
export function forgetList(db: Db, table: string, list: string): void {
  for (const r of all<{ user_id: string; value: string }>(
    db,
    'SELECT user_id, value FROM preferences WHERE key = ?',
    ORDER + table,
  )) {
    const ids = (JSON.parse(r.value) as string[]).filter((id) => id !== list)
    setListOrder(db, r.user_id, table, ids)
  }
}

// A field gone: no one's view of its table lays rows on it any more.
export function forgetField(db: Db, table: string, field: string): void {
  for (const r of all<{ user_id: string; value: string }>(
    db,
    'SELECT user_id, value FROM preferences WHERE key = ?',
    DRAWN + table,
  )) {
    const d = JSON.parse(r.value) as Drawn
    const off = (v: string | null) => (v === field ? null : v)
    setDrawn(db, r.user_id, table, {
      ...d,
      by: off(d.by),
      until: off(d.until),
      group: off(d.group),
      measure: off(d.measure),
    })
  }
}
