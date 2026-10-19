// Settings (design §14): connections and folders. Connecting is the person's own act here: what
// they type goes to the Keychain, never to the model.
import type { ConnectionView, ConnectorsView, ConnectorView } from '@alpha/core/api'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { api, Problem } from './api.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'

const STATE: Record<ConnectionView['state'], string> = {
  connected: 'Connected',
  needs_sign_in: 'Needs you to sign in again',
  broken: 'Not working',
  paused: 'Paused',
}

function when(at: string | null): string {
  if (!at) return 'not yet'
  return new Date(at).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
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

  if (!view) return <p className="p-6 text-neutral-400">{problem ?? 'Loading…'}</p>
  const accounts = view.connectors.filter((c) => c.name !== 'folder')
  const folders = view.connections.filter((c) => c.connector === 'folder')
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-8">
        <h1 className="text-lg text-neutral-900">Settings</h1>
        <section className="flex flex-col gap-3">
          <h2 className="text-sm text-neutral-500">Connections</h2>
          {accounts.map((c) => (
            <ConnectorRow
              key={c.name}
              connector={c}
              connections={view.connections.filter((k) => k.connector === c.name)}
              startOpen={open === c.name}
              onChange={load}
            />
          ))}
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-sm text-neutral-500">Folders</h2>
          <p className="text-sm text-neutral-500">
            What you put in a folder here is kept and read, as if you dropped it in. Alpha reads
            these folders and never writes to them.
          </p>
          {folders.map((k) => (
            <ConnectionLine key={k.id} connection={k} onChange={load} />
          ))}
          <FolderForm onChange={load} startOpen={open === 'folder'} />
        </section>
      </div>
    </div>
  )
}

function ConnectionLine({
  connection: k,
  onChange,
}: {
  connection: ConnectionView
  onChange: () => void
}) {
  const [busy, setBusy] = useState(false)
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    await fn().catch(() => undefined)
    setBusy(false)
    onChange()
  }
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-neutral-200 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-neutral-900">{k.account}</div>
        <div
          className={cn('text-xs', k.state === 'connected' ? 'text-neutral-500' : 'text-amber-700')}
        >
          {STATE[k.state]} · last read {when(k.lastSyncAt)}
        </div>
        {k.health && <div className="mt-1 text-xs text-amber-700">{k.health}</div>}
        {k.tables.map((t) => (
          <div key={t.id} className="mt-1 text-xs text-neutral-500">
            Kept in{' '}
            <a className="underline" href={`#/table/${t.id}`}>
              {t.name}
            </a>
            {' · '}
            <button
              type="button"
              className="underline"
              disabled={busy}
              onClick={() =>
                act(() => api.post(`/api/tables/${t.id}/sidebar`, { shown: t.hidden }))
              }
            >
              {t.hidden ? 'Show in the sidebar' : 'Take out of the sidebar'}
            </button>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          size="sm"
          variant="outline"
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
      </div>
    </div>
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-neutral-900">{c.title}</span>
        {!open && (connections.length === 0 || !system) && (
          <Button
            size="sm"
            variant={connections.length ? 'ghost' : 'outline'}
            onClick={() => setOpen(true)}
          >
            {connections.length ? 'Add another' : 'Connect'}
          </Button>
        )}
      </div>
      {connections.map((k) => (
        <ConnectionLine key={k.id} connection={k} onChange={onChange} />
      ))}
      {open && (
        <form
          onSubmit={submit}
          className="flex flex-col gap-2 rounded-lg border border-neutral-200 px-4 py-3"
        >
          {system ? (
            <p className="text-sm text-neutral-600">
              Your Mac will ask whether Alpha may read your {c.title.toLowerCase()}. Alpha only
              reads it.
            </p>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">{c.account.label}</span>
              <input
                className="rounded-md border border-neutral-200 px-2 py-1.5 outline-none focus:border-neutral-400"
                value={account}
                placeholder={c.account.placeholder}
                onChange={(e) => setAccount(e.target.value)}
                autoComplete="username"
              />
            </label>
          )}
          {c.secret && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">{c.secret.label}</span>
              <input
                type="password"
                className="rounded-md border border-neutral-200 px-2 py-1.5 outline-none focus:border-neutral-400"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="off"
              />
              <span className="text-xs text-neutral-500">
                {c.secret.help}{' '}
                {c.secret.url && (
                  <a className="underline" href={c.secret.url} target="_blank" rel="noreferrer">
                    Make one
                  </a>
                )}
              </span>
            </label>
          )}
          {problem && <div className="text-sm text-red-600">{problem}</div>}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || !account.trim() || (!!c.secret && !secret.trim())}>
              {busy ? 'Connecting…' : 'Connect'}
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
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
        <input
          className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-neutral-400"
          value={path}
          // biome-ignore lint/a11y/noAutofocus: opened from a card asking for it
          autoFocus={startOpen}
          placeholder="/Users/you/Documents/Exports"
          onChange={(e) => setPath(e.target.value)}
        />
        <Button size="sm" variant="outline" disabled={busy || !path.trim()}>
          Add folder
        </Button>
      </div>
      {problem && <div className="text-sm text-red-600">{problem}</div>}
    </form>
  )
}
