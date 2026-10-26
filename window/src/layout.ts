// How the person left the window (design §14): kept by Alpha per person, read once at start and
// changed through the core; every screen reads it here, never from the browser's storage.
import type { Layout } from '@alpha/core/api'
import { createContext, useContext } from 'react'

export const NO_LAYOUT: Layout = {
  railFolded: false,
  folded: [],
  railWidth: null,
  panel: null,
  assistant: 'open',
  pageSize: null,
}

export const LayoutContext = createContext<{
  layout: Layout
  change: (change: Partial<Layout>) => void
}>({ layout: NO_LAYOUT, change: () => undefined })

export const useLayout = () => useContext(LayoutContext)
