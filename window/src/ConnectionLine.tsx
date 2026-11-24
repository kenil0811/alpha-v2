// One connection, as Connections shows it: a row in the folders' list, or in its connector's card.
// Its account and state, the computer it runs on, a problem in words when it has one, Read now;
// who set it up, where it is kept and what it may reach under Details in its ⋮.
import type { ConnectionView } from '@alpha/core/api'
import { CalendarDays, Folder, Info, Plug, Plus, RefreshCw, Unplug, UserRound } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { api } from './api.ts'
import { Reach } from './Reach.tsx'
import { signInWith } from './SignInApps.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { cutTip } from './ui/cut-tip.ts'
import { Confirm } from './ui/dialog.tsx'
import { Row, Tile } from './ui/list.tsx'
import { More } from './ui/more.tsx'
import { Pill, type Tone } from './ui/pill.tsx'
import { MenuItem } from './ui/popover.tsx'
import { type State, StateDot } from './ui/state-card.tsx'
import { UpdateNow } from './ui/update-now.tsx'

const STATE: Record<ConnectionView['state'], [string, Tone]> = {
  connected: ['Connected', 'good'],
  needs_sign_in: ['Needs you to sign in', 'warn'],
  broken: ['Not working', 'bad'],
  paused: ['Paused', 'neutral'],
  waiting: ['Waiting on your side', 'warn'],
}
// a pill's tone as a card's dot
const DOT: Partial<Record<Tone, State>> = { good: 'good', warn: 'warn', bad: 'bad' }

const WORDS: Partial<Record<Tone, string>> = { bad: 'text-bad', warn: 'text-warn' }

// The pieces of a connection, for each place to lay them out the same way.
export interface ConnectionParts {
  pill: ReactNode // its state
  state: State // its state as a card's dot
  says: string // its state in words
  menu: ReactNode // ⋮: Details, Add another, Disconnect
  where: string | null // the computer it runs on
  problem: ReactNode // its problem in words, one line, or nothing
  body: ReactNode // refused hosts, and its details when asked
  act: ReactNode // its one act: Read now (on a card, Disconnect), Sign in, Try again, Open System Settings
  confirm: ReactNode
}

