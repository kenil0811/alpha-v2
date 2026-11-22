// Settings › Files: every file Alpha has kept, from a folder, mail or a drop, the newest
// first: what brought it, when, and whether it was read. A file opens as it does from a value's
// source.
import type { KeptFileView } from '@alpha/core/api'
import { File, FileSpreadsheet, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { Refusal } from './ui/act.tsx'
import { Field } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill, type Tone } from './ui/pill.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { updatedWords } from './ui/update-now.tsx'

const size = (n: number) =>
  n < 1e3 ? `${n} bytes` : n < 1e6 ? `${Math.round(n / 1e3)} KB` : `${(n / 1e6).toFixed(1)} MB`

const iconOf = (f: KeptFileView) =>
  /sheet|excel|csv/.test(f.mime) ? (
    <FileSpreadsheet className="size-4" />
  ) : /pdf|text|word/.test(f.mime) ? (
    <FileText className="size-4" />
  ) : (
    <File className="size-4" />
  )

const READ: Record<KeptFileView['read'], [string, Tone]> = {
  read: ['Read', 'good'],
  reading: ['Being read', 'neutral'],
  failed: ['Not read', 'bad'],
  kept: ['Saved as it is', 'neutral'],
}

// The modules the files belong to, each with how many, and how many belong to none.
function byModule(files: KeptFileView[]) {
  const counts = new Map<string, { id: string; name: string; count: number }>()
  for (const f of files)
    for (const m of f.modules) counts.set(m.id, { ...m, count: (counts.get(m.id)?.count ?? 0) + 1 })
  return {
    modules: [...counts.values()].sort((a, b) => a.name.localeCompare(b.name)),
    none: files.filter((f) => !f.modules.length).length,
  }
}

export function KeptFiles({ version, module }: { version: number; module: string | null }) {
  const [files, setFiles] = useState<KeptFileView[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [find, setFind] = useState('')
  const [of, setOf] = useState(module ?? 'all') // a module's files, those of none, or all
  useEffect(() => setOf(module ?? 'all'), [module])
  // read again whenever the world changes (a folder bringing a file, a PDF read)
  useEffect(() => {
    api.get<KeptFileView[]>('/api/files').then(setFiles, (e) => setProblem(wordsOf(e)))
  }, [version])
  if (!files) return <Refusal words={problem} />
  const words = find.trim().toLowerCase()
  const by = byModule(files)
  const picked = of === 'none' || by.modules.some((m) => m.id === of) ? of : 'all'
  const shown = files.filter(
    (f) =>
      (picked === 'all' ||
        (picked === 'none' ? !f.modules.length : f.modules.some((m) => m.id === picked))) &&
      (!words || f.name.toLowerCase().includes(words)),
  )
  return (
    <Section
      title="Files"
      about="Every file Alpha has kept: from your folders and computers, your mail, and what you dropped in. Each opens where you can read it with its places."
    >
      {files.length > 0 && (
        <Field
          aria-label="Find a file"
          placeholder="Find a file"
          value={find}
          onChange={(e) => setFind(e.target.value)}
        />
      )}
      {by.modules.length > 0 && (
        <div className="overflow-x-auto">
          <Segmented
            label="Module"
            value={picked}
            onChange={setOf}
            options={[
              { value: 'all', label: `All ${files.length}` },
              ...by.modules.map((m) => ({ value: m.id, label: `${m.name} ${m.count}` })),
              ...(by.none ? [{ value: 'none', label: `No module ${by.none}` }] : []),
            ]}
          />
        </div>
      )}
      {shown.length > 0 ? (
        <List>
          {shown.map((f) => {
            const [label, tone] = READ[f.read]
            return (
              <Row
                key={f.hash}
                lead={<Tile>{iconOf(f)}</Tile>}
                title={
                  <a className="hover:underline hover:underline-offset-3" href={`#/file/${f.hash}`}>
                    {f.name}
                  </a>
                }
                sub={`${
                  f.modules.length ? `${f.modules.map((m) => m.name).join(', ')} · from` : 'From'
                } ${f.from} · ${updatedWords(f.at)} · ${size(f.size)}${
                  f.read === 'failed' && f.words ? ` · ${f.words}` : ''
                }`}
                actions={
                  <Pill tone={tone}>
                    {f.read === 'read' && f.words ? `${label}: ${f.words}` : label}
                  </Pill>
                }
              />
            )
          })}
        </List>
      ) : (
        <p className="text-ink-3 text-md">
          {!files.length ? null : words ? 'No file has that in its name.' : 'No files here.'}
        </p>
      )}
    </Section>
  )
}
