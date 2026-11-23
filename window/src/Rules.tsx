// Settings › Rules: every rule in one list, the standing choice its first row with a switch.
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

// the standing choice's row (the core's rules list): turned On or Off, the owner's; never a page
const ASK_SITES = 'ask-before-sites'

// Whether Alpha may watch the person's own work (the front app and its window's title, never a
// screenshot), their yes kept with when, taken back here. It runs only where Alpha Bridge stays
// connected on their computer; the switch says when that is not so. It shows only once they said
// yes on Home's offer, to take it back (proposed, 23 Nov).
interface Watch {
  leave: { by: string; at: string } | null
  problem: string | null
}
export function WatchWork() {
  const [w, setW] = useState<Watch | null>(null)
  const { busy, problem, act } = useAct()
  useEffect(() => {
    api.get<Watch>('/api/observe').then(setW, () => setW(null))
  }, [])
  // given only on Home's offer, once its prerequisite is met: here it is only taken back
  if (!w?.leave) return null
  const name = 'Let Alpha watch my work'
  return (
    <List>
      <Row
        wrap
        title={name}
        about="Which app is in front and its window's title, every few seconds, on your computer; never a picture of your screen. Only while Alpha Bridge stays connected there. Off takes it back."
        sub={
          problem ??
          (w.leave
            ? `You said yes on ${new Date(w.leave.at).toLocaleDateString()}.${w.problem ? ` ${w.problem}` : ''}`
            : null)
        }
        actions={
          <Switch
            checked={!!w.leave}
            disabled={busy}
            label={name}
            named
            onChange={(v) =>
              act(async () => {
                if (!v) setW(await api.delete<Watch>('/api/observe'))
              })
            }
          />
        }
      />
    </List>
  )
}

// The rules: every allow and deny across Alpha, yours and what Alpha noticed, each with where it
// holds and how often it was used; a revoked one stays listed as history. A rule's page revokes
// it, or approves or dismisses what Alpha noticed. Whether agents ask before a new website is the
// list's first row (Vikas, 23 Nov).
export function Standing({ version, owner }: { version: number; owner: boolean }) {
  const [data, setData] = useState<KeptTable | null>(null)
  const load = useCallback(() => {
    api.get<KeptTable>('/api/kept/rules').then(setData, () => setData(null))
  }, [])
  const { busy, act } = useAct(load)
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  if (!data) return null
  const asks = data.rows.find((r) => r.id === ASK_SITES)?.values.state === 'On'
  const turn = async (on: boolean) => {
    const ok = await act(() => api.post('/api/rules/ask-before-sites', { on }))
    // turned off, it says so, with the way back (Vikas, 23 Nov)
    if (ok && !on)
      notify({
        words: 'Agents no longer ask before a new website. Turn it on again in',
        where: { label: 'Rules', href: '#/settings/rules' },
      })
  }
  return (
    <Embedded
      data={data}
      open={(id) => {
        if (id !== ASK_SITES) openLink(`#/rule/${id}`)
        else if (owner) void turn(!asks)
      }}
      onNew={() => startAsk('From now on, ')}
      rowAction={(r: RowView) =>
        r.id === ASK_SITES && (
          <Switch
            checked={asks}
            disabled={busy || !owner}
            label="Ask before agents open a new website"
            onChange={(on) => void turn(on)}
          />
        )
      }
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
