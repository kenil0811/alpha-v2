// Settings' Connections: every mail, calendar and contacts account one line with one Add, as Set
// up Alpha's Your accounts has them, then a tile per other connector with its accounts, the apps
// left out, the sign-in apps, and the
// folders. Connecting is the person's own act here: what they type goes to the Keychain, never to
// the model.
import type { ConnectionView, ConnectorsView, ConnectorView } from '@alpha/core/api'
import { CalendarDays, Folder, Mail, Network, Plug, Trash2, UserRound } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { AccountList, Excluded, useAccounts } from './AccountLines.tsx'
import { api, Problem, wordsOf } from './api.ts'
import { Computers } from './Computers.tsx'
import { ConnectionInTile, ConnectionLine, TileFoot, useConnection } from './ConnectionLine.tsx'
import { SignInApps, signInWith } from './SignInApps.tsx'
import { Sites } from './Sites.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { cutTip } from './ui/cut-tip.ts'
import { Confirm } from './ui/dialog.tsx'
import { Field, SecretField } from './ui/field.tsx'
import { List, Tile } from './ui/list.tsx'
import { More } from './ui/more.tsx'
import { MenuItem } from './ui/popover.tsx'
import { Section } from './ui/section.tsx'
import { updatedWords } from './ui/update-now.tsx'

// The pictures a connector can ask for (its manifest's icon).
export const ICONS: Record<ConnectorView['icon'], ReactNode> = {
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
  version,
  onChange,
}: {
  view: ConnectorsView
  open: string | null
  version: number
  onChange: () => void
}) {
  // a connector that names a place on a computer (a folder) is on that computer's page; mail,
  // calendar and contacts are account lines (AccountLines.tsx); every other is a tile
  const lines = useAccounts(false)
  const isLine = (c: ConnectorView) =>
    c.auth !== 'path' && (['outlook', 'gmail', 'google'].includes(c.name) || c.icon === 'mail')
  const accounts = view.connectors.filter((c) => c.auth !== 'path' && !isLine(c))
  const again = () => {
    onChange()
    lines.load()
  }
  // asked to connect a folder (a module's setup): Alpha's own computer's page, where one is added
  const here = view.connectors.some((c) => c.auth === 'path' && c.name === open && !c.onComputer)
  useEffect(() => {
    if (here) window.location.replace('#/computer/here')
  }, [here])
  // a connection whose connector is not loaded (its pack not added yet): shown, waiting
  const orphans = view.connections.filter((k) => !k.loaded)
  return (
    <>
      <Section
        title="Connections"
        about="Your accounts, read by Alpha; what you type stays in the Keychain."
      >
        {view.connectors.some(isLine) && lines.view && (
          <div className="rounded-lg border border-line bg-surface px-4 py-3">
            <AccountList view={lines.view} connectors={view} onChange={again} />
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] items-start gap-3">
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
            The connection added from {f.folder.split('/').pop()} didn't load: {f.why}
          </div>
        ))}
        {lines.view && <Excluded apps={lines.view.left} onChange={again} />}
      </Section>
      <SignInApps apps={view.signInApps} onChange={onChange} />
      <Sites version={version} />
      <Computers version={version} />
    </>
  )
}

// A connector as a tile, every one the same shape: its icon, name and account (or Not connected)
// at the top with its state and ⋮ at the right, then any problem, then its one act at the foot,
// Connect or Read now. Two or more accounts list under the top, each the same way.
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
  const [open, setOpen] = useState(startOpen)
  useEffect(() => setOpen(startOpen), [startOpen])
  // another account: not for what the Mac or a computer holds once (its Calendar)
  const canAdd = !c.onComputer && (connections.length === 0 || c.auth !== 'system')
  const form = open ? (
    <ConnectForm
      connector={c}
      appSet={appSet}
      onDone={() => {
        setOpen(false)
        onChange()
      }}
      onCancel={() => setOpen(false)}
    />
  ) : null
  const [solo] = connections
  if (solo && connections.length === 1)
    return (
      <SoloTile
        connector={c}
        connection={solo}
        form={form}
        onAdd={canAdd ? () => setOpen(true) : undefined}
        onChange={onChange}
      />
    )
  return (
    <TileFrame
      connector={c}
      wide={open}
      sub={
        connections.length > 1
          ? `${connections.length} accounts`
          : c.onComputer
            ? 'Turn it on in Alpha Bridge on your computer'
            : 'Not connected'
      }
      right={
        <span className="flex shrink-0 items-center gap-1.5">
          {/* none connected yet: Connect at the right of its one row, never a foot of its own */}
          {!open && canAdd && connections.length === 0 && (
            <Button size="sm" onClick={() => setOpen(true)}>
              Connect
            </Button>
          )}
          {added && connections.length === 0 && (
            <DeleteConnector connector={c} onChange={onChange} />
          )}
        </span>
      }
    >
      {form}
      {connections.map((k) => (
        <ConnectionInTile key={k.id} connection={k} onChange={onChange} />
      ))}
      {!open && canAdd && connections.length > 0 && (
        <TileFoot>
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            Add another
          </Button>
        </TileFoot>
      )}
    </TileFrame>
  )
}

