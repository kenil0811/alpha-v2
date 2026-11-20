// The list a table is being worked in, and how it differs from that list as saved: kept for the
// session, so leaving the table and coming back finds it as it was.

import type { SavedView, ViewConfig, ViewKind, ViewOf } from '@alpha/core/api'
import { useEffect, useRef, useState } from 'react'
import { BLANK, complete } from './engine.ts'

// All, as a table opens with no list picked: a kept list may open in another layout (Permissions'
// rules as sentences).
export const blankFor = (kind?: ViewKind): ViewConfig => (kind ? { ...BLANK, kind } : BLANK)

// A list decides which rows show; the view, kept per person for the table, how they are drawn:
// its kind and what only that kind reads. The group is a board's, map's or chart's own only; for
// a table it is the list's grouping of rows.
const GROUPS = ['board', 'map', 'chart']

export const viewOf = (c: ViewConfig): ViewOf => ({
  kind: c.kind,
  by: c.by,
  until: c.until,
  group: c.group,
  measure: c.measure,
})

// `c` drawn the way `v` says; with no view kept, as `c` says (a list saved in another kind opens
// the table in it until the person picks a view)
export function drawnAs(c: ViewConfig, v: ViewOf | undefined): ViewConfig {
  if (!v) return c
  const { kind, by, until, measure } = v
  return { ...c, kind, by, until, measure, group: GROUPS.includes(kind) ? v.group : c.group }
}

interface Working {
  view: string | null
  config: ViewConfig
}

function stored(key: string): Working | null {
  try {
    const s = sessionStorage.getItem(key)
    return s ? (JSON.parse(s) as Working) : null
  } catch {
    return null
  }
}

// Where a table opens: the first of the person's own order ('all' is All), else the core's default
// list, else All.
export function openOn(given: SavedView[], order: string[]): string | null {
  const first = order[0]
  if (first === 'all') return null
  const named = given.find((v) => v.id === first)
  return (named ?? given.find((v) => v.isDefault))?.id ?? null
}

// `given` is the table's lists as they arrived, `views` the lists as they stand here (renamed,
// saved, removed). A table reached from the rail is first drawn as its frame, its name with no
// lists yet (`loading`): the list it opens on is picked when the table itself arrives, unless the
// person already has a working list here. Until then nothing is kept, so a frame never counts as
// a choice of All.
export function useWorkingList(
  key: string,
  given: SavedView[],
  views: SavedView[],
  loading: boolean,
  order: string[],
  view: ViewOf | undefined,
  blank: ViewConfig = BLANK,
) {
  const [viewId, setViewId] = useState<string | null>(() => {
    const was = stored(key)
    if (was && (was.view === null || given.some((v) => v.id === was.view))) return was.view
    return openOn(given, order)
  })
  const [config, setConfig] = useState<ViewConfig>(() => {
    const was = stored(key)
    return complete(
      drawnAs(
        was && was.view === viewId
          ? was.config
          : (views.find((v) => v.id === viewId)?.config ?? blank),
        view,
      ),
    )
  })
  const settled = useRef(stored(key) !== null)
  useEffect(() => {
    if (settled.current || loading) return
    settled.current = true
    const front = given.find((v) => v.id === openOn(given, order))
    if (!front) return
    setViewId(front.id)
    setConfig(complete(drawnAs(front.config, view)))
  }, [loading, given, order, view])
  useEffect(() => {
    if (!settled.current) return
    try {
      sessionStorage.setItem(key, JSON.stringify({ view: viewId, config }))
    } catch {
      // a private window keeps nothing; the view still works
    }
  }, [key, viewId, config])
  return { viewId, setViewId, config, setConfig }
}
