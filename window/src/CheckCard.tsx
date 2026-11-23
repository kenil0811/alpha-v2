// Alpha's guesses in one table, put to the person (Vikas, 23 Nov): each line a row's value with
// the words it rests on (on hover); ✓ keeps it as theirs, Change types theirs in its place. Both
// are the table's own write, so the row changes and whatever runs on its changes runs again. The
// card closes when nothing is left to check.
import type { CardView, CheckView } from '@alpha/core/api'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { api, Problem, wordsOf } from './api.ts'
import { readValue, show, typedOf } from './table/values.ts'
import { IconButton } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { List, Row } from './ui/list.tsx'
import { Renamable } from './ui/rename.tsx'
import { YesNo } from './ui/yes-no.tsx'

export function CheckCard({ card, check }: { card: CardView; check: CheckView }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const write = (row: string, body: object) =>
    api.post(`/api/tables/${check.table}/rows/${row}`, body)
  const keep = async (row: string, field: string) => {
    setBusy(true)
    setProblem(null)
    await write(row, { field, grey: 'accept' }).catch((err) => setProblem(wordsOf(err)))
    setBusy(false)
  }
  return (
    <Card label="To check" waits="Waits for you">
      <div className="font-medium text-ink text-lg">{card.words}</div>
      <List>
        {check.lines.map((l) => {
          const f = check.fields.find((x) => x.name === l.field)
          if (!f) return null
          return (
            <Row
              key={`${l.row}:${l.field}`}
              title={`${l.name} · ${l.field}`}
              about={`${l.kind === 'assumed' ? 'Assumed' : 'Estimated'}: ${l.why}`}
              sub={<span className="italic">{show(f, l.value)}</span>}
              actions={
                // while a value is typed, only its Save and Cancel show
                <Renamable
                  name={typedOf(f, l.value)}
                  rename={(typed) => {
                    const read = readValue(f, typed, l.value)
                    if ('problem' in read) return Promise.reject(new Problem(read.problem))
                    return write(l.row, { field: l.field, value: read.value })
                  }}
                  className="w-40"
                >
                  {(start) => (
                    <>
                      <IconButton label="Change" disabled={busy} onClick={start}>
                        <Pencil className="size-3.5" />
                      </IconButton>
                      <YesNo
                        yes
                        words="Keep"
                        busy={busy}
                        onClick={() => void keep(l.row, l.field)}
                      />
                    </>
                  )}
                </Renamable>
              }
            />
          )
        })}
      </List>
      {problem && <p className="text-bad text-sm">{problem}</p>}
    </Card>
  )
}
