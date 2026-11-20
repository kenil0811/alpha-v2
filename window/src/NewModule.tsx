// New module: a page reached from the rail like opening a module. The bar says New module | Setup
// (Setup is the Module builder's own page); the page asks what the module should do, takes a file
// to bring in (kept the way any file is), and Build it hands the words to the Module builder, whose
// conversation then opens and does the work.
import { useEffect, useState } from 'react'
import { AgentPage } from './Agents.tsx'
import { api, Problem } from './api.ts'
import { Button } from './ui/button.tsx'
import { DropZone } from './ui/drop-zone.tsx'
import { Section } from './ui/section.tsx'
import { Tabs } from './ui/tabs.tsx'

const noName = () => undefined

export function NewModule({
  setup,
  version,
  onBuild,
}: {
  setup: boolean
  version: number
  onBuild: (words: string) => Promise<void>
}) {
  const [words, setWords] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
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
        () => setFiles((x) => [...x, f.name]),
        () => setProblem(`${f.name} did not go in.`),
      )
    setBusy(false)
  }
  const build = async () => {
    setProblem(null)
    const brought = files.length ? `\n\nFiles I brought in: ${files.join(', ')}` : ''
    try {
      await onBuild(`${words.trim()}${brought}`)
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
      ) : (
        <div className="mx-auto flex w-full max-w-150 flex-col gap-4 px-6 py-8">
          <Section title="What should it do?">
            <textarea
              aria-label="What should it do?"
              rows={5}
              value={words}
              onChange={(e) => setWords(e.target.value)}
              className="min-w-0 rounded-md border border-line bg-surface px-2.5 py-2 text-ink text-md outline-none transition-colors placeholder:text-ink-3 focus:border-accent-line focus:ring-3 focus:ring-accent-soft"
            />
          </Section>
          <Section title="Import">
            <DropZone onFiles={(f) => void bring(f)} busy={busy}>
              {files.map((n) => (
                <div key={n} className="px-1.5 text-md text-ink-2">
                  {n}
                </div>
              ))}
            </DropZone>
          </Section>
          <div className="flex items-center justify-end gap-3">
            {problem && <span className="text-bad text-md">{problem}</span>}
            <Button variant="primary" disabled={!words.trim()} onClick={() => void build()}>
              Build it
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
