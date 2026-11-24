// Settings › Rules: the one switch at the top, and every rule below it.
import type { KeptTable, RowView } from '@alpha/core/api'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { startAsk } from './ask.ts'
import { openLink } from './opened.ts'
import { TableView } from './TableView.tsx'
import { useAct } from './ui/act.tsx'
import { List, Row } from './ui/list.tsx'
import { notify } from './ui/notice.tsx'
import { Switch } from './ui/switch.tsx'

// Whether agents and their scripts ask before a new site, by a switch: off on a fresh install.
export function AskSites() {
  const [on, setOn] = useState<boolean | null>(null)
  const { busy, problem, act } = useAct()
  useEffect(() => {
    api.get<{ on: boolean }>('/api/rules/ask-before-sites').then(
      (r) => setOn(r.on),
      () => setOn(null),
    )
  }, [])
  if (on === null) return null
  const name = 'Ask before agents open a new website'
  return (
    <List>
      <Row
        wrap
        title={name}
        about="Off, agents and what they run on a schedule open any website. On, an agent opens a link it was shown or a site on its list without asking you, and asks before a link it wrote itself to another site, since what is in an address reaches that site."
        sub={problem}
        actions={
          <Switch
            checked={on}
            disabled={busy}
            label={name}
            named
            onChange={(v) =>
              act(async () => {
                const now = (
                  await api.post<{ on: boolean }>('/api/rules/ask-before-sites', { on: v })
                ).on
                setOn(now)
                // turned off, it says so (L33); the switch above is the way back
                if (!now) notify({ words: 'Agents no longer ask before opening a new website.' })
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
// page revokes it, or approves or dismisses what Alpha noticed. Its New starts the same sentence
// as New rule at the part's head.
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
        openLink(`#/rule/${id}`)
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
