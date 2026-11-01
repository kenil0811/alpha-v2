// Second Brain › Across modules (Vikas, 27 Oct: "the layer which is connecting all the modules
// ingesting all the data and doing lot of work on top of it"). A first cut from what the core
// already keeps: ask across every module, what changed since you looked, what each module holds,
// and how the modules link. What Alpha keeps about itself — notes, rules, decisions — is Governance.
import type * as Core from '@alpha/core/api'
import type { ConnectorsView, FoundRow, TodayView } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { Arranged } from './arrange.tsx'
import { startAsk } from './ask.ts'
import type { BrainView, FieldView, ModuleSummary, WorkingModuleView } from './coming.ts'
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
// the side panel. Each module's pages sit beside its tables, and each table carries its broader
// buckets: the choices of its stage or status, with how many rows are in each (Vikas, 1 Nov).
type Node = {
  key: string
  x: number
  y: number
  r: number
  label: string
  kind: 'alpha' | 'module' | 'page' | 'table' | 'bucket' | 'agent' | 'connection' | 'more'
  tone: 'accent' | 'good' | 'warn' | 'bad' | 'faint'
  href: string
  tip: string
}
type Kid = Omit<Node, 'x' | 'y' | 'r'>
type Table = Omit<Core.TableView, 'fields'> & { fields: FieldView[] }

// at most six of a kind around one parent, the rest as one "+n" that opens where they all are
const CAP = 6
function cap(kids: Kid[], key: string, href: string, what: string): Kid[] {
  if (kids.length <= CAP) return kids
  const n = kids.length - CAP
  return [
    ...kids.slice(0, CAP),
    {
      key: `${key}+${what}`,
      label: `+${n}`,
      kind: 'more',
      tone: 'faint',
      href,
      tip: `${n} more ${what}`,
    },
  ]
}

// a table's broader buckets: the field that sorts its rows into a stage or a state, else one
// with colours, else its first choice
function bucketsOf(t: Table): Kid[] {
  const choices = t.fields.filter((f) => f.kind === 'choice' && !f.many && f.choices.length)
  const f =
    choices.find((c) => /stage|status|state/i.test(c.name)) ??
    choices.find((c) => Object.keys(c.tones).length) ??
    choices[0]
  if (!f) return []
  const kids = f.choices.map((c): Kid => {
    const n = t.rows.filter((r) => (r.values[f.slug] ?? r.values[f.name]) === c).length
    return {
      key: `${t.id}.${f.slug}.${c}`,
      label: c,
      kind: 'bucket',
      tone: f.tones[c] ?? 'faint',
      href: `#/table/${t.id}`,
      tip: `${t.name} by ${f.name}: ${c}, ${n.toLocaleString()} ${n === 1 ? 'row' : 'rows'}`,
    }
  })
  return cap(kids, t.id, `#/table/${t.id}`, f.name.toLowerCase())
}