export function useConnection(
  k: ConnectionView,
  onChange: () => void,
  // card: on a card: Disconnect on its line while it works, Read now in its ⋮
  // words: when it was last read, beside its Read now (a card says it under its name instead)
  // quiet: its notes (what its last read left out, what it may reach) only under Details (a card)
  options: {
    card?: boolean
    menuShown?: boolean
    onAdd?: (() => void) | undefined
    words?: boolean
    quiet?: boolean
  } = {},
): ConnectionParts {
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
  const read = () => act(() => api.post(`/api/connections/${k.id}/sync`))
  // a problem in its state's colour, one line, whole under Details and on hover; it takes the
  // place of when it was last read, so a tile with a problem is no taller than one without; a
  // computer away says so in its pill alone
  const trouble =
    k.health && !away ? (
      <p
        className={cn(
          'min-w-0 text-sm',
          WORDS[tone] ?? 'text-ink-2',
          details ? 'break-words' : 'truncate',
        )}
        {...cutTip(k.health)}
      >
        {k.health}
      </p>
    ) : null
  const body = (
    <>
      {(details || (!options.quiet && (k.refused.length > 0 || k.leftOut > 0))) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-3 text-sm">
          {details && <span>Set up by {k.owner}</span>}
          {k.leftOut > 0 && <span>Left out {k.leftOut} on the never-use list</span>}
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
          <Reach connection={k} busy={busy} act={act} />
        </div>
      )}
    </>
  )
  const working = k.state === 'connected' && !away
  const main =
    options.card && working ? (
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setLeaving(true)}>
        Disconnect
      </Button>
    ) : k.settings ? (
      // the one switch macOS keeps outside Alpha: System Settings opened at its pane
      <>
        <UpdateNow
          label="Read now"
          at={k.lastSyncAt}
          busy={busy}
          onClick={read}
          words={!trouble && options.words !== false}
        />
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => act(() => api.post('/api/setup/settings', { pane: k.settings }))}
        >
          Open System Settings
        </Button>
      </>
    ) : k.state === 'needs_sign_in' ? (
      <Button
        size="sm"
        variant="primary"
        onClick={() => {
          // a site read as the person opens in Chrome; a provider's sign-in opens its own page in
          // the browser; a password goes in Alpha's own form
          if (k.inBrowser) void act(() => api.post(`/api/connections/${k.id}/sign-in`))
          else if (k.signsInWith) void act(() => signInWith(k.id))
          else window.location.hash = `#/settings/connections?connect=${k.connector}`
        }}
      >
        {k.inBrowser
          ? 'Sign in with Chrome'
          : k.signsInWith
            ? `Sign in with ${k.signsInWith}`
            : 'Sign in'}
      </Button>
    ) : k.state === 'waiting' ? (
      <Button size="sm" disabled={busy} onClick={read}>
        Try again
      </Button>
    ) : (
      <UpdateNow
        label="Read now"
        at={k.lastSyncAt}
        busy={busy}
        onClick={read}
        words={!trouble && options.words !== false}
      />
    )
  const menu = (
    <More label="More" disabled={busy} shown={options.card ?? false}>
      {(close) => (
        <>
          {options.card && working && (
            <MenuItem
              onClick={() => {
                close()
                void read()
              }}
            >
              <RefreshCw className="size-3.5" />
              Read now
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              close()
              setDetails(!details)
            }}
          >
            <Info className="size-3.5" />
            {details ? 'Fewer details' : 'Details'}
          </MenuItem>
          {options.onAdd && (
            <MenuItem
              onClick={() => {
                close()
                options.onAdd?.()
              }}
            >
              <Plus className="size-3.5" />
              Add another account
            </MenuItem>
          )}
          {!(options.card && working) && (
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
          )}
        </>
      )}
    </More>
  )
  // Disconnect asks first, naming what goes (item 28, 25 Oct)
  const confirm = (
    <Confirm
      open={leaving}
      title={`Disconnect ${k.title}?`}
      yes="Disconnect"
      busy={busy}
      done={{
        words: `${k.title} is disconnected. Connect it again from`,
        where: { label: 'Connections', href: '#/settings/connections' },
      }}
      onClose={() => setLeaving(false)}
      onYes={() => {
        setLeaving(false)
        return act(() => api.delete(`/api/connections/${k.id}`))
      }}
    >
      Alpha stops reading {k.account}. What it read stays, and connecting again starts from scratch.
    </Confirm>
  )
  return {
    pill: <Pill tone={tone}>{state}</Pill>,
    state: DOT[tone] ?? 'off',
    says: state,
    menu,
    where,
    problem: trouble,
    body,
    act: (
      <>
        {main}
        <Refusal words={problem} />
      </>
    ),
    confirm,
  }
}

// One of several accounts in a connector's card: its dot, account, act and ⋮ on one line, then any
// problem.
export function ConnectionInTile({
  connection: k,
  onChange,
}: {
  connection: ConnectionView
  onChange: () => void
}) {
  const p = useConnection(k, onChange, { card: true })
  return (
    <div className="flex min-w-0 flex-col gap-1 border-hair border-t pt-2">
      <div className="flex min-h-7 items-center gap-2">
        <StateDot state={p.state} says={p.says} />
        <span className="min-w-0 flex-1 truncate text-ink">
          {p.where ? `${k.account} · ${p.where}` : k.account}
        </span>
        {p.act}
        {p.menu}
      </div>
      {p.problem}
      {p.body}
      {p.confirm}
    </div>
  )
}

// A computer's folder, Calendar or Contacts, as a row on its page; or a connection whose connector
// is not loaded, under Connections. A folder goes by its own name, its path under it; the rest by
// their names.
const ROW_ICONS: Record<string, ReactNode> = {
  folder: <Folder className="size-4" />,
  calendar: <CalendarDays className="size-4" />,
  contacts: <UserRound className="size-4" />,
}
const isPath = (account: string) => /^([/~]|[A-Za-z]:\\|\\\\)/.test(account)

export function ConnectionLine({
  connection: k,
  onChange,
}: {
  connection: ConnectionView
  onChange: () => void
}) {
  const p = useConnection(k, onChange)
  return (
    <Row
      lead={<Tile>{ROW_ICONS[k.connector] ?? <Plug className="size-4" />}</Tile>}
      title={
        isPath(k.account) ? (k.account.split(/[\\/]/).filter(Boolean).at(-1) ?? k.account) : k.title
      }
      sub={
        <span className="flex flex-col gap-1">
          {isPath(k.account) && (
            <span className="truncate" {...cutTip(k.account)}>
              {k.account}
            </span>
          )}
          {p.problem}
          {p.body}
        </span>
      }
      actions={
        <>
          {p.pill}
          {p.act}
          {p.menu}
        </>
      }
    >
      {p.confirm}
    </Row>
  )
}