// The one shape every tile has: icon, name and a line under it, what sits at the right, then the
// rest; a tile with its form open takes the whole width.
function TileFrame({
  connector: c,
  sub,
  right,
  wide,
  children,
}: {
  connector: ConnectorView
  sub: string
  right?: ReactNode
  wide: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface px-3.5 py-3',
        wide && 'col-span-full',
      )}
    >
      <div className="flex items-center gap-3">
        <Tile>{ICONS[c.icon] ?? ICONS.plug}</Tile>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-base text-ink">{c.title}</div>
          <div className="truncate text-ink-3 text-sm" {...cutTip(sub)}>
            {sub}
          </div>
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

// A connector with one account, the usual: the account under its name, its state and ⋮ at the
// right, its problem, and Read now at the foot.
function SoloTile({
  connector: c,
  connection: k,
  form,
  onAdd,
  onChange,
}: {
  connector: ConnectorView
  connection: ConnectionView
  form: ReactNode
  onAdd: (() => void) | undefined
  onChange: () => void
}) {
  const p = useConnection(k, onChange, { menuShown: true, onAdd, words: false, quiet: true })
  // under its name: its account and when it was last read, or its problem in their place, so every
  // card is the same one row; its notes are under ⋮ › Details
  const read = k.lastSyncAt ? `Read ${updatedWords(k.lastSyncAt)}` : null
  return (
    <TileFrame
      connector={c}
      sub={k.health ?? [k.account, p.where, read].filter(Boolean).join(' · ')}
      wide={!!form}
      right={
        <span className="flex shrink-0 items-center gap-1.5">
          {/* connected says itself by when it was read; any other state by its pill */}
          {(k.state !== 'connected' || (k.computer && !k.computer.online)) && p.pill}
          {!form && p.act}
          {p.menu}
        </span>
      }
    >
      {/* its one row; its notes only when Details is asked for under ⋮ */}
      {form ?? p.body}
      {p.confirm}
    </TileFrame>
  )
}

// A connector the person added themselves, with no account: Delete under its ⋮.
function DeleteConnector({
  connector: c,
  onChange,
}: {
  connector: ConnectorView
  onChange: () => void
}) {
  const [removing, setRemoving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  return (
    <>
      <More label="More" disabled={busy} shown>
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
        The connection you added goes, with its files. It can’t be brought back.
        {problem && <span className="mt-2 block text-bad">{problem}</span>}
      </Confirm>
    </>
  )
}

// Connecting an account: its address (or what the Mac asks), a password where it takes one, or
// the provider's own sign-in page. In Settings and in place on Set up Alpha's tiles.
export function ConnectForm({
  connector: c,
  appSet,
  account: given,
  onDone,
  onCancel,
}: {
  connector: ConnectorView
  appSet: boolean | null
  account?: string // the address it is for, when it is known (Connect again, Add mail on a line)
  onDone: () => void
  onCancel: () => void
}) {
  const system = c.auth === 'system'
  const inBrowser = c.auth === 'browser'
  const asPerson = c.signsInWith ?? null
  const [account, setAccount] = useState(
    given ??
      (system
        ? (c.account.placeholder ?? c.account.label)
        : inBrowser
          ? (c.account.placeholder ?? c.name)
          : ''),
  )
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

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
      onDone()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not connect.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {system ? (
        <p className="text-ink-2 text-md">
          Your Mac will ask whether Alpha may read your {c.title.toLowerCase()}. Alpha only reads
          it.
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
          <SecretField
            id={`${c.name}-secret`}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
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
          disabled={busy || !account.trim() || (!!c.secret && !secret.trim()) || appSet === false}
        >
          {busy
            ? 'Connecting…'
            : inBrowser
              ? 'Sign in with Chrome'
              : asPerson
                ? `Sign in with ${asPerson.title}`
                : 'Connect'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
