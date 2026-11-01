// Second Brain › Across modules (Vikas, 27 Oct: "the layer which is connecting all the modules
// ingesting all the data and doing lot of work on top of it"). A first cut from what the core
// already keeps: ask across every module, what changed since you looked, what each module holds,
// and how the modules link. What Alpha keeps about itself — notes, rules, decisions — is Governance.
import type { ConnectorsView, FoundRow, TodayView } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { Arranged } from './arrange.tsx'
import { startAsk } from './ask.ts'
import type { BrainView, ModuleSummary, WorkingModuleView } from './coming.ts'
import { when } from './ModulesAndAgents.tsx'
import { peek } from './Peek.tsx'
import { Button } from './ui/button.tsx'
import { Stretch } from './ui/chart.tsx'
import { cn } from './ui/cn.ts'
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
    { label: 'Decisions kept', n: brain.totals.decisions, href: '#/settings/governance' },
    { label: 'Follow-ups', n: brain.totals.followUps, href: '#/settings/governance' },
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
        </div>
      </Section>

      <Arranged
        page="brain"
        start={[['what-each-module-holds', 'how-your-modules-connect']]}
        blocks={[
          {
            key: 'what-each-module-holds',
            name: 'What each module holds',
            node: (
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
            ),
          },
          {
            key: 'how-your-modules-connect',
            name: 'How your modules connect',
            node: (
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
            ),
          },
        ]}
      />
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

// The Second Brain's graph (Vikas, 28 Oct): the whole platform at a glance. Alpha in the middle;
// each module around it, sized by its rows, with its main tables and its agents one layer out;
// the connections that feed it on the outer ring; and the links that carry data between modules.
// Green is on or connected, amber needs you, red is broken, grey is paused. A click opens it in
// the side panel.
type Node = {
  key: string
  x: number
  y: number
  r: number
  label: string
  kind: 'alpha' | 'module' | 'table' | 'agent' | 'connection'
  tone: 'accent' | 'good' | 'warn' | 'bad' | 'faint'
  href: string
  tip: string
}

const FILL: Record<Node['tone'], string> = {
  accent: 'fill-accent',
  good: 'fill-good',
  warn: 'fill-warn',
  bad: 'fill-bad',
  faint: 'fill-ink-3',
}

export function BrainGraph({ version }: { version: number }) {
  const [brain, setBrain] = useState<BrainView | null>(null)
  const [modules, setModules] = useState<ModuleSummary[]>([])
  const [working, setWorking] = useState<WorkingModuleView[]>([])
  const [conns, setConns] = useState<ConnectorsView | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  useEffect(() => {
    if (version < 0) return
    api.get<BrainView>('/api/brain').then(setBrain, () => undefined)
    api.get<ModuleSummary[]>('/api/modules').then(setModules, () => undefined)
    api.get<WorkingModuleView[]>('/api/working').then(setWorking, () => undefined)
    api.get<ConnectorsView>('/api/connectors').then(setConns, () => undefined)
  }, [version])
  if (!brain) return <p className="text-ink-3">Loading…</p>
  return (
    <div className="flex flex-col gap-3">
      <Stretch
        height={640}
        least={[600, 420]}
        className="w-full rounded-lg border border-line bg-surface"
      >
        {(W, H) => drawBrain(brain, modules, working, conns, hover, setHover, W, H)}
      </Stretch>
      <Legend />
    </div>
  )
}

