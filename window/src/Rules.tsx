// Settings › Permissions, the rules: the one switch at the top, and every rule below it.
import type { KeptTable, RowView } from '@alpha/core/api'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { startAsk } from './ask.ts'
import { TableView } from './TableView.tsx'
import { useAct } from './ui/act.tsx'
import { List, Row } from './ui/list.tsx'
import { Switch } from './ui/switch.tsx'

// A rule that agents and their scripts may reach any site, by a switch: off on a fresh install.
export function AnySite() {
  const [on, setOn] = useState<boolean | null>(null)
  const { busy, problem, act } = useAct()
  useEffect(() => {
    api.get<{ on: boolean }>('/api/rules/any-site').then(
      (r) => setOn(r.on),
      () => setOn(null),
    )
  }, [])
  if (on === null) return null
  const name = 'Agents and scripts can reach any website'
  return (
    <List>
      <Row
        wrap
        title={name}
        sub={
          problem ??
          'Off, an agent opens a link it was shown or a site on its list with no card, and asks before a link it wrote itself to another site, since what is in an address reaches that site. On, nothing on the web asks.'
        }
        actions={
          <Switch
            checked={on}
            disabled={busy}
            label={name}
            onChange={(v) =>
              act(async () => {
                setOn((await api.post<{ on: boolean }>('/api/rules/any-site', { on: v })).on)
              })
            }
          />
        }
      />
    </List>
  )
}

// The rules: every allow and deny across Alpha, yours and what Alpha noticed, each
// with where it holds and how often it was used; a revoked one stays listed as history. A rule's
// page revokes it, or approves or dismisses what Alpha noticed. Shown under Permissions.
export function Standing({ version }: { version: number }) {
  const [data, setData] = useState<KeptTable | null>(null)
  const load = useCallback(() => {
    api.get<KeptTable>('/api/kept/rules').then(setData, () => setData(null))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  if (!data) return null
  return (
    <Embedded
      data={data}
      open={(id) => {
        window.location.hash = `#/rule/${id}`
      }}
      onNew={() => startAsk('From now on, ')}
    />
  )
}

// A shared table inside a page that scrolls: a fixed height, its own frame and nothing around it,
// its edges in line with the section's title.
export function Embedded({
  data,
  open,
  onNew,
  rowAction,
}: {
  data: KeptTable
  open: (id: string) => void
  onNew?: () => void
  rowAction?: (row: RowView) => ReactNode
}) {
  return (
    <div className="-mx-7 h-[min(520px,70vh)]">
      <TableView
        data={data}
        kept={{ open, ...(onNew ? { onNew } : {}), ...(rowAction ? { rowAction } : {}) }}
      />
    </div>
  )
}
