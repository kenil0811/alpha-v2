// Intelligence › Second Brain (Vikas, 27 Oct: "the layer which is connecting all the modules
// ingesting all the data and doing lot of work on top of it"). A first cut from what the core
// already keeps: ask across every module, what changed since you looked, what each module holds,
// and how the modules link. What Alpha keeps about itself — notes, rules, decisions — is Governance.
import type { BrainView, FoundRow, TodayView } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { startAsk } from './ask.ts'
import { when } from './ModulesAndAgents.tsx'
import { Button } from './ui/button.tsx'
import { Field } from './ui/field.tsx'
import { Empty, Section } from './ui/section.tsx'

export function SecondBrain({ version }: { version: number }) {
  const [brain, setBrain] = useState<BrainView | null | undefined>(undefined)
  const [today, setToday] = useState<TodayView | null>(null)
  useEffect(() => {
    if (version < 0) return
    api.get<BrainView>('/api/brain').then(setBrain, () => setBrain(null))
    api.get<TodayView>('/api/today').then(setToday, () => undefined)
  }, [version])
  if (brain === undefined) return <p className="text-ink-3">Loading…</p>
  if (brain === null) return <Empty>The Second Brain could not be read just now.</Empty>
  const name = new Map(brain.modules.map((m) => [m.id, m.name]))
  const totals = [
    { label: 'Rows', n: brain.modules.reduce((a, m) => a + m.rows, 0), href: '#/' },
    { label: 'People', n: brain.totals.people, href: '#/people' },
    { label: 'Organizations', n: brain.totals.organizations, href: '#/people?companies' },
    { label: 'Documents', n: brain.modules.reduce((a, m) => a + m.documents, 0), href: '#/' },
    { label: 'Decisions kept', n: brain.totals.decisions, href: '#/intelligence/governance' },
    { label: 'Follow-ups', n: brain.totals.followUps, href: '#/intelligence/governance' },
  ]
  return (
    <div className="flex flex-col gap-8">
      <Ask />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
        {totals.map((t) => (
          <a
            key={t.label}
            href={t.href}
            className="rounded-lg border border-line bg-surface px-4 py-3 hover:bg-hover"
          >
            <div className="text-ink-3 text-sm">{t.label}</div>
            <div className="font-serif text-2xl tabular-nums">{t.n.toLocaleString()}</div>
          </a>
        ))}
      </div>

      <Section title="Since you last looked">
        <div className="flex flex-col rounded-lg border border-line bg-surface">
          {today?.changed.slice(0, 8).map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 border-hair border-b px-4 py-2 text-md last:border-b-0"
            >
              <a href={`#/run/${r.id}`} className="min-w-0 flex-1 hover:text-accent">
                <span className="line-clamp-1">{r.words ?? r.name}</span>
                <span className="text-ink-3 text-sm">
                  {r.name}
                  {r.module ? ` · ${r.module}` : ''} · {when(r.startedAt)}
                </span>
              </a>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => startAsk(`About "${r.words ?? r.name}": `)}
              >
                Ask
              </Button>
            </div>
          ))}
          {!today?.changed.length && (
            <p className="px-4 py-3 text-ink-3 text-md">Nothing changed since you last looked.</p>
          )}
        </div>
      </Section>

      <div className="grid gap-8 xl:grid-cols-2">
        <Section title="What each module holds">
          <div className="flex flex-col rounded-lg border border-line bg-surface">
            {brain.modules.map((m) => (
              <a
                key={m.id}
                href={`#/module/${m.id}`}
                className="flex items-center gap-3 border-hair border-b px-4 py-2 text-md last:border-b-0 hover:bg-hover"
              >
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="text-ink-3 text-sm tabular-nums">
                  {m.tables} {m.tables === 1 ? 'table' : 'tables'} · {m.agents}{' '}
                  {m.agents === 1 ? 'agent' : 'agents'}
                </span>
                <span className="w-16 text-right font-medium tabular-nums">
                  {m.rows.toLocaleString()}
                </span>
              </a>
            ))}
            {!brain.modules.length && (
              <p className="px-4 py-3 text-ink-3 text-md">No module yet.</p>
            )}
          </div>
        </Section>
        <Section title="How your modules connect">
          <div className="flex flex-col rounded-lg border border-line bg-surface">
            {brain.links.map((l) => (
              <div
                key={`${l.fromTable}.${l.field}`}
                className="flex flex-wrap items-center gap-1.5 border-hair border-b px-4 py-2 text-md last:border-b-0"
              >
                <a href={`#/module/${l.from}`} className="hover:text-accent">
                  {name.get(l.from)}
                </a>
                <span className="text-ink-3 text-sm">
                  {l.fromTable} · {l.field} →
                </span>
                <a href={`#/module/${l.to}`} className="hover:text-accent">
                  {name.get(l.to)}
                </a>
                <span className="text-ink-3 text-sm">{l.toTable}</span>
              </div>
            ))}
            {!brain.links.length && (
              <p className="px-4 py-3 text-ink-3 text-md">No module points at another yet.</p>
            )}
          </div>
        </Section>
      </div>
    </div>
  )
}

// Ask anything across every module: rows found as you type, or the question to the assistant.
function Ask() {
  const [words, setWords] = useState('')
  const [found, setFound] = useState<FoundRow[]>([])
  useEffect(() => {
    const w = words.trim()
    if (!w) return setFound([])
    const t = setTimeout(() => {
      api
        .get<FoundRow[]>(`/api/find?words=${encodeURIComponent(w)}`)
        .then(setFound, () => setFound([]))
    }, 200)
    return () => clearTimeout(t)
  }, [words])
  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (words.trim()) startAsk(words.trim())
        }}
      >
        <Field
          aria-label="Ask across your modules"
          placeholder="Ask anything across your modules…"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="primary" disabled={!words.trim()}>
          Ask Alpha
        </Button>
      </form>
      {found.length > 0 && (
        <div className="flex flex-col rounded-lg border border-line bg-surface">
          {found.map((f) => (
            <a
              key={f.href}
              href={f.href}
              className="flex items-center gap-3 border-hair border-b px-4 py-1.5 text-md last:border-b-0 hover:bg-hover"
            >
              <span className="min-w-0 flex-1 truncate">{f.label}</span>
              <span className="text-ink-3 text-sm">{f.hint}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
