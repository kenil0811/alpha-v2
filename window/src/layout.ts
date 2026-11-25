// How the person left the window: kept by Alpha per person, read once at start and
// changed through the core; every screen reads it here, never from the browser's storage.
import type { Layout, RecordKept } from '@alpha/core/api'
import { createContext, useContext } from 'react'

export const NO_LAYOUT: Layout = {
  railFolded: false,
  folded: [],
  hidden: [],
  pinned: [],
  railWidth: null,
  panel: null,
  assistant: 'open',
  pageSize: null,
  agent: null,
  listOrder: {},
  viewOf: {},
  tabs: {},
  records: {},
  cardWidth: {},
}

export const LayoutContext = createContext<{
  layout: Layout
  change: (change: Partial<Layout>) => void
}>({ layout: NO_LAYOUT, change: () => undefined })

export const useLayout = () => useContext(LayoutContext)

// A record page kept as nothing yet: no property hidden, no block moved, every block in its own place.
export const NO_RECORD: RecordKept = { hidden: [], tabs: [], places: {} }