// the graph laid out for a box W by H: Alpha in the middle, the rings scaled to the box
function drawBrain(
  brain: BrainView,
  modules: ModuleSummary[],
  working: WorkingModuleView[],
  conns: ConnectorsView | null,
  hover: string | null,
  setHover: (k: string | null) => void,
  W: number,
  H: number,
) {
  const sx = W / 1000
  const sy = H / 720
  const cx = W / 2
  const cy = H / 2
  const shown = brain.modules.filter((m) => modules.some((x) => x.id === m.id && !x.alpha))
  const most = Math.max(1, ...shown.map((m) => m.rows))
  const nodes: Node[] = [
    {
      key: 'alpha',
      x: cx,
      y: cy,
      r: 26,
      label: 'Alpha',
      kind: 'alpha',
      tone: 'accent',
      href: '#/intelligence/brain',
      tip: `${brain.totals.people} people, ${brain.totals.organizations} organizations, ${brain.totals.decisions} decisions`,
    },
  ]
  const edges: { a: string; b: string; dashed?: boolean; tip?: string }[] = []
  shown.forEach((m, i) => {
    const angle = (i / Math.max(1, shown.length)) * Math.PI * 2 - Math.PI / 2
    const mx = cx + Math.cos(angle) * 200 * sx
    const my = cy + Math.sin(angle) * 170 * sy
    nodes.push({
      key: m.id,
      x: mx,
      y: my,
      r: 10 + 14 * Math.sqrt(m.rows / most),
      label: m.name,
      kind: 'module',
      tone: 'accent',
      href: `#/module/${m.id}`,
      tip: `${m.name}: ${m.rows.toLocaleString()} rows in ${m.tables} tables, ${m.agents} agents, ${m.documents} documents`,
    })
    edges.push({ a: 'alpha', b: m.id })
    // one layer inside: its main tables and its agents, fanned outward
    const tables = (modules.find((x) => x.id === m.id)?.tables ?? []).filter(
      (t) => t.place === 'main',
    )
    const agents = working.find((w) => w.id === m.id)?.agents ?? []
    const kids = [
      ...tables.map((t) => ({
        key: t.id,
        label: t.name,
        kind: 'table' as const,
        tone: 'faint' as const,
        href: `#/table/${t.id}`,
        tip: `${t.name}: ${t.rows.toLocaleString()} rows`,
      })),
      ...agents.map((a) => ({
        key: a.id,
        label: a.name,
        kind: 'agent' as const,
        tone: a.needs
          ? ('warn' as const)
          : a.state === 'on'
            ? ('good' as const)
            : ('faint' as const),
        href: `#/agent/${a.id}`,
        tip: `${a.name}: ${a.needs ? `needs ${a.needs}` : a.state === 'on' ? a.when : 'paused'}`,
      })),
    ]
    kids.forEach((k, j) => {
      const spread = Math.min(0.9, 0.22 * kids.length)
      const a = angle + (kids.length > 1 ? (j / (kids.length - 1) - 0.5) * spread : 0)
      nodes.push({
        ...k,
        x: cx + Math.cos(a) * 300 * sx,
        y: cy + Math.sin(a) * 265 * sy,
        r: k.kind === 'agent' ? 6 : 5,
      })
      edges.push({ a: m.id, b: k.key })
    })
  })
  // the connections feed Alpha: along the top and bottom edges
  ;(conns?.connections ?? []).forEach((c, i, all) => {
    const x = 80 + (i * (W - 160)) / Math.max(1, all.length - 1 || 1)
    const y = i % 2 ? H - 30 : 30
    nodes.push({
      key: c.id,
      x: all.length === 1 ? cx : x,
      y,
      r: 8,
      label: c.title,
      kind: 'connection',
      tone:
        c.state === 'connected'
          ? 'good'
          : c.state === 'needs_sign_in'
            ? 'warn'
            : c.state === 'broken'
              ? 'bad'
              : 'faint',
      href: '#/settings/connections',
      tip: `${c.title} (${c.account}): ${c.state.replaceAll('_', ' ')}`,
    })
    edges.push({ a: c.id, b: 'alpha', dashed: true })
  })
  // data carried between modules
  for (const l of brain.links)
    if (l.from !== l.to && nodes.some((n) => n.key === l.from) && nodes.some((n) => n.key === l.to))
      edges.push({ a: l.from, b: l.to, tip: `${l.fromTable} → ${l.toTable} by ${l.field}` })

  const at = new Map(nodes.map((n) => [n.key, n]))
  const near = (k: string) =>
    hover === null ||
    k === hover ||
    edges.some((e) => (e.a === hover && e.b === k) || (e.b === hover && e.a === k))
  // the one under the pointer is drawn last: SVG has no z-index, so it comes to the front
  const drawn =
    hover === null
      ? nodes
      : [...nodes.filter((n) => n.key !== hover), ...nodes.filter((n) => n.key === hover)]
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="block"
      role="img"
      aria-label="How the platform fits together"
    >
      {edges.map((e, i) => {
        const a = at.get(e.a)
        const b = at.get(e.b)
        if (!a || !b) return null
        const between = a.kind === 'module' && b.kind === 'module'
        // a link between modules bows toward the middle, so it does not run under Alpha
        const mx = (a.x + b.x) / 2 + (cx - (a.x + b.x) / 2) * 0.5
        const my = (a.y + b.y) / 2 + (cy - (a.y + b.y) / 2) * 0.5
        return (
          <path
            key={`${e.a}-${e.b}-${i}`}
            d={
              between
                ? `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`
                : `M${a.x},${a.y} L${b.x},${b.y}`
            }
            className={cn(
              'fill-none transition-opacity',
              between ? 'stroke-accent' : 'stroke-line',
              hover && !(near(e.a) && near(e.b)) && 'opacity-15',
            )}
            strokeWidth={between ? 2 : 1}
            strokeDasharray={e.dashed ? '4 4' : undefined}
          >
            {e.tip && <title>{e.tip}</title>}
          </path>
        )
      })}
      {drawn.map((n) => (
        // biome-ignore lint/a11y/useSemanticElements: an SVG mark; the link is its click
        <g
          key={n.key}
          role="link"
          tabIndex={0}
          aria-label={n.label}
          data-href={n.href}
          className={cn('cursor-pointer transition-opacity', !near(n.key) && 'opacity-20')}
          onMouseEnter={() => setHover(n.key)}
          onMouseLeave={() => setHover(null)}
          onClick={() => peek(n.href)}
          onKeyDown={(e) => e.key === 'Enter' && peek(n.href)}
        >
          <title>{n.tip}</title>
          {n.kind === 'agent' ? (
            <rect
              x={n.x - n.r}
              y={n.y - n.r}
              width={n.r * 2}
              height={n.r * 2}
              transform={`rotate(45 ${n.x} ${n.y})`}
              className={cn(FILL[n.tone], hover === n.key ? 'stroke-ink' : 'stroke-surface')}
              strokeWidth={hover === n.key ? 3 : 2}
            />
          ) : (
            <circle
              cx={n.x}
              cy={n.y}
              r={hover === n.key ? n.r + 2 : n.r}
              className={cn(FILL[n.tone], hover === n.key ? 'stroke-ink' : 'stroke-surface')}
              strokeWidth={hover === n.key ? 3 : 2}
            />
          )}
          {(n.kind === 'module' ||
            n.kind === 'alpha' ||
            n.kind === 'connection' ||
            hover === n.key) && (
            <text
              x={n.x}
              y={n.y + n.r + 16}
              textAnchor="middle"
              className={cn(
                'fill-ink text-sm',
                n.kind === 'module' || n.kind === 'alpha' ? 'font-semibold' : '',
              )}
            >
              {n.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-ink-3 text-sm">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-accent" />
        Module, bigger has more rows
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-ink-3" />
        Table
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rotate-45 bg-good" />
        Agent
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-accent" />
        Data between modules
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0 w-4 border-line border-t-2 border-dashed" />
        Connection feeding Alpha
      </span>
      <span>Green on, amber needs you, red broken, grey paused</span>
    </div>
  )
}
