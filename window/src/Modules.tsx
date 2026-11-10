// Intelligence › Modules: every module, a row each, opening its Setup; and, for the owner,
// installing one. The core calls a module's package a kit; a person never reads that word.
import type { WorkingModuleView } from '@alpha/core/api'
import { Package } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { api, Problem, wordsOf } from './api.ts'
import { Button } from './ui/button.tsx'
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

export function Modules({
  version,
  owner,
  developer,
}: {
  version: number
  owner: boolean
  developer: boolean
}) {
  const [modules, setModules] = useState<WorkingModuleView[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const load = useCallback(() => {
    api.get<WorkingModuleView[]>('/api/working').then(setModules, (e) => setProblem(wordsOf(e)))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])

  return (
    <Section title="Modules" about="Every module, where it comes from, and its Setup.">
      {problem && <div className="text-bad text-md">{problem}</div>}
      {modules?.length === 0 && (
        <Empty>No modules yet. Modules you install or make in a conversation show here.</Empty>
      )}
      {!!modules?.length && (
        <List>
          {modules.map((m) => (
            <Row
              key={m.id}
              className="relative hover:bg-canvas"
              lead={
                <Tile>
                  <Package className="size-4" />
                </Tile>
              }
              title={
                <a href={`#/module/${m.id}/setup`} className="after:absolute after:inset-0">
                  {m.name}
                </a>
              }
              sub={`${originWords(m.kit)}${scheduleWords(m)}`}
            />
          ))}
        </List>
      )}
      {owner && <InstallModule onChange={load} developer={developer} />}
    </Section>
  )
}

// Where a module came from: Alpha's own, installed (with its version and maintainer), or made in a
// conversation.
export function originWords(
  from: {
    name: string
    version: string
    maintainer?: { name: string } | null
    core?: boolean
    changes?: number
  } | null,
): string {
  if (!from) return 'Made in a conversation'
  if (from.core)
    return `Alpha's own, version ${from.version}: kept up to date by Alpha; its schedules can be paused`
  const by = from.maintainer ? `, maintained by ${from.maintainer.name}` : ''
  const unseen = from.changes
    ? ` · ${from.changes} change${from.changes === 1 ? '' : 's'} of yours the maintainer has not seen`
    : ''
  return `From ${from.name}, version ${from.version}${by}${unseen}`
}

const scheduleWords = (m: WorkingModuleView): string => {
  if (!m.schedules.length) return ''
  const on = m.schedules.filter((a) => a.state === 'on').length
  const all = m.schedules.length
  return ` · ${all === 1 ? 'one schedule' : `${all} schedules`}, ${
    on === all ? (on === 1 ? 'on' : 'all on') : on ? `${on} on` : 'paused'
  }`
}

function InstallModule({ onChange, developer }: { onChange: () => void; developer: boolean }) {
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
        {developer && (
          <>
            <Field
              className="flex-1"
              value={folder}
              placeholder="The module's folder, like /Users/you/dev/modules/deals"
              onChange={(e) => setFolder(e.target.value)}
            />
            <Button type="submit" disabled={busy || !folder.trim()}>
              {busy ? 'Installing…' : 'Install module'}
            </Button>
          </>
        )}
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
