// What of an installed module is the person's now (on Module details): each with the module's own
// version back, and the fields the module no longer uses.
import type { YoursView } from '@alpha/core/api'
import { Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Confirm } from './ui/dialog.tsx'
import { List, Row } from './ui/list.tsx'
import { More } from './ui/more.tsx'
import { Part } from './ui/part.tsx'
import { MenuItem } from './ui/popover.tsx'

// What of an installed module is the person's now: each with the module's own version
// back, and the fields the module no longer uses, each with its values gone for good. It shows
// only when there is something to show.
export function Yours({ moduleId, onChange }: { moduleId: string; onChange: () => void }) {
  const [yours, setYours] = useState<YoursView | null>(null)
  const [asking, setAsking] = useState<string | null>(null)
  const load = useCallback(() => {
    api.get<YoursView>(`/api/kits/${moduleId}/yours`).then(setYours, () => setYours(null))
  }, [moduleId])
  useEffect(() => {
    load()
  }, [load])
  const { busy, problem, act } = useAct(() => {
    load()
    onChange()
  })
  if (!yours) return null
  const back = (what: Record<string, string>) =>
    act(() => api.post(`/api/kits/${moduleId}/yours/back`, what))
  const items = [
    ...yours.files.map((f) => ({
      key: `file:${f.path}`,
      words: `The file ${f.path.split('/').pop()}, ${f.state === 'removed' ? 'deleted' : 'changed'} by you`,
      back: () => back({ kind: 'file', path: f.path }),
    })),
    ...yours.rows.map((r) => ({
      key: `row:${r.id}`,
      words: `${r.name} in ${r.table}, a setting you changed`,
      back: () => back({ kind: 'row', table: r.table, key: r.key }),
    })),
    ...yours.views.map((v) => ({
      key: `view:${v.id}`,
      words: `The saved list ${v.name} on ${v.table}, yours`,
      back: () => back({ kind: 'view', table: v.table, name: v.name }),
    })),
    ...yours.fields.map((f) => ({
      key: `field:${f.id}`,
      words: `The field ${f.name} in ${f.table}, added by you`,
      back: null,
    })),
  ]
  if (!items.length && !yours.removed.length) return null
  const gone = yours.removed.find((f) => f.fieldId === asking)
  return (
    <Part
      title="What is yours"
      about="What you changed in this module; its updates leave these alone."
    >
      {problem && <Refusal words={problem} />}
      <List>
        {items.map((it) => (
          <Row
            key={it.key}
            title={it.words}
            actions={
              it.back && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={it.back}>
                  Go back to the module's own
                </Button>
              )
            }
          />
        ))}
        {yours.removed.map((f) => (
          <Row
            key={`gone-${f.fieldId}`}
            title={`${f.name} in ${f.table}: the module no longer uses it`}
            sub={`${f.rows} row${f.rows === 1 ? '' : 's'} still hold a value under it`}
            actions={
              <More label="More" disabled={busy}>
                {(close) => (
                  <MenuItem
                    danger
                    onClick={() => {
                      close()
                      setAsking(f.fieldId)
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Delete its values
                  </MenuItem>
                )}
              </More>
            }
          />
        ))}
      </List>
      {gone && (
        <Confirm
          open
          title={`Delete ${gone.name}'s values?`}
          yes={`Delete ${gone.rows === 1 ? 'it' : `all ${gone.rows}`}`}
          busy={busy}
          done={{
            words: `${gone.name}'s values are deleted.`,
          }}
          onClose={() => setAsking(null)}
          onYes={() => {
            setAsking(null)
            return act(() =>
              api.post(`/api/kits/${moduleId}/fields/remove`, {
                table: gone.table,
                field: gone.fieldId,
              }),
            )
          }}
        >
          {gone.rows === 1 ? 'One row' : `${gone.rows} rows`} in {gone.table}{' '}
          {gone.rows === 1 ? 'holds' : 'hold'} a value under it, and can’t get it back.
        </Confirm>
      )}
    </Part>
  )
}
