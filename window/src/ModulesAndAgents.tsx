// Settings › Modules (design §10, §11): what each module does on its own, and its
// agents, each on or paused, folded under the module until opened. A module is installed from a
// folder or a file. The core calls a module's package a kit; a person never reads that word.
import type { AgentView, WorkingModuleView, YoursView } from '@alpha/core/api'
import { ChevronDown, ChevronRight, Package } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { api, Problem, wordsOf } from './api.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Confirm } from './ui/dialog.tsx'
import { Field } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Empty, Section } from './ui/section.tsx'

export function when(at: string | null): string {
  if (!at) return 'not yet'
  return new Date(at).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ModulesAndAgents({ version }: { version: number }) {
  const [modules, setModules] = useState<WorkingModuleView[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const load = useCallback(() => {
    api.get<WorkingModuleView[]>('/api/working').then(setModules, (e) => setProblem(wordsOf(e)))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])

  return (
    <Section
      title="Modules"
      about="Where each module comes from: install one, update it, or pack it to install elsewhere."
    >
      {problem && <div className="text-bad text-md">{problem}</div>}
      {modules?.length === 0 && (
        <Empty>
          Nothing configured yet. Modules you install or make in a conversation show here.
        </Empty>
      )}
      {modules?.map((m) => (
        <ModuleWork key={m.id} module={m} onChange={load} />
      ))}
      <InstallModule onChange={load} />
    </Section>
  )
}

function ModuleWork({ module: m, onChange }: { module: WorkingModuleView; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const on = m.agents.filter((a) => a.state === 'on').length
  const Fold = open ? ChevronDown : ChevronRight
  const updateModule = async () => {
    setBusy(true)
    setSaid(null)
    try {
      const r = await api.post<{ replaced: string[]; kept: string[]; added: string[] }>(
        `/api/kits/${m.id}/update`,
        {},
      )
      setSaid(
        `Updated: ${r.replaced.length + r.added.length} files from the module${
          r.kept.length ? `; kept your changes to ${r.kept.join(', ')}` : ''
        }.`,
      )
    } catch (err) {
      setSaid(err instanceof Problem ? err.message : 'The module was not updated.')
    } finally {
      setBusy(false)
      onChange()
    }
  }
  // the module as a file on the Desktop, to install on another Mac: made from its shape when it
  // came from none, packed as it is now when it came from one
  const packModule = async () => {
    setBusy(true)
    setSaid(null)
    try {
      const r = await api.post<{ file: string; words: string }>(`/api/kits/${m.id}/make`, {})
      setSaid(r.words)
    } catch (err) {
      setSaid(err instanceof Problem ? err.message : 'The module was not packed.')
    } finally {
      setBusy(false)
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
          m.kit ? (
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
              {origin(m)}
              {m.agents.length > 0 &&
                ` · ${m.agents.length === 1 ? 'one agent' : `${m.agents.length} agents`}, ${
                  on === m.agents.length ? (on === 1 ? 'on' : 'all on') : on ? `${on} on` : 'paused'
                }`}
            </span>
            {said && <div className="text-ink-2">{said}</div>}
          </>
        }
      >
        {/* under the name, not beside it: Settings' column is too narrow for three buttons */}
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pl-15">
          {m.agents.length > 1 && (
            <AllAgents moduleId={m.id} agents={m.agents} onChange={onChange} />
          )}
          {m.kit && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={updateModule}>
              Update from its folder
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={busy} onClick={packModule}>
            {m.kit ? 'Pack it as it is now' : 'Pack it to install elsewhere'}
          </Button>
        </div>
      </Row>
      {open && m.kit && <Yours module={m} onChange={onChange} />}
    </List>
  )
}

// Where a module came from: Alpha's own, installed (with its version and maintainer), or made in a
// conversation.
function origin(m: WorkingModuleView): string {
  const from = m.kit
  if (!from) return 'Made in a conversation'
  if (from.core)
    return `Alpha's own, version ${from.version}: kept up to date by Alpha; its agents can be paused`
  const by = from.maintainer ? `, maintained by ${from.maintainer.name}` : ''
  const unseen = from.changes
    ? ` · ${from.changes} change${from.changes === 1 ? '' : 's'} of yours the maintainer has not seen`
    : ''
  return `From ${from.name}, version ${from.version} (API ${from.api})${by}${unseen}`
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
  const { busy, problem, act } = useAct(onChange)
  const allOn = agents.every((a) => a.state === 'on')
  return (
    <>
      <Refusal words={problem} />
      <Button
        size="sm"
        disabled={busy}
        onClick={() =>
          act(() => api.post(`/api/modules/${moduleId}/agents`, { state: allOn ? 'paused' : 'on' }))
        }
      >
        {allOn ? 'Pause all' : 'Turn on all'}
      </Button>
    </>
  )
}

// What of an installed module is the person's now (decision 3): each with the installed version
// back, and the fields the module no longer uses, each with its values gone for good.
function Yours({ module: m, onChange }: { module: WorkingModuleView; onChange: () => void }) {
  const [yours, setYours] = useState<YoursView | null>(null)
  const [asking, setAsking] = useState<string | null>(null)
  const load = useCallback(() => {
    api.get<YoursView>(`/api/kits/${m.id}/yours`).then(setYours, () => setYours(null))
  }, [m.id])
  useEffect(() => {
    load()
  }, [load])
  const { busy, problem, act } = useAct(() => {
    load()
    onChange()
  })
  if (!yours) return null
  const back = (what: Record<string, string>) =>
    act(() => api.post(`/api/kits/${m.id}/yours/back`, what))
  const items = [
    ...yours.files.map((f) => ({
      key: `file:${f.path}`,
      words: `${f.path}, ${f.state === 'removed' ? 'deleted' : 'changed'} by you`,
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
  const gone = yours.removed.find((f) => f.fieldId === asking)
  return (
    <>
      {problem && <Row indent title={<Refusal words={problem} />} />}
      {items.map((it) => (
        <Row
          key={it.key}
          indent
          title={it.words}
          sub="Yours now; the module's updates leave it alone"
          actions={
            it.back && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={it.back}>
                Take the module's version back
              </Button>
            )
          }
        />
      ))}
      {yours.removed.map((f) => (
        <Row
          key={`gone-${f.fieldId}`}
          indent
          title={`${f.name} in ${f.table}: the module no longer uses it`}
          sub={`${f.rows} row${f.rows === 1 ? '' : 's'} still hold a value under it`}
          actions={
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking(f.fieldId)}>
              Delete its values
            </Button>
          }
        />
      ))}
      {gone && (
        <Confirm
          open
          title={`Delete ${gone.name}'s values?`}
          yes={`Delete ${gone.rows === 1 ? 'it' : `all ${gone.rows}`}`}
          busy={busy}
          onClose={() => setAsking(null)}
          onYes={() => {
            setAsking(null)
            act(() =>
              api.post(`/api/kits/${m.id}/fields/remove`, {
                table: gone.table,
                field: gone.fieldId,
              }),
            )
          }}
        >
          {gone.rows === 1 ? 'One row' : `${gone.rows} rows`} in {gone.table}{' '}
          {gone.rows === 1 ? 'holds' : 'hold'} a value under it, and can’t get it back.
        </Confirm>
      )}
    </>
  )
}

function InstallModule({ onChange }: { onChange: () => void }) {
  const [folder, setFolder] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  // a module sent as a file: installed, or updated (what the person changed stays)
  const fromFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setProblem(null)
    try {
      const out = await api.uploadTo<{ words: string }>('/api/kits/pack', file)
      setSaid(out.words)
      onChange()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That module was not installed.')
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
      setProblem(err instanceof Problem ? err.message : 'That module was not installed.')
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
          placeholder="The module's folder, like /Users/you/dev/modules/deals"
          onChange={(e) => setFolder(e.target.value)}
        />
        <Button type="submit" disabled={busy || !folder.trim()}>
          {busy ? 'Installing…' : 'Install module'}
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
