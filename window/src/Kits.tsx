// Settings › Kits and agents (design §10, §11): what each module does on its own, the sites its
// readers may read, and its agents, each on or paused. A kit is installed from a folder.
import type { AgentView, WorkingModuleView } from '@alpha/core/api'
import { Bot, Package } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { api, Problem } from './api.ts'
import { Button } from './ui/button.tsx'
import { Field } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { Section } from './ui/section.tsx'
import { Switch } from './ui/switch.tsx'

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
    <Section
      title="Kits and agents"
      about="What each module does on its own; a kit brings its tables, readers and agents."
    >
      {problem && <div className="text-bad text-md">{problem}</div>}
      {modules?.length === 0 && (
        <p className="text-ink-2 text-md">
          Nothing runs on its own yet. Agents made in a conversation show here too.
        </p>
      )}
      {modules?.map((m) => (
        <ModuleWork key={m.id} module={m} onChange={load} />
      ))}
      <KitForm onChange={load} />
    </Section>
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
    <List>
      <Row
        lead={
          <Tile>
            <Package className="size-4" />
          </Tile>
        }
        title={m.name}
        sub={
          <>
            <span>
              {m.kit ? `From the kit ${m.kit.name} ${m.kit.version}` : 'Made in a conversation'}
            </span>
            {m.network.length > 0 && (
              <details>
                <summary className="cursor-pointer">
                  Its readers may read{' '}
                  {m.network.length === 1 ? m.network[0] : `${m.network.length} sites`}
                </summary>
                <div className="mt-1 leading-5">{m.network.join(', ')}</div>
              </details>
            )}
            {said && <div className="text-ink-2">{said}</div>}
          </>
        }
        actions={
          m.kit && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={updateKit}>
              Update from its folder
            </Button>
          )
        }
      />
      {m.agents.map((a) => (
        <AgentLine key={a.id} agent={a} onChange={onChange} />
      ))}
    </List>
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
    <Row
      indent
      lead={<Bot className="size-4 text-ink-3" />}
      title={a.name}
      sub={`${a.state === 'on' ? 'Runs' : 'Would run'} ${a.when} · last ran ${when(a.lastRunAt)}`}
      actions={
        <>
          {a.running && <Pill tone="accent">Running</Pill>}
          <Button
            size="sm"
            disabled={busy || a.running}
            onClick={() => act(() => api.post(`/api/agents/${a.id}/run`))}
          >
            Run now
          </Button>
          <Switch
            checked={a.state === 'on'}
            label={a.state === 'on' ? `Pause ${a.name}` : `Turn on ${a.name}`}
            disabled={busy}
            onChange={(on) =>
              act(() => api.post(`/api/agents/${a.id}`, { state: on ? 'on' : 'paused' }))
            }
          />
        </>
      }
    />
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
        <Field
          className="flex-1"
          value={folder}
          placeholder="The kit's folder, like /Users/you/dev/alpha-avilo/dealpilot"
          onChange={(e) => setFolder(e.target.value)}
        />
        <Button type="submit" disabled={busy || !folder.trim()}>
          {busy ? 'Installing…' : 'Install kit'}
        </Button>
      </div>
      {problem && <div className="text-bad text-md">{problem}</div>}
    </form>
  )
}
