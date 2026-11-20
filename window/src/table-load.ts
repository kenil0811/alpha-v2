// A table read for the window: a table newly opened shows its shape first, drawn at once, its rows
// alongside; one read of a table at a time, so opening it reads its rows once.
import type { TableView as TableData } from '@alpha/core/api'
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from 'react'
import { api } from './api.ts'
import type { Place } from './place.ts'

export function useTableLoad(
  placeRef: RefObject<Place>,
  setTable: Dispatch<SetStateAction<TableData | null>>,
) {
  const [rowsComing, setRowsComing] = useState(false)
  const rowsFor = useRef<string | null>(null) // the table whose rows are here
  // an ask while a read is on its way joins it; a change's ask reads once more after it, so
  // nothing changed meanwhile is missed
  const reading = useRef<{ id: string; again: boolean } | null>(null)
  const loadTable = useCallback(
    async (id: string, opening = false, changed = true) => {
      const here = () => placeRef.current.at === 'table' && placeRef.current.id === id
      if (reading.current?.id === id) {
        if (changed) reading.current.again = true
        return
      }
      const mine = { id, again: false }
      reading.current = mine
      if (opening)
        api.get<TableData>(`/api/tables/${id}?rows=none`).then(
          (shape) => {
            if (!here() || rowsFor.current === id) return
            setTable(shape)
            setRowsComing(true)
          },
          () => undefined,
        )
      try {
        const t = await api.get<TableData>(`/api/tables/${id}`)
        if (!here()) return
        rowsFor.current = id
        setTable(t)
        setRowsComing(false)
      } catch {
        if (!here()) return
        setTable(null)
        setRowsComing(false)
        window.location.hash = '#/'
      } finally {
        if (reading.current === mine) reading.current = null
        if (mine.again && here()) void loadTable(id)
      }
    },
    [placeRef, setTable],
  )
  return { rowsComing, rowsFor, loadTable }
}
