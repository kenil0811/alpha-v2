// What a removal takes with it, in the core's words, asked when the pop-up opens: the rows that
// are part of these (core step 3a) and how long Bring back can return them (step 1).
import { useEffect, useState } from 'react'
import { api } from '../api.ts'

export function useGoes(tableId: string, rows: string[] | null): string {
  const [words, setWords] = useState('')
  const key = rows?.join(',') ?? ''
  useEffect(() => {
    setWords('')
    if (!key) return
    api.post<{ words: string }>(`/api/tables/${tableId}/rows/goes`, { rows: key.split(',') }).then(
      (r) => setWords(r.words),
      () => setWords(''),
    )
  }, [tableId, key])
  return words
}
