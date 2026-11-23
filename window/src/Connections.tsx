// Settings' Connections: every mail, calendar and contacts account one line with one Add, as
// Connect has them, then a tile per other connector with its accounts, Excluded, the sign-in apps,
// and the folders. Connecting is the person's own act here: what they type goes to the Keychain, never to
// the model.
import type { ConnectionView, ConnectorsView, ConnectorView } from '@alpha/core/api'
import { CalendarDays, Folder, Mail, Network, Plug, Trash2, UserRound } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { AccountList, Excluded, useAccounts } from './AccountLines.tsx'
import { api, Problem, wordsOf } from './api.ts'
import { Computers } from './Computers.tsx'
import { ConnectionInTile, ConnectionLine, useConnection } from './ConnectionLine.tsx'
import { ThisComputer } from './SetupPanel.tsx'
import { SignInApps, signInWith } from './SignInApps.tsx'
import { Sites } from './Sites.tsx'
import { Button } from './ui/button.tsx'
import { Confirm } from './ui/dialog.tsx'
import { Field, SecretField } from './ui/field.tsx'
import { List } from './ui/list.tsx'
import { More } from './ui/more.tsx'
import { MenuItem } from './ui/popover.tsx'
import { Section } from './ui/section.tsx'
import { STATE_CARDS, StateCard } from './ui/state-card.tsx'

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
  owner,
  onChange,
}: {
  view: ConnectorsView
  open: string | null
  version: number
  owner: boolean // this computer's cards are the owner's
  onChange: () => void
}) {
  // a connector that names a place on a computer (a folder) is on that computer's page; every
  // other is a tile under Connections
  // mail, calendar and contacts are account lines with one Add, as in Set up Alpha's Connect
  // (AccountLines.tsx); every other connector a tile
  const lines = useAccounts(false)
  const isLine = (c: ConnectorView) =>
    ['outlook', 'gmail', 'google'].includes(c.name) || c.icon === 'mail'
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
        about="Your accounts and this computer, read by Alpha; what you type stays in the Keychain."
      >
        {view.connectors.some(isLine) && lines.view && (
          <div className="rounded-lg border border-line bg-surface px-4 py-3">
            <AccountList view={lines.view} connectors={view} onChange={again} />
          </div>
        )}
        <div className={STATE_CARDS}>
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
          {owner && <ThisComputer />}
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
        {lines.view && <Excluded items={lines.view.excluded} onChange={again} />}
      </Section>
      <SignInApps apps={view.signInApps} onChange={onChange} />
      <Sites version={version} />
      <Computers version={version} />
    </>
  )
}

// A connector as a small card (Vikas, 23 Nov): a dot for its state, its name and its one act on
// one line: Connect with no account, Disconnect with one that works, else what it needs. Two or
// more accounts list under the name, each the same way; its form opens across the whole row.
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
  const many = connections.length > 1
  const all = many && connections.every((k) => k.state === 'connected')
  return (
    <StateCard
      state={!many ? 'off' : all ? 'good' : 'warn'}
      says={!many ? 'Not connected' : all ? 'Connected' : 'One needs you'}
      title={c.title}
      sub={
        many
          ? `${connections.length} accounts`
          : c.onComputer
            ? 'Turn it on in Alpha Bridge on your computer'
            : null
      }
      act={
        <>
          {!open && canAdd && (
            <Button size="sm" variant={many ? 'ghost' : 'default'} onClick={() => setOpen(true)}>
              {many ? 'Add another' : 'Connect'}
            </Button>
          )}
          {added && !many && <DeleteConnector connector={c} onChange={onChange} />}
        </>
      }
      wide={open}
    >
      {form}
      {connections.map((k) => (
        <ConnectionInTile key={k.id} connection={k} onChange={onChange} />
      ))}
    </StateCard>
  )
}

// A connector with one account, the usual: its account under its name; Disconnect while it works,
// else what it needs (Sign in, Try again); Details, Read now and Add another under ⋮.
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
  const p = useConnection(k, onChange, { card: true, onAdd })
  return (
    <StateCard
      state={p.state}
      says={p.says}
      title={c.title}
      sub={p.where ? `${k.account} · ${p.where}` : k.account}
      act={
        <>
          {p.act}
          {p.menu}
        </>
      }
      wide={!!form}
    >
      {p.problem}
      {p.body}
      {form}
      {p.confirm}
    </StateCard>
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
        done={{ words: `${c.title} is deleted.` }}
        onClose={() => setRemoving(false)}
        onYes={async () => {
          setBusy(true)
          setProblem(null)
          try {
            await api.delete(`/api/connectors/${c.name}`)
            setRemoving(false)
          } catch (err) {
            setProblem(wordsOf(err))
            setBusy(false)
            return false
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
  account?: string // the address it is for, when it is known (Reconnect, Add mail on a line)
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
            : `Set up ${asPerson.title}’s sign-in app under Sign-in apps first.`}
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
