// New module: a page reached from the rail like opening a module. The bar says New module | Setup
// (Setup is the Module builder's own page). The page asks one warm question; Send hands the words
// to the Module builder as a task, whose work then runs right here in the page's central column,
// the task in the address (#/new/<task>) so leaving and coming back finds the build. Import beside
// Send brings a file in (kept the way any file is), named to the builder by its id.
import { ArrowUp, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AgentPage, CHIEF } from './Agents.tsx'
import { api, Problem } from './api.ts'
import { TaskWork } from './TaskThread.tsx'
import { Button } from './ui/button.tsx'
import { Tabs } from './ui/tabs.tsx'

const noName = () => undefined

// Send gives the Module builder (the Chief of staff once it has gone) a task, which starts at once;
// the page then shows that task's work.
async function giveBuilder(words: string): Promise<string> {
  const b = await api.get<{ id: string | null }>('/api/agents/builder').catch(() => null)
  const t = await api.post<{ id: string }>('/api/tasks', {
    title: `Build a module: ${words.split('\n')[0]?.slice(0, 60) ?? ''}`,
    notes: words,
    owner: { kind: 'alpha', id: b?.id ?? CHIEF },
  })
  return t.id
}

// What the builder is asked: the person's words, and each file brought in by its name and its id,
// which the file tool opens exactly (two files can share a name).
export const askFor = (words: string, files: { name: string; hash: string }[]) =>
  `${words.trim()}${
    files.length
      ? `\n\nFiles I brought in (open each by its id): ${files.map((f) => `${f.name}, id ${f.hash}`).join('; ')}`
      : ''
  }`

export function NewModule({
  setup,
  task,
  version,
  onBuild = giveBuilder,
}: {
  setup: boolean
  task: string | null // the build this page started, from the address
  version: number
  onBuild?: (words: string) => Promise<string> // the task made; the Module builder's by default
}) {
  const [words, setWords] = useState('')
  const [files, setFiles] = useState<{ name: string; hash: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const pick = useRef<HTMLInputElement>(null)
  const [builder, setBuilder] = useState<string | null>(null)
  useEffect(() => {
    api.get<{ id: string | null }>('/api/agents/builder').then(
      (b) => setBuilder(b.id),
      () => undefined,
    )
  }, [])
  const bring = async (picked: File[]) => {
    setBusy(true)
    for (const f of picked)
      await api.upload(f).then(
        (kept) => setFiles((x) => [...x, { name: kept.name, hash: kept.hash }]),
        () => setProblem(`${f.name} did not go in.`),
      )
    setBusy(false)
  }
  const build = async () => {
    setProblem(null)
    try {
      const id = await onBuild(askFor(words, files))
      window.location.hash = `#/new/${id}`
    } catch (e) {
      setProblem(e instanceof Problem ? e.message : 'That did not go to the Module builder.')
    }
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        label="New module"
        tabs={[
          { key: 'new', href: '#/new', label: 'New module', sel: !setup },
          { key: 'setup', href: '#/new/setup', label: 'Setup', sel: setup },
        ]}
      />
      {setup ? (
        builder ? (
          <AgentPage id={builder} version={version} onName={noName} inAgents />
        ) : null
      ) : task ? (
        <div className="min-h-0 flex-1">
          <TaskWork id={task} version={version} onName={noName} />
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-stream flex-col gap-4 px-8 py-16">
          <h1 className="font-medium text-2xl text-ink">What are you planning to build today?</h1>
          <textarea
            aria-label="What are you planning to build today?"
            placeholder="Tell me what it should do, in your own words"
            rows={4}
            value={words}
            onChange={(e) => setWords(e.target.value)}
            className="min-w-0 rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink shadow-pop outline-none transition-colors placeholder:text-ink-3 focus:border-accent-line focus:ring-3 focus:ring-accent-soft"
          />
          {files.length > 0 && (
            <div className="text-ink-2 text-md">
              Brought in: {files.map((f) => f.name).join(', ')}
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            {problem && <span className="text-bad text-md">{problem}</span>}
            <Button disabled={busy} onClick={() => pick.current?.click()}>
              <Upload className="size-4" />
              {busy ? 'Adding…' : 'Import'}
            </Button>
            <input
              ref={pick}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void bring([...e.target.files])
                e.target.value = ''
              }}
            />
            <Button variant="primary" disabled={!words.trim()} onClick={() => void build()}>
              <ArrowUp className="size-4" />
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
