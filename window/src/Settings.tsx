// Settings (design §14): connections, folders, and kits with their agents. Connecting is the
// person's own act here: what they type goes to the Keychain, never to the model.
import type {
  ConnectionView,
  ConnectorsView,
  ConnectorView,
  InstructionView,
  ModelView,
  PermissionView,
} from '@alpha/core/api'
import {
  BookmarkCheck,
  CalendarDays,
  Folder,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react'
import { api, Problem } from './api.ts'
import { Kits, when } from './Kits.tsx'
import { SetupList, useSetup } from './SetupPanel.tsx'
import { applyTheme, savedTheme, type Theme } from './theme.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Field } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill, type Tone } from './ui/pill.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { Switch } from './ui/switch.tsx'

const STATE: Record<ConnectionView['state'], [string, Tone]> = {
  connected: ['Connected', 'good'],
  needs_sign_in: ['Needs you to sign in again', 'warn'],
  broken: ['Not working', 'bad'],
  paused: ['Paused', 'neutral'],
}

const ICONS: Record<string, ReactNode> = {
  gmail: <Mail className="size-4" />,
  calendar: <CalendarDays className="size-4" />,
  contacts: <UserRound className="size-4" />,
}

// The page's sections, in its index.
const SECTIONS = [
  ['mac', 'This Mac'],
  ['connections', 'Connections'],
  ['folders', 'Folders'],
  ['kits', 'Kits and agents'],
  ['remembered', 'Remembered'],
  ['permissions', 'Standing permissions'],
  ['model', 'Model'],
  ['appearance', 'Appearance'],
] as const

export function Settings({ open, version }: { open: string | null; version: number }) {
  const [view, setView] = useState<ConnectorsView | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const load = useCallback(() => {
    api
      .get<ConnectorsView>('/api/connectors')
      .then(setView, (e) =>
        setProblem(e instanceof Problem ? e.message : 'The core did not answer.'),
      )
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])

  if (!view) return <p className="p-6 text-ink-3">{problem ?? 'Loading…'}</p>
  const accounts = view.connectors.filter((c) => c.name !== 'folder')
  const folders = view.connections.filter((c) => c.connector === 'folder')
  const go = (id: string) =>
    document
      .getElementById(`settings-${id}`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-page grid-cols-[170px_1fr] gap-7 px-8 pt-7 pb-12">
        <nav className="sticky top-0 flex flex-col gap-px self-start pt-15.5">
          {SECTIONS.map(([id, name]) => (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              className="h-7 truncate whitespace-nowrap rounded-md px-2.5 text-left text-ink-2 text-md hover:bg-hover hover:text-ink"
            >
              {name}
            </button>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-8">
          <h1 className="text-2xl text-ink">Settings</h1>
          <div id="settings-connections" className="scroll-mt-4">
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
                    onChange={load}
                  />
                ))}
              </div>
            </Section>
          </div>
          <div id="settings-folders" className="scroll-mt-4">
            <Section
              title="Folders"
              about="What you put in one is kept and read, as if you dropped it in. Alpha never writes to them."
            >
              {folders.length > 0 && (
                <List>
                  {folders.map((k) => (
                    <ConnectionLine key={k.id} connection={k} onChange={load} />
                  ))}
                </List>
              )}
              <FolderForm onChange={load} startOpen={open === 'folder'} />
            </Section>
          </div>
          <div id="settings-kits" className="scroll-mt-4">
            <Kits version={version} />
          </div>
          <div id="settings-remembered" className="scroll-mt-4">
            <Remembered version={version} />
          </div>
          <div id="settings-mac" className="scroll-mt-4">
            <ThisMac />
          </div>
          <div id="settings-permissions" className="scroll-mt-4">
            <Standing version={version} />
          </div>
          <div id="settings-model" className="scroll-mt-4">
            <ModelSection />
          </div>
          <div id="settings-appearance" className="scroll-mt-4">
            <Appearance view={view} onChange={load} />
          </div>
        </div>
      </div>
    </div>
  )
}

// What Alpha remembers: the standing instructions the person gave, each one removable.
function Remembered({ version }: { version: number }) {
  const [lines, setLines] = useState<InstructionView[] | null>(null)
  const load = useCallback(() => {
    api.get<InstructionView[]>('/api/instructions').then(setLines, () => setLines([]))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const forget = (l: InstructionView) =>
    api.post('/api/instructions/remove', { for: l.for, words: l.words }).then(load, load)
  return (
    <Section
      title="What Alpha remembers"
      about="How you asked things to be done from now on; tell Alpha in a sentence to add one."
    >
      {lines?.length === 0 && (
        <p className="text-ink-2 text-md">Nothing yet. Say “from now on…” and it is kept here.</p>
      )}
      {lines && lines.length > 0 && (
        <List>
          {lines.map((l) => (
            <Row
              key={`${l.for}${l.words}`}
              lead={
                <Tile>
                  <BookmarkCheck className="size-4" />
                </Tile>
              }
              title={<span className="whitespace-normal font-normal">{l.words}</span>}
              sub={l.for === 'me' ? 'For you' : 'For everyone here'}
              actions={
                <Button size="sm" variant="warn" onClick={() => forget(l)}>
                  Forget
                </Button>
              }
            />
          ))}
        </List>
      )}
    </Section>
  )
}

// This Mac: Claude's sign-in, the readers' downloads, the connections, Chrome.
function ThisMac() {
  const [view, reload] = useSetup()
  return (
    <Section title="This Mac" about="What Alpha needs on this Mac, and whether it has it.">
      {view ? (
        <SetupList view={view} onChange={reload} />
      ) : (
        <p className="text-ink-2 text-md">This core does not say.</p>
      )}
    </Section>
  )
}

// Standing permissions (design §7): each as its sentence, who gave it and how often it has been
// used, with Revoke; a revoked one stays listed, greyed, as history.
function Standing({ version }: { version: number }) {
  const [list, setList] = useState<PermissionView[] | null>(null)
  const [asking, setAsking] = useState<string | null>(null)
  const load = useCallback(() => {
    api.get<PermissionView[]>('/api/permissions').then(setList, () => setList([]))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const revoke = (id: string) =>
    api.post(`/api/permissions/${id}/revoke`).then(() => {
      setAsking(null)
      load()
    }, load)
  return (
    <Section
      title="Standing permissions"
      about="What Alpha does without asking, because you said Always on a card. Revoke one and it asks again."
    >
      {list?.length === 0 && (
        <p className="text-ink-2 text-md">
          None yet. After three yeses in a row for the same thing, its card offers Always.
        </p>
      )}
      {list && list.length > 0 && (
        <List>
          {list.map((p) => (
            <Row
              key={p.id}
              lead={
                <Tile>
                  <ShieldCheck className="size-4" />
                </Tile>
              }
              title={
                <span
                  className={cn(
                    'whitespace-normal font-normal',
                    p.revokedAt && 'text-ink-3 line-through',
                  )}
                >
                  {p.sentence}
                </span>
              }
              sub={`${p.grantedBy}, ${when(p.grantedAt)} · used ${p.uses === 1 ? 'once' : `${p.uses} times`}${p.revokedAt ? ` · revoked ${when(p.revokedAt)}` : ''}`}
              actions={
                p.revokedAt ? null : asking === p.id ? (
                  <span className="flex gap-1.5">
                    <Button size="sm" variant="warn" onClick={() => revoke(p.id)}>
                      Revoke it
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
                      Keep it
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="warn" onClick={() => setAsking(p.id)}>
                    Revoke
                  </Button>
                )
              }
            />
          ))}
        </List>
      )}
    </Section>
  )
}

const MODEL_NAMES: Record<string, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
  'claude-haiku-5-5': 'Claude Haiku 5.5',
}

// The route (design §5): the person's own Claude subscription, signed in with Claude's own sign-in
// on this Mac, or the firm's API key, kept in the Keychain. The choice is this install's.
function ModelSection() {
  const [model, setModel] = useState<ModelView | null>(null)
  const [key, setKey] = useState('')
  const [asking, setAsking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    api.get<ModelView>('/api/model').then(setModel, () => setModel(null))
  }, [])
  const choose = (route: 'subscription' | 'key', given?: string) =>
    api.post<ModelView>('/api/model', { route, ...(given ? { key: given } : {}) }).then(
      (m) => {
        setModel(m)
        setKey('')
        setAsking(false)
        setProblem(null)
      },
      (err: unknown) => setProblem(err instanceof Problem ? err.message : 'That did not go in.'),
    )
  return (
    <Section title="Model" about="What Alpha thinks with, and how it reaches it.">
      {model && (
        <List>
          <Row
            lead={
              <Tile>
                <Sparkles className="size-4" />
              </Tile>
            }
            title={MODEL_NAMES[model.desk] ?? model.desk}
            sub={
              model.route === 'subscription'
                ? 'Through your own Claude subscription, signed in on this Mac'
                : 'Through the API key kept in the Keychain'
            }
            actions={
              model.route === 'subscription' ? (
                <Button size="sm" variant="ghost" onClick={() => setAsking(!asking)}>
                  Use an API key
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => choose('subscription')}>
                  Use my subscription
                </Button>
              )
            }
          />
        </List>
      )}
      {asking && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void choose('key', key)
          }}
        >
          <Field
            className="flex-1"
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={model?.hasKey ? 'The key kept in the Keychain, or a new one' : 'sk-ant-…'}
          />
          <Button type="submit" variant="primary" disabled={!key.trim() && !model?.hasKey}>
            Use it
          </Button>
        </form>
      )}
      {problem && <p className="text-bad text-sm">{problem}</p>}
    </Section>
  )
}

