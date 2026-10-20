// Settings › Kits and agents (design §10, §11): what each module does on its own, the sites its
// readers may read, and its agents, each on or paused. A kit is installed from a folder.
import type { AgentView, WorkingModuleView } from '@alpha/core/api'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { api, Problem } from './api.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'

export function when(at: string | null): string {
  if (!at) return 'not yet'
  return new Date(at).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function Kits({ version }: { version: number }) {
  const [modules, setModules] = useState<WorkingModuleView[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const load = useCallback(() => {
    api
      .get<WorkingModuleView[]>('/api/working')
      .then(setModules, (e) =>
        setProblem(e instanceof Problem ? e.message : 'The core did not answer.'),
      )
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base text-ink-2">Kits and agents</h2>
      {problem && <div className="text-base text-bad">{problem}</div>}
      {modules?.length === 0 && (
        <p className="text-base text-ink-2">
          Nothing runs on its own yet. A kit brings its tables, readers and agents; agents made in a
          conversation show here too.
        </p>
      )}
      {modules?.map((m) => (
        <ModuleWork key={m.id} module={m} onChange={load} />
      ))}
      <KitForm onChange={load} />
    </section>
  )
}

function ModuleWork({ module: m, onChange }: { module: WorkingModuleView; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const updateKit = async () => {
    setBusy(true)
    setSaid(null)
    try {
      const r = await api.post<{ replaced: string[]; kept: string[]; added: string[] }>(
        `/api/kits/${m.id}/update`,
        {},
      )
      setSaid(
        `Updated: ${r.replaced.length + r.added.length} files from the kit${
          r.kept.length ? `; kept your changes to ${r.kept.join(', ')}` : ''
        }.`,
      )
    } catch (err) {
      setSaid(err instanceof Problem ? err.message : 'The kit was not updated.')
    } finally {
      setBusy(false)
      onChange()
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-ink">{m.name}</div>
          <div className="text-sm text-ink-2">
            {m.kit ? `From the kit ${m.kit.name} ${m.kit.version}` : 'Made in a conversation'}
          </div>
          {m.network.length > 0 && (
            <details className="text-sm text-ink-2">
              <summary className="cursor-pointer">
                Its readers may read{' '}
                {m.network.length === 1 ? m.network[0] : `${m.network.length} sites`}
              </summary>
              <div className="mt-1 leading-5">{m.network.join(', ')}</div>
            </details>
          )}
        </div>
        {m.kit && (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 whitespace-nowrap"
            disabled={busy}
            onClick={updateKit}
          >
            Update from its folder
          </Button>
        )}
      </div>
      {said && <div className="text-sm text-ink-2">{said}</div>}
      {m.agents.map((a) => (
        <AgentLine key={a.id} agent={a} onChange={onChange} />
      ))}
    </div>
  )
}

function AgentLine({ agent: a, onChange }: { agent: AgentView; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    await fn().catch(() => undefined)
    setBusy(false)
    onChange()
  }
  return (
    <div className="flex items-center justify-between gap-4 border-t border-hair pt-2">
      <div className="min-w-0">
        <div className="text-base text-ink">{a.name}</div>
        <div className={cn('text-sm', a.state === 'on' ? 'text-ink-2' : 'text-ink-3')}>
          {a.state === 'on' ? `Runs ${a.when}` : `Paused · would run ${a.when}`} · last ran{' '}
          {when(a.lastRunAt)}
          {a.running ? ' · running now' : ''}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || a.running}
          onClick={() => act(() => api.post(`/api/agents/${a.id}/run`))}
        >
          Run now
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            act(() =>
              api.post(`/api/agents/${a.id}`, { state: a.state === 'on' ? 'paused' : 'on' }),
            )
          }
        >
          {a.state === 'on' ? 'Pause' : 'Turn on'}
        </Button>
      </div>
    </div>
  )
}

function KitForm({ onChange }: { onChange: () => void }) {
  const [folder, setFolder] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem(null)
    try {
      await api.post('/api/kits', { folder: folder.trim() })
      setFolder('')
      onChange()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That kit was not installed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-line px-2 py-1.5 text-base outline-none focus:border-accent-line"
          value={folder}
          placeholder="The kit's folder, like /Users/you/dev/alpha-avilo/dealpilot"
          onChange={(e) => setFolder(e.target.value)}
        />
        <Button size="sm" variant="outline" disabled={busy || !folder.trim()}>
          {busy ? 'Installing…' : 'Install kit'}
        </Button>
      </div>
      {problem && <div className="text-base text-bad">{problem}</div>}
    </form>
  )
}
