// Settings › Kits and agents (design §10, §11): what each module does on its own, and its agents,
// each on or paused, folded under the module until opened. A kit is installed from a folder.
import type { AgentView, WorkingModuleView, YoursView } from '@alpha/core/api'
import { Bot, ChevronDown, ChevronRight, Package } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
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
  const [open, setOpen] = useState(false)
  const on = m.agents.filter((a) => a.state === 'on').length
  const Fold = open ? ChevronDown : ChevronRight
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
        title={
          m.agents.length ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="flex items-center gap-1.5 text-left"
            >
              {m.name}
              <Fold className="size-4 text-ink-3" />
            </button>
          ) : (
            m.name
          )
        }
        sub={
          <>
            <span>
              {m.kit
                ? `From the kit ${m.kit.name} ${m.kit.version} (API ${m.kit.api})${m.kit.maintainer ? `, maintained by ${m.kit.maintainer.name}` : ''}${m.kit.changes ? ` · ${m.kit.changes} change${m.kit.changes === 1 ? '' : 's'} of yours the maintainer has not seen` : ''}`
                : 'Made in a conversation'}
              {m.agents.length > 0 &&
                ` · ${m.agents.length === 1 ? 'one agent' : `${m.agents.length} agents`}, ${
                  on === m.agents.length ? (on === 1 ? 'on' : 'all on') : on ? `${on} on` : 'paused'
                }`}
            </span>
            {said && <div className="text-ink-2">{said}</div>}
          </>
        }
        actions={
          <>
            {m.agents.length > 1 && (
              <AllAgents moduleId={m.id} agents={m.agents} onChange={onChange} />
            )}
            {m.kit && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={updateKit}>
                Update from its folder
              </Button>
            )}
          </>
        }
      />
      {open && m.agents.map((a) => <AgentLine key={a.id} agent={a} onChange={onChange} />)}
      {open && m.kit && <Yours module={m} onChange={onChange} />}
    </List>
  )
}

// Every agent of a module on at once, or all paused once they are all on.
export function AllAgents({
  moduleId,
  agents,
  onChange,
}: {
  moduleId: string
  agents: AgentView[]
  onChange: () => void
}) {
  const [busy, setBusy] = useState(false)
  const allOn = agents.every((a) => a.state === 'on')
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await api
          .post(`/api/modules/${moduleId}/agents`, { state: allOn ? 'paused' : 'on' })
          .catch(() => undefined)
        setBusy(false)
        onChange()
      }}
    >
      {allOn ? 'Pause all' : 'Turn on all'}
    </Button>
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
      sub={
        <>
          {a.description && <div className="text-ink-2">{a.description}</div>}
          {`${a.state === 'on' ? 'Runs' : 'Would run'} ${a.when} · last ran ${when(a.lastRunAt)}`}
        </>
      }
      actions={
        <>
          {a.needs && <Pill tone="warn">{a.needs}</Pill>}
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

// What of the kit is the person's now (decision 3): each with the kit's version back, and the
// fields the kit no longer uses, each with its rows gone for good.
function Yours({ module: m, onChange }: { module: WorkingModuleView; onChange: () => void }) {
  const [yours, setYours] = useState<YoursView | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    api.get<YoursView>(`/api/kits/${m.id}/yours`).then(setYours, () => setYours(null))
  }, [m.id])
  useEffect(() => {
    load()
  }, [load])
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    await fn().catch(() => undefined)
    setBusy(false)
    load()
    onChange()
  }
  if (!yours) return null
  const back = (what: Record<string, string>) =>
    act(() => api.post(`/api/kits/${m.id}/yours/back`, what))
  const items = [
    ...yours.files.map((f) => ({
      key: `file:${f.path}`,
      words: `${f.path}, ${f.state === 'removed' ? 'removed' : 'changed'} by you`,
      back: () => back({ kind: 'file', path: f.path }),
    })),
    ...yours.rows.map((r) => ({
      key: `row:${r.id}`,
      words: `${r.name} in ${r.table}, a setup row you changed`,
      back: () => back({ kind: 'row', table: r.table, key: r.key }),
    })),
    ...yours.views.map((v) => ({
      key: `view:${v.id}`,
      words: `The view ${v.name} on ${v.table}, yours`,
      back: () => back({ kind: 'view', table: v.table, name: v.name }),
    })),
    ...yours.fields.map((f) => ({
      key: `field:${f.id}`,
      words: `The field ${f.name} in ${f.table}, added by you`,
      back: null,
    })),
  ]
  if (!items.length && !yours.removed.length) return null
  return (
    <>
      {items.map((it) => (
        <Row
          key={it.key}
          indent
          title={it.words}
          sub="Yours now; the kit's updates leave it alone"
          actions={
            it.back && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={it.back}>
                Take the kit's version back
              </Button>
            )
          }
        />
      ))}
      {yours.removed.map((f) => (
        <Row
          key={`removed:${f.fieldId}`}
          indent
          title={`${f.name} in ${f.table}: the kit no longer uses it`}
          sub={`${f.rows} row${f.rows === 1 ? '' : 's'} still hold a value under it`}
          actions={
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Remove ${f.name} from ${f.table} with its ${f.rows} value${f.rows === 1 ? '' : 's'}? This cannot be undone.`,
                  )
                )
                  act(() =>
                    api.post(`/api/kits/${m.id}/fields/remove`, {
                      table: f.table,
                      field: f.fieldId,
                    }),
                  )
              }}
            >
              Remove its rows
            </Button>
          }
        />
      ))}
    </>
  )
}

function KitForm({ onChange }: { onChange: () => void }) {
  const [folder, setFolder] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  // a kit pack sent as a file: installed, or its kit updated (what the person changed stays)
  const fromFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setProblem(null)
    try {
      const out = await api.uploadTo<{ words: string }>('/api/kits/pack', file)
      setSaid(out.words)
      onChange()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That kit was not installed.')
    } finally {
      setBusy(false)
    }
  }
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
          placeholder="The kit's folder, like /Users/you/dev/kits/deals"
          onChange={(e) => setFolder(e.target.value)}
        />
        <Button type="submit" disabled={busy || !folder.trim()}>
          {busy ? 'Installing…' : 'Install kit'}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => picker.current?.click()}>
          Install or update from a file
        </Button>
        <input
          ref={picker}
          type="file"
          accept=".alphakit"
          className="hidden"
          onChange={(e) => {
            void fromFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      {said && <div className="text-ink-2 text-md">{said}</div>}
      {problem && <div className="text-bad text-md">{problem}</div>}
    </form>
  )
}