function Appearance({ view, onChange }: { view: ConnectorsView; onChange: () => void }) {
  const [theme, setTheme] = useState<Theme>(savedTheme)
  const tables = view.connections.flatMap((k) => k.tables)
  const shown = tables.some((t) => !t.hidden)
  const [busy, setBusy] = useState(false)
  const showTables = async (on: boolean) => {
    setBusy(true)
    for (const t of tables)
      await api.post(`/api/tables/${t.id}/sidebar`, { shown: on }).catch(() => undefined)
    setBusy(false)
    onChange()
  }
  return (
    <Section title="Appearance">
      <List>
        <Row
          title="Look"
          sub="Match Mac follows your Mac's light or dark setting."
          actions={
            <Segmented
              label="Look"
              value={theme}
              onChange={(t) => {
                setTheme(t)
                applyTheme(t)
                void api.post('/api/appearance', { theme: t }).catch(() => undefined)
              }}
              options={[
                { value: 'mac', label: 'Match Mac' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          }
        />
        {tables.length > 0 && (
          <Row
            title="Connection tables in the sidebar"
            sub="Mail, events and contacts that connections keep, shown with your own tables."
            actions={
              <Switch
                checked={shown}
                disabled={busy}
                label="Connection tables in the sidebar"
                onChange={showTables}
              />
            }
          />
        )}
      </List>
    </Section>
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
  const [busy, setBusy] = useState(false)
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    await fn().catch(() => undefined)
    setBusy(false)
    onChange()
  }
  const [state, tone] = STATE[k.state]
  const about = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>Last read {when(k.lastSyncAt)}</span>
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
      {k.health && <span className="text-warn">{k.health}</span>}
    </span>
  )
  const buttons = (
    <>
      {k.state === 'needs_sign_in' ? (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            window.location.hash = `#/settings?connect=${k.connector}`
          }}
        >
          Sign in
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => act(() => api.post(`/api/connections/${k.id}/sync`))}
        >
          Read now
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() => act(() => api.delete(`/api/connections/${k.id}`))}
      >
        Disconnect
      </Button>
    </>
  )
  if (inTile)
    return (
      <div className="flex flex-col gap-2 border-hair border-t pt-3">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{k.account}</span>
          <Pill tone={tone}>{state}</Pill>
        </div>
        <div className="text-ink-3 text-sm">{about}</div>
        <div className="flex flex-wrap gap-2">{buttons}</div>
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
    />
  )
}

