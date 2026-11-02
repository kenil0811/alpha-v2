// The table a screen shows, by name, for what inside it asks Alpha about the table (Add new… on a
// choice cell, Batch D, 66.5): given by the table's screen and a row's page, read where needed.
import { createContext, useContext } from 'react'

export const TableName = createContext<string | null>(null)
export const useTableName = () => useContext(TableName)
