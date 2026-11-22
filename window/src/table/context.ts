// The table a screen shows: by name, for what inside it asks Alpha about the table (Add new… on a
// choice cell), and by id, for what inside it changes the table (a choice's ★ default). Given by
// the table's screen and a row's page, read where needed; a kept list has no id here.
import { createContext, useContext } from 'react'

export const TableName = createContext<{ name: string; id: string | null } | null>(null)
export const useTableName = () => useContext(TableName)?.name ?? null
export const useTableId = () => useContext(TableName)?.id ?? null
