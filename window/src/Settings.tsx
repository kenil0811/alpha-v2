// Settings (design §14): connections, folders, and kits with their agents. Connecting is the
// person's own act here: what they type goes to the Keychain, never to the model.
import type { ConnectionView, ConnectorsView, ConnectorView } from '@alpha/core/api'
import { CalendarDays, Folder, Mail, UserRound } from 'lucide-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react'
import { api, Problem } from './api.ts'
import { Kits, when } from './Kits.tsx'
import { Button } from './ui/button.tsx'
import { Field } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill, type Tone } from './ui/pill.tsx'
import { Section } from './ui/section.tsx'

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
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-8 py-7">
        <h1 className="text-2xl text-ink">Settings</h1>
        <Section
          title="Connections"
          about="Your accounts, read by Alpha; what you type stays in the Keychain."
        >
          <List>
            {accounts.map((c) => (
              <ConnectorRow
                key={c.name}
                connector={c}
                connections={view.connections.filter((k) => k.connector === c.name)}
                startOpen={open === c.name}
                onChange={load}
              />
            ))}
          </List>
        </Section>
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
        <Kits version={version} />
      </div>
    </div>
  )
}

function ConnectionLine({
  connection: k,
  onChange,
  indent,
}: {
  connection: ConnectionView
  onChange: () => void
  indent?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    await fn().catch(() => undefined)
    setBusy(false)
    onChange()
  }
  const [state, tone] = STATE[k.state]
  return (
    <Row
      indent={indent}
      lead={
        indent ? undefined : (
          <Tile>
            <Folder className="size-4" />
          </Tile>
        )
      }
      title={k.account}
      sub={
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
                onClick={() =>
                  act(() => api.post(`/api/tables/${t.id}/sidebar`, { shown: t.hidden }))
                }
              >
                {t.hidden ? 'Show in the sidebar' : 'Take out of the sidebar'}
              </button>
            </span>
          ))}
          {k.health && <span className="text-warn">{k.health}</span>}
        </span>
      }
      actions={
        <>
          <Pill tone={tone}>{state}</Pill>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => act(() => api.post(`/api/connections/${k.id}/sync`))}
          >
            Read now
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => act(() => api.delete(`/api/connections/${k.id}`))}
          >
            Disconnect
          </Button>
        </>
      }
    />
  )
}

function ConnectorRow({
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
    <>
      <Row
        lead={<Tile>{ICONS[c.name] ?? <Folder className="size-4" />}</Tile>}
        title={c.title}
        sub={connections.length ? undefined : 'Not connected'}
        actions={
          !open &&
          (connections.length === 0 || !system) && (
            <Button
              size="sm"
              variant={connections.length ? 'ghost' : 'default'}
              onClick={() => setOpen(true)}
            >
              {connections.length ? 'Add another' : 'Connect'}
            </Button>
          )
        }
      >
        {open && (
          <form onSubmit={submit} className="flex flex-col gap-3 px-4 pb-4 pl-15">
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
      </Row>
      {connections.map((k) => (
        <ConnectionLine key={k.id} connection={k} onChange={onChange} indent />
      ))}
    </>
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