// What /api/brain sends, worked out from the routes the core has while it does not (P11): rows
// and tables from the modules, agents from what works, and the links from each relation field.
// ponytail: a relation's table by the field's name, as lowerFirst in Overview does, until the
// core sends relatesTo (P12).
function guessBrain(
  modules: ModuleSummary[],
  working: WorkingModuleView[],
  tables: Table[],
): BrainView {
  const all = modules.flatMap((m) => m.tables.map((t) => ({ ...t, module: m.id })))
  const same = (a: string, b: string) =>
    a.toLowerCase().replace(/s$/, '') === b.toLowerCase().replace(/s$/, '')
  return {
    modules: modules.map((m) => ({
      id: m.id,
      name: m.name,
      rows: m.tables.reduce((a, t) => a + t.rows, 0),
      tables: m.tables.length,
      agents: working.find((w) => w.id === m.id)?.agents.length ?? 0,
      documents: 0,
    })),
    links: tables.flatMap((t) =>
      t.fields.flatMap((f) => {
        if (f.kind !== 'relation') return []
        const to = all.find((o) => (f.relatesTo ? o.id === f.relatesTo : same(o.name, f.name)))
        return to
          ? [
              {
                from: t.module.id,
                to: to.module,
                field: f.name,
                fromTable: t.name,
                toTable: to.name,
              },
            ]
          : []
      }),
    ),
    totals: { people: 0, organizations: 0, decisions: 0, noticed: 0, followUps: 0 },
  }
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
  const [modules, setModules] = useState<ModuleSummary[] | null | undefined>(undefined)
  const [working, setWorking] = useState<WorkingModuleView[]>([])
  const [conns, setConns] = useState<ConnectorsView | null>(null)
  const [tables, setTables] = useState<Table[]>([])
  const [hover, setHover] = useState<string | null>(null)
  useEffect(() => {
    if (version < 0) return
    // the graph waits on the modules alone: /api/brain, the agents, the connections and each
    // table's buckets join it as they answer, and one that does not leaves its part out
    api.get<BrainView>('/api/brain').then(setBrain, () => undefined)
    api.get<ModuleSummary[]>('/api/modules').then(
      (ms) => {
        setModules(ms)
        // ponytail: each table once, rows and all, for its buckets' counts; a counts route if it gets heavy
        const ids = ms.filter((m) => !m.alpha).flatMap((m) => m.tables.map((t) => t.id))
        Promise.all(ids.map((id) => api.get<Table>(`/api/tables/${id}`).catch(() => null))).then(
          (ts) => setTables(ts.filter((t) => t !== null)),
        )
      },
      () => setModules(null),
    )
    api.get<WorkingModuleView[]>('/api/working').then(setWorking, () => undefined)
    api.get<ConnectorsView>('/api/connectors').then(setConns, () => undefined)
  }, [version])
  if (modules === undefined) return <p className="text-ink-3">Loading…</p>
  if (modules === null) return <Empty>The Second Brain could not be read just now.</Empty>
  return (
    <div className="flex flex-col gap-3">
      <Stretch
        height={640}
        least={[600, 420]}
        className="w-full rounded-lg border border-line bg-surface"
      >
        {(W, H) => drawBrain(brain, modules, working, conns, tables, hover, setHover, W, H)}
      </Stretch>
      <Legend />
    </div>
  )
}

