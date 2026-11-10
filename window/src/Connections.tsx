// Intelligence's Connections: a tile per connector with its accounts, the sign-in apps, and the
// folders. Connecting is the person's own act here: what they type goes to the Keychain, never to
// the model.
import type { ConnectionView, ConnectorsView, ConnectorView } from '@alpha/core/api'
import { CalendarDays, Folder, Mail, Network, Plug, Trash2, Unplug, UserRound } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { api, Problem, wordsOf } from './api.ts'
import { Reach } from './Reach.tsx'
import { SignInApps, signInWith } from './SignInApps.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Confirm } from './ui/dialog.tsx'
import { Field } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { More } from './ui/more.tsx'
import { Pill, type Tone } from './ui/pill.tsx'
import { MenuItem } from './ui/popover.tsx'
import { Section } from './ui/section.tsx'
import { UpdateNow } from './ui/update-now.tsx'

const STATE: Record<ConnectionView['state'], [string, Tone]> = {
  connected: ['Connected', 'good'],
  needs_sign_in: ['Needs you to sign in', 'warn'],
  broken: ['Not working', 'bad'],
  paused: ['Paused', 'neutral'],
  waiting: ['Waiting for the customer', 'warn'],
}

// The pictures a connector can ask for (its manifest's icon).
const ICONS: Record<ConnectorView['icon'], ReactNode> = {
  mail: <Mail className="size-4" />,
  calendar: <CalendarDays className="size-4" />,
  people: <UserRound className="size-4" />,
  network: <Network className="size-4" />,
  folder: <Folder className="size-4" />,
  plug: <Plug className="size-4" />,
}

export function Connections({
  view,
  open,
  onChange,
}: {
  view: ConnectorsView
  open: string | null
  onChange: () => void
}) {
  // a connector that names a place on this Mac (a folder) is a list under Folders; every other
  // is a tile under Connections
  const accounts = view.connectors.filter((c) => c.auth !== 'path')
  const places = view.connectors.filter((c) => c.auth === 'path')
  const folders = view.connections.filter((k) => places.some((c) => c.name === k.connector))
  // a connection whose connector is not loaded (its pack not added yet): shown, waiting
  const orphans = view.connections.filter((k) => !k.loaded)
  return (
    <>
      <Section
        title="Connections"
        about="Your accounts, read by Alpha; what you type stays in the Keychain."
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {accounts.map((c) => (
            <ConnectorTile
              key={c.name}
              connector={c}
              connections={view.connections.filter((k) => k.connector === c.name)}
              startOpen={open === c.name}
              added={view.added.includes(c.name)}
              appSet={
                c.signsInWith
                  ? !!view.signInApps.find((a) => a.provider === c.signsInWith?.provider)?.set
                  : null
              }
              onChange={onChange}
            />
          ))}
        </div>
        {orphans.length > 0 && (
          <List>
            {orphans.map((k) => (
              <ConnectionLine key={k.id} connection={k} onChange={onChange} />
            ))}
          </List>
        )}
        {view.failed.map((f) => (
          <div key={f.folder} className="text-bad text-md">
            The connector in {f.folder} did not load: {f.why}
          </div>
        ))}
      </Section>
      <SignInApps apps={view.signInApps} onChange={onChange} />
      <Section
        title="Folders"
        about="What you put in one is kept and read, as if you dropped it in. Alpha never writes to them."
      >
        {folders.length > 0 && (
          <List>
            {folders.map((k) => (
              <ConnectionLine key={k.id} connection={k} onChange={onChange} />
            ))}
          </List>
        )}
        {places.map((c) => (
          <FolderForm key={c.name} connector={c} onChange={onChange} startOpen={open === c.name} />
        ))}
      </Section>
    </>
  )
}

