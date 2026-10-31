// Second Brain (Vikas, 27 Oct: "the layer which is connecting all the modules ingesting all the
// data and doing lot of work on top of it"; the graph first, 28 Oct). A first cut from what the
// core keeps today: ask across every module, what changed since you looked, what each module
// holds, and the graph of modules, tables, agents and connections. The links between modules
// wait on the core's GET /api/brain. What Alpha keeps about itself is Settings › Governance.
import type {
  ConnectorsView,
  FoundRow,
  ModuleSummary,
  TodayView,
  WorkingModuleView,
} from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { startAsk } from './ask.ts'
import { when } from './ModulesAndAgents.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Field } from './ui/field.tsx'
import { Empty, Section } from './ui/section.tsx'

// the rows a module holds: every table it keeps, counted by the core
const rowsOf = (m: ModuleSummary) => m.tables.reduce((a, t) => a + t.rows, 0)
const rowsNamed = (ms: ModuleSummary[], name: string) =>
  ms.find((m) => m.alpha)?.tables.find((t) => t.name === name)?.rows ?? 0

const WAITS = 'Shown once the core gives GET /api/brain.'

export function SecondBrain({ version }: { version: number }) {
  const [modules, setModules] = useState<ModuleSummary[] | null | undefined>(undefined)
  const [working, setWorking] = useState<WorkingModuleView[]>([])
  const [today, setToday] = useState<TodayView | null>(null)
  useEffect(() => {
    if (version < 0) return
    api.get<ModuleSummary[]>('/api/modules').then(setModules, () => setModules(null))
    api.get<WorkingModuleView[]>('/api/working').then(setWorking, () => undefined)
    api.get<TodayView>('/api/today').then(setToday, () => undefined)
  }, [version])
  if (modules === undefined) return <p className="text-ink-3">Loading…</p>
  if (modules === null) return <Empty>The Second Brain could not be read just now.</Empty>
  const shown = modules.filter((m) => !m.alpha)
  const totals = [
    { label: 'Rows', n: shown.reduce((a, m) => a + rowsOf(m), 0), href: '#/' },
    {
      label: 'Decisions kept',
      n: rowsNamed(modules, 'Decisions'),
      href: '#/settings/governance',
    },
    { label: 'Noticed', n: rowsNamed(modules, 'Noticed'), href: '#/settings/governance' },
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
        {today && today.changed.length > 0 ? (
          <div className="flex flex-col rounded-lg border border-line bg-surface">
            {today.changed.slice(0, 8).map((r) => (
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
        ) : (
          <Empty>Nothing has changed since you last looked.</Empty>
        )}
      </Section>

      <Section title="What each module holds">
        <div className="flex flex-col rounded-lg border border-line bg-surface">
          {shown.map((m) => {
            const tables = m.tables.length
            const agents = working.find((w) => w.id === m.id)?.agents.length ?? 0
            return (
              <a
                key={m.id}
                href={`#/module/${m.id}`}
                className="flex items-center gap-3 border-hair border-b px-4 py-2 text-md last:border-b-0 hover:bg-hover"
              >
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="text-ink-3 text-sm tabular-nums">
                  {tables} {tables === 1 ? 'table' : 'tables'} · {agents}{' '}
                  {agents === 1 ? 'agent' : 'agents'}
                </span>
                <span className="w-16 text-right font-medium tabular-nums">
                  {rowsOf(m).toLocaleString()}
                </span>
              </a>
            )
          })}
          {!shown.length && <p className="px-4 py-3 text-ink-3 text-md">No module yet.</p>}
        </div>
      </Section>

      <Section title="How your modules connect">
        <Empty>Which module points at another. {WAITS}</Empty>
      </Section>
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

// The graph (Vikas, 28 Oct): the whole platform at a glance. Alpha in the middle; each module
// around it, sized by its rows, with its main tables and its agents one layer out; the
// connections that feed it along the top and foot. Green is on or connected, amber needs you,
// red is broken, grey is paused. The links between modules wait on GET /api/brain.
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

// the box the graph is laid out in; the SVG scales it to the width it is given
const W = 1000
const H = 720

export function BrainGraph({ version }: { version: number }) {
  const [modules, setModules] = useState<ModuleSummary[] | null>(null)
  const [working, setWorking] = useState<WorkingModuleView[]>([])
  const [conns, setConns] = useState<ConnectorsView | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  useEffect(() => {
    if (version < 0) return
    api.get<ModuleSummary[]>('/api/modules').then(setModules, () => undefined)
    api.get<WorkingModuleView[]>('/api/working').then(setWorking, () => undefined)
    api.get<ConnectorsView>('/api/connectors').then(setConns, () => undefined)
  }, [version])
  if (!modules) return <p className="text-ink-3">Loading…</p>

  const cx = W / 2
  const cy = H / 2
  const shown = modules.filter((m) => !m.alpha)
  const most = Math.max(1, ...shown.map(rowsOf))
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
      tip: `${rowsNamed(modules, 'Decisions')} decisions kept, ${rowsNamed(modules, 'Noticed')} noticed`,
    },
  ]
  const edges: { a: string; b: string; dashed?: boolean }[] = []
  shown.forEach((m, i) => {
    const angle = (i / Math.max(1, shown.length)) * Math.PI * 2 - Math.PI / 2
    const rows = rowsOf(m)
    const agents = working.find((w) => w.id === m.id)?.agents ?? []
    nodes.push({
      key: m.id,
      x: cx + Math.cos(angle) * 200,
      y: cy + Math.sin(angle) * 170,
      r: 10 + 14 * Math.sqrt(rows / most),
      label: m.name,
      kind: 'module',
      tone: 'accent',
      href: `#/module/${m.id}`,
      tip: `${m.name}: ${rows.toLocaleString()} rows in ${m.tables.length} tables, ${agents.length} agents`,
    })
    edges.push({ a: 'alpha', b: m.id })
    // one layer out: its main tables and its agents, fanned outward
    const kids = [
      ...m.tables
        .filter((t) => t.place === 'main')
        .map((t) => ({
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
        x: cx + Math.cos(a) * 300,
        y: cy + Math.sin(a) * 265,
        r: k.kind === 'agent' ? 6 : 5,
      })
      edges.push({ a: m.id, b: k.key })
    })
  })
  // the connections feed Alpha: along the top and the foot
  const all = conns?.connections ?? []
  all.forEach((c, i) => {
    nodes.push({
      key: c.id,
      x: all.length === 1 ? cx : 80 + (i * (W - 160)) / (all.length - 1),
      y: i % 2 ? H - 30 : 30,
      r: 8,
      label: c.title,
      kind: 'connection',
      tone:
        c.state === 'connected'
          ? 'good'
          : c.state === 'needs_sign_in' || c.state === 'waiting'
            ? 'warn'
            : c.state === 'broken'
              ? 'bad'
              : 'faint',
      href: '#/intelligence/connections',
      tip: `${c.title} (${c.account}): ${c.state.replaceAll('_', ' ')}`,
    })
    edges.push({ a: c.id, b: 'alpha', dashed: true })
  })

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
  const go = (href: string) => {
    window.location.hash = href
  }
  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full rounded-lg border border-line bg-surface"
        role="img"
        aria-label="How the platform fits together"
      >
        {edges.map((e, i) => {
          const a = at.get(e.a)
          const b = at.get(e.b)
          if (!a || !b) return null
          return (
            <line
              key={`${e.a}-${e.b}-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={cn(
                'stroke-line transition-opacity',
                hover && !(near(e.a) && near(e.b)) && 'opacity-15',
              )}
              strokeWidth={1}
              strokeDasharray={e.dashed ? '4 4' : undefined}
            />
          )
        })}
        {drawn.map((n) => (
          // biome-ignore lint/a11y/useSemanticElements: an SVG mark; the link is its click
          <g
            key={n.key}
            role="link"
            tabIndex={0}
            aria-label={n.label}
            className={cn('cursor-pointer transition-opacity', !near(n.key) && 'opacity-20')}
            onMouseEnter={() => setHover(n.key)}
            onMouseLeave={() => setHover(null)}
            onClick={() => go(n.href)}
            onKeyDown={(e) => e.key === 'Enter' && go(n.href)}
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
      <Legend />
      <p className="text-ink-3 text-sm">The data carried between modules: {WAITS}</p>
    </div>
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
        <span className="h-0 w-4 border-line border-t-2 border-dashed" />
        Connection feeding Alpha
      </span>
      <span>Green on, amber needs you, red broken, grey paused</span>
    </div>
  )
}
