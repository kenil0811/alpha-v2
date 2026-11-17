// One connection, as Connections shows it: a row in the folders' list, or a block in its
// connector's tile. Its account and state, the computer it runs on, a problem in words when it has
// one, Read now; who set it up, where it is kept and what it may reach under Details in its ⋮.
import type { ConnectionView } from '@alpha/core/api'
import { Folder, Info, Unplug } from 'lucide-react'
import { useState } from 'react'
import { api } from './api.ts'
import { Reach } from './Reach.tsx'
import { signInWith } from './SignInApps.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Confirm } from './ui/dialog.tsx'
import { Row, Tile } from './ui/list.tsx'
import { More } from './ui/more.tsx'
import { Pill, type Tone } from './ui/pill.tsx'
import { MenuItem } from './ui/popover.tsx'
import { UpdateNow } from './ui/update-now.tsx'

const STATE: Record<ConnectionView['state'], [string, Tone]> = {
  connected: ['Connected', 'good'],
  needs_sign_in: ['Needs you to sign in', 'warn'],
  broken: ['Not working', 'bad'],
  paused: ['Paused', 'neutral'],
  waiting: ['Waiting for the customer', 'warn'],
}

// A connection: a row in the folders' list, or a block in its connector's tile.
export function ConnectionLine({
  connection: k,
  onChange,
  inTile,
}: {
  connection: ConnectionView
  onChange: () => void
  inTile?: boolean
}) {
  const { busy, problem, act } = useAct(onChange)
  const [leaving, setLeaving] = useState(false)
  // who set it up, where it is kept and what it may reach: under Details, out of the way (his
  // word, 16 Nov); a refused host and a problem always show, since they ask for something
  const [details, setDetails] = useState(false)
  // a connection on a computer that is away says so in its pill, not in a line of its own
  const away = k.computer && !k.computer.online && k.state === 'connected'
  const [state, tone]: [string, Tone] = away ? ['Offline', 'warn'] : STATE[k.state]
  // the computer it runs on, unless it is named for it (a Mac's Calendar)
  const where = k.computer && k.computer.name !== k.account ? `On ${k.computer.name}` : null
  // a problem in words, wrapped inside the card, its whole on hover
  const trouble = k.health ? (
    <p className="line-clamp-2 break-words text-sm text-warn" title={k.health}>
      {k.health}
    </p>
  ) : null
  const more = details || k.refused.length > 0
  const about = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {!details && k.refused.length > 0 && <Reach connection={k} busy={busy} act={act} />}
      {details && <span>Set up by {k.owner}</span>}
      {details &&
        k.tables.map((t) => (
          <span key={t.id}>
            Kept in{' '}
            <a className="text-accent underline underline-offset-3" href={`#/table/${t.id}`}>
              {t.name}
            </a>
            {' · '}
            <button
              type="button"
              className="underline underline-offset-3"
              disabled={busy}
              onClick={() =>
                act(() => api.post(`/api/tables/${t.id}/sidebar`, { shown: t.hidden }))
              }
            >
              {t.hidden ? 'Show in the sidebar' : 'Take out of the sidebar'}
            </button>
          </span>
        ))}
      {details && <Reach connection={k} busy={busy} act={act} />}
    </span>
  )
  const buttons = (
    <>
      {k.settings ? (
        // the one switch macOS keeps outside Alpha: System Settings opened at its pane
        <>
          <Button
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => act(() => api.post('/api/setup/settings', { pane: k.settings }))}
          >
            Open System Settings
          </Button>
          <UpdateNow
            label="Read now"
            at={k.lastSyncAt}
            busy={busy}
            onClick={() => act(() => api.post(`/api/connections/${k.id}/sync`))}
          />
        </>
      ) : k.state === 'needs_sign_in' ? (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            // a site read as the person opens in Chrome; a provider's sign-in opens its own page
            // in the browser; a password goes in Alpha's own form
            if (k.inBrowser) void act(() => api.post(`/api/connections/${k.id}/sign-in`))
            else if (k.signsInWith) void act(() => signInWith(k.id))
            else window.location.hash = `#/intelligence/connections?connect=${k.connector}`
          }}
        >
          {k.inBrowser
            ? 'Sign in with Chrome'
            : k.signsInWith
              ? `Sign in with ${k.signsInWith}`
              : 'Sign in'}
        </Button>
      ) : k.state === 'waiting' ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => act(() => api.post(`/api/connections/${k.id}/sync`))}
        >
          Try again
        </Button>
      ) : (
        <UpdateNow
          label="Read now"
          at={k.lastSyncAt}
          busy={busy}
          onClick={() => act(() => api.post(`/api/connections/${k.id}/sync`))}
        />
      )}
      <More label="More" disabled={busy}>
        {(close) => (
          <>
            <MenuItem
              onClick={() => {
                close()
                setDetails(!details)
              }}
            >
              <Info className="size-3.5" />
              {details ? 'Fewer details' : 'Details'}
            </MenuItem>
            <MenuItem
              danger
              onClick={() => {
                close()
                setLeaving(true)
              }}
            >
              <Unplug className="size-3.5" />
              Disconnect
            </MenuItem>
          </>
        )}
      </More>
      <Refusal words={problem} />
    </>
  )
  // Disconnect asks first, naming what goes (item 28, 25 Oct)
  const confirm = (
    <Confirm
      open={leaving}
      title={`Disconnect ${k.title}?`}
      yes="Disconnect"
      busy={busy}
      onClose={() => setLeaving(false)}
      onYes={() => {
        setLeaving(false)
        void act(() => api.delete(`/api/connections/${k.id}`))
      }}
    >
      Alpha stops reading {k.account}. What it read stays, and connecting again starts from scratch.
    </Confirm>
  )
  if (inTile)
    return (
      <div className="group/row flex min-w-0 flex-col gap-1.5 border-hair border-t pt-3">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{k.account}</span>
          <Pill tone={tone}>{state}</Pill>
        </div>
        {trouble}
        {more && <div className="text-ink-3 text-sm">{about}</div>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {where && <span className="text-ink-3 text-sm">{where}</span>}
          <span className="flex-1" />
          {buttons}
        </div>
        {confirm}
      </div>
    )
  return (
    <Row
      lead={
        <Tile>
          <Folder className="size-4" />
        </Tile>
      }
      title={k.account}
      sub={
        <span className="flex flex-col gap-1">
          {where && <span>{where}</span>}
          {trouble}
          {more && about}
        </span>
      }
      actions={
        <>
          <Pill tone={tone}>{state}</Pill>
          {buttons}
        </>
      }
    >
      {confirm}
    </Row>
  )
}