// A connection: a row in the folders' list, or a block in its connector's tile.
function ConnectionLine({
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
  const [state, tone] = STATE[k.state]
  const about = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>Set up by {k.owner}</span>
      {k.tables.map((t) => (
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
            onClick={() => act(() => api.post(`/api/tables/${t.id}/sidebar`, { shown: t.hidden }))}
          >
            {t.hidden ? 'Show in the sidebar' : 'Take out of the sidebar'}
          </button>
        </span>
      ))}
      {k.health && <Pill tone="warn">{k.health}</Pill>}
      <Reach connection={k} busy={busy} act={act} />
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
      <div className="group/row flex flex-col gap-2 border-hair border-t pt-3">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{k.account}</span>
          <Pill tone={tone}>{state}</Pill>
        </div>
        <div className="text-ink-3 text-sm">{about}</div>
        <div className="flex flex-wrap gap-2">{buttons}</div>
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
      sub={about}
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

// A connector as a tile: its accounts, each with its state and buttons, or Connect.
function ConnectorTile({
  connector: c,
  connections,
  startOpen,
  added,
  appSet,
  onChange,
}: {
  connector: ConnectorView
  connections: ConnectionView[]
  startOpen: boolean
  added: boolean // loaded from Alpha's own connectors/: it can be removed again
  appSet: boolean | null // signed in as the person: whether the organisation's sign-in app is set
  onChange: () => void
}) {
  const system = c.auth === 'system'
  const inBrowser = c.auth === 'browser'
  const asPerson = c.signsInWith ?? null
  const [open, setOpen] = useState(startOpen)
  const [account, setAccount] = useState(
    system
      ? (c.account.placeholder ?? c.account.label)
      : inBrowser
        ? (c.account.placeholder ?? c.name)
        : '',
  )
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  useEffect(() => setOpen(startOpen), [startOpen])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem(null)
    try {
      const made = await api.post<{ id: string; state: string }>('/api/connections', {
        connector: c.name,
        account,
        ...(c.secret ? { secret } : {}),
      })
      // a site read as the person: they sign in themselves, in its own window of Chrome; signed
      // in as the person: on the provider's own page, in their browser
      if (inBrowser && made.state === 'needs_sign_in')
        await api.post(`/api/connections/${made.id}/sign-in`)
      if (asPerson && made.state === 'needs_sign_in') await signInWith(made.id)
      setSecret('')
      setOpen(false)
      onChange()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not connect.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'group/row flex flex-col gap-3 rounded-lg border border-line bg-surface p-4',
        open && 'col-span-full',
      )}
    >
      <div className="flex items-center gap-3">
        <Tile>{ICONS[c.icon] ?? ICONS.plug}</Tile>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-base text-ink">{c.title}</div>
          {connections.length === 0 && <div className="text-ink-3 text-sm">Not connected</div>}
        </div>
        {!open && (connections.length === 0 || !system) && (
          <Button
            size="sm"
            variant={connections.length ? 'ghost' : 'default'}
            onClick={() => setOpen(true)}
          >
            {connections.length ? 'Add another' : 'Connect'}
          </Button>
        )}
        {!open && added && connections.length === 0 && (
          <More label="More" disabled={busy}>
            {(close) => (
              <MenuItem
                danger
                onClick={() => {
                  close()
                  setRemoving(true)
                }}
              >
                <Trash2 className="size-3.5" />
                Delete
              </MenuItem>
            )}
          </More>
        )}
        <Confirm
          open={removing}
          title={`Delete ${c.title}?`}
          yes="Delete it"
          busy={busy}
          onClose={() => setRemoving(false)}
          onYes={async () => {
            setBusy(true)
            setProblem(null)
            try {
              await api.delete(`/api/connectors/${c.name}`)
              setRemoving(false)
            } catch (err) {
              setProblem(wordsOf(err))
            }
            setBusy(false)
            onChange()
          }}
        >
          The connector you added goes, with its folder. It can’t be brought back.
        </Confirm>
      </div>
      {open && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          {system ? (
            <p className="text-ink-2 text-md">
              Your Mac will ask whether Alpha may read your {c.title.toLowerCase()}. Alpha only
              reads it.
            </p>
          ) : inBrowser ? (
            <p className="text-ink-2 text-md">
              {c.warning ??
                `${c.title} opens in its own window of Google Chrome: sign in there yourself, then quit that Chrome. Alpha reads it as you would and never writes to it.`}
            </p>
          ) : (
            <label className="flex flex-col gap-1 text-md" htmlFor={`${c.name}-account`}>
              <span className="text-ink-2">{c.account.label}</span>
              <Field
                id={`${c.name}-account`}
                value={account}
                placeholder={c.account.placeholder}
                onChange={(e) => setAccount(e.target.value)}
                autoComplete="username"
              />
            </label>
          )}
          {asPerson && (
            <p className="text-ink-3 text-sm">
              {appSet
                ? `${asPerson.title}’s sign-in page opens in your browser. Sign in there as this address; Alpha never sees your password.`
                : `Set up ${asPerson.title}’s sign-in app under Sign-in apps first, with your IT if you are not its admin.`}
            </p>
          )}
          {c.secret && (
            <label className="flex flex-col gap-1 text-md" htmlFor={`${c.name}-secret`}>
              <span className="text-ink-2">{c.secret.label}</span>
              <Field
                id={`${c.name}-secret`}
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="off"
              />
              <span className="text-ink-3 text-sm">
                {c.secret.help}{' '}
                {c.secret.url && (
                  <a
                    className="text-accent underline underline-offset-3"
                    href={c.secret.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Make one
                  </a>
                )}
              </span>
            </label>
          )}
          {problem && (
            <div className="flex flex-wrap items-center gap-2 text-bad text-md">
              <span>{problem}</span>
              {c.system && problem.includes('System Settings') && (
                <Button
                  size="sm"
                  onClick={() => api.post('/api/setup/settings', { pane: c.system?.pane })}
                >
                  Open System Settings
                </Button>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={
                busy || !account.trim() || (!!c.secret && !secret.trim()) || appSet === false
              }
            >
              {busy
                ? 'Connecting…'
                : inBrowser
                  ? 'Sign in with Chrome'
                  : asPerson
                    ? `Sign in with ${asPerson.title}`
                    : 'Connect'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {connections.map((k) => (
        <ConnectionLine key={k.id} connection={k} onChange={onChange} inTile />
      ))}
    </div>
  )
}

function FolderForm({
  connector: c,
  onChange,
  startOpen,
}: {
  connector: ConnectorView
  onChange: () => void
  startOpen: boolean
}) {
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem(null)
    try {
      await api.post('/api/connections', { connector: c.name, account: path.trim() })
      setPath('')
      onChange()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That folder was not added.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Field
          className="flex-1"
          value={path}
          autoFocus={startOpen}
          placeholder={c.account.placeholder}
          onChange={(e) => setPath(e.target.value)}
        />
        <Button type="submit" disabled={busy || !path.trim()}>
          Add {c.title.toLowerCase()}
        </Button>
      </div>
      {problem && <div className="text-bad text-md">{problem}</div>}
    </form>
  )
}