// A connector as a tile: its accounts, each with its state and buttons, or Connect.
function ConnectorTile({
  connector: c,
  connections,
  startOpen,
  onChange,
}: {
  connector: ConnectorView
  connections: ConnectionView[]
  startOpen: boolean
  onChange: () => void
}) {
  const system = c.auth === 'system'
  const [open, setOpen] = useState(startOpen)
  const [account, setAccount] = useState(system ? 'This Mac' : '')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => setOpen(startOpen), [startOpen])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem(null)
    try {
      await api.post('/api/connections', {
        connector: c.name,
        account,
        ...(c.secret ? { secret } : {}),
      })
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
        'flex flex-col gap-3 rounded-lg border border-line bg-surface p-4',
        open && 'col-span-full',
      )}
    >
      <div className="flex items-center gap-3">
        <Tile>{ICONS[c.name] ?? <Folder className="size-4" />}</Tile>
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
      </div>
      {open && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          {system ? (
            <p className="text-ink-2 text-md">
              Your Mac will ask whether Alpha may read your {c.title.toLowerCase()}. Alpha only
              reads it.
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
          {problem && <div className="text-bad text-md">{problem}</div>}
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={busy || !account.trim() || (!!c.secret && !secret.trim())}
            >
              {busy ? 'Connecting…' : 'Connect'}
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

function FolderForm({ onChange, startOpen }: { onChange: () => void; startOpen: boolean }) {
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem(null)
    try {
      await api.post('/api/connections', { connector: 'folder', account: path.trim() })
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
          placeholder="/Users/you/Documents/Exports"
          onChange={(e) => setPath(e.target.value)}
        />
        <Button type="submit" disabled={busy || !path.trim()}>
          Add folder
        </Button>
      </div>
      {problem && <div className="text-bad text-md">{problem}</div>}
    </form>
  )
}