// the graph laid out for a box W by H: Alpha in the middle, the rings scaled to the box
function drawBrain(
  told: BrainView | null,
  modules: ModuleSummary[],
  working: WorkingModuleView[],
  conns: ConnectorsView | null,
  tables: Table[],
  hover: string | null,
  setHover: (k: string | null) => void,
  W: number,
  H: number,
) {
  const brain = told ?? guessBrain(modules, working, tables)
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
      tip: told
        ? `${told.totals.people} people, ${told.totals.organizations} organizations, ${told.totals.decisions} decisions`
        : `${shown.length} ${shown.length === 1 ? 'module' : 'modules'}`,
    },
  ]
  const edges: { a: string; b: string; dashed?: boolean; between?: boolean; tip?: string }[] = []
  const buckets: { table: string; kids: Kid[] }[] = []
  shown.forEach((m, i) => {
    const summary = modules.find((x) => x.id === m.id)
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
      tip: `${m.name}: ${m.rows.toLocaleString()} rows in ${m.tables} tables, ${m.agents} agents${told ? `, ${m.documents} documents` : ''}`,
    })
    // a module inside another hangs off it; the rest off Alpha
    const parent = summary?.parent
    edges.push({ a: parent && shown.some((s) => s.id === parent) ? parent : 'alpha', b: m.id })
    // one layer out: its pages, its tables (main first) and its agents, six of each at most,
    // fanned outward within the module's share of the circle
    const pages = (summary?.pages ?? []).map(
      (p): Kid => ({
        key: `${m.id}/page/${p.name}`,
        label: p.title,
        kind: 'page',
        tone: 'accent',
        href: `#/module/${m.id}/page/${p.name}`,
        tip: `${m.name} › ${p.title}`,
      }),
    )
    const order = { main: 0, setup: 1, part: 2, people: 3 }
    const tbls = (summary?.tables ?? [])
      .filter((t) => t.place !== 'people')
      .sort((a, b) => order[a.place] - order[b.place])
      .map(
        (t): Kid => ({
          key: t.id,
          label: t.name,
          kind: 'table',
          tone: 'faint',
          href: `#/table/${t.id}`,
          tip: `${t.name}: ${t.rows.toLocaleString()} rows`,
        }),
      )
    const agents = (working.find((w) => w.id === m.id)?.agents ?? []).map(
      (a): Kid => ({
        key: a.id,
        label: a.name,
        kind: 'agent',
        tone: a.needs ? 'warn' : a.state === 'on' ? 'good' : 'faint',
        href: `#/agent/${a.id}`,
        tip: `${a.name}: ${a.needs ? `needs ${a.needs}` : a.state === 'on' ? a.when : 'paused'}`,
      }),
    )
    const kids = [
      ...cap(pages, m.id, `#/module/${m.id}`, 'pages'),
      ...cap(tbls, m.id, `#/module/${m.id}`, 'tables'),
      ...cap(agents, m.id, `#/module/${m.id}/agents`, 'agents'),
    ]
    const share = (Math.PI * 2) / Math.max(1, shown.length)
    kids.forEach((k, j) => {
      const spread = Math.min(0.75 * share, 0.16 * kids.length)
      const a = angle + (kids.length > 1 ? (j / (kids.length - 1) - 0.5) * spread : 0)
      nodes.push({
        ...k,
        x: cx + Math.cos(a) * 300 * sx,
        y: cy + Math.sin(a) * 265 * sy,
        r: k.kind === 'agent' ? 6 : 5,
      })
      edges.push({ a: m.id, b: k.key })
      const t = k.kind === 'table' ? tables.find((x) => x.id === k.key) : undefined
      if (t) buckets.push({ table: t.id, kids: bucketsOf(t) })
    })
  })
  // each table's buckets on a small arc on its outer side, named on hover
  const placed = new Map(nodes.map((n) => [n.key, n]))
  for (const { table, kids } of buckets) {
    const t = placed.get(table)
    if (!t) continue
    const out = Math.atan2(t.y - cy, t.x - cx)
    kids.forEach((k, j) => {
      const a = out + (kids.length > 1 ? (j / (kids.length - 1) - 0.5) * Math.PI * 0.9 : 0)
      nodes.push({ ...k, x: t.x + Math.cos(a) * 18, y: t.y + Math.sin(a) * 18, r: 3 })
      edges.push({ a: table, b: k.key })
    })
  }
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
  // data carried between modules: table to table where both are drawn, else module to module
  const at = new Map(nodes.map((n) => [n.key, n]))
  const end = (m: string, table: string) => {
    const id = modules.find((x) => x.id === m)?.tables.find((t) => t.name === table)?.id
    return id && at.has(id) ? id : m
  }
  for (const l of brain.links)
    if (l.from !== l.to && at.has(l.from) && at.has(l.to))
      edges.push({
        a: end(l.from, l.fromTable),
        b: end(l.to, l.toTable),
        between: true,
        tip: `${l.fromTable} → ${l.toTable} by ${l.field}`,
      })

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
        const between = e.between === true
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
          {n.kind === 'agent' || n.kind === 'page' ? (
            <rect
              x={n.x - n.r}
              y={n.y - n.r}
              width={n.r * 2}
              height={n.r * 2}
              transform={n.kind === 'agent' ? `rotate(45 ${n.x} ${n.y})` : undefined}
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
            n.kind === 'more' ||
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
        Table, its small dots the buckets its rows fall in
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 bg-accent" />
        Page
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
