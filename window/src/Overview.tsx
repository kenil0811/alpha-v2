// A module's Overview (Vikas, 27 Oct; proposal v4): the pulse strip on top, the same block Home
// shows for the module; under it the module's own work on the left (what waits on the person,
// then its charts, the most opened first) and the standard column on the right, the same cards in
// the same order in every module: Interview me, Files, Agents, Intelligence, What Alpha may do,
// Tables. Every line, bar, slice and count opens what it counts: a table filtered to those rows,
// with Show original list. A card's head is its name only; a card with nothing to show is not drawn.
import type {
  AgentView,
  CardView,
  ModuleFileView,
  ModuleView,
  RowView,
  RuleView,
  RunView,
  TableView as TableData,
} from '@alpha/core/api'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Image,
  Maximize2,
  Minimize2,
  Pin,
  RefreshCw,
  Sheet,
  Upload,
} from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Undo } from './Activity.tsx'
import { api } from './api.ts'
import { startAsk } from './ask.ts'
import { useLayout } from './layout.ts'
import { when } from './ModulesAndAgents.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Chart, type ChartKind, KindPicker, type Mark } from './ui/chart.tsx'
import { cn } from './ui/cn.ts'
import { Dot, type Signal, strongest } from './ui/dot.tsx'
import { Switch } from './ui/switch.tsx'

type Table = ModuleView['tables'][number]
type Field = TableData['fields'][number]

// A table's rows, filtered to the ones a mark counts; the table says why and offers the whole.
export const rowsHref = (t: { id: string }, rows: RowView[], why: string) =>
  `#/table/${t.id}?only=${rows.map((r) => r.id).join(',')}&why=${encodeURIComponent(why)}`

// A screen or card opened, counted per person by the core: it orders the work column and Home.
export const seen = (key: string) => {
  api.post('/api/seen', { key }).catch(() => undefined)
}

// The tables pinned to the bar's switch, kept per person by the core; none pinned yet is the
// first four main tables.
export function usePins(m: Pick<ModuleView, 'id' | 'tables'> | null) {
  const { layout, change } = useLayout()
  const pins = m
    ? (layout.pins[m.id] ??
      m.tables
        .filter((t) => t.place === 'main')
        .slice(0, 4)
        .map((t) => t.id))
    : []
  const toggle = (id: string) => {
    if (!m) return
    const next = pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id]
    change({ pins: { ...layout.pins, [m.id]: next } })
  }
  return { pins, toggle }
}

// A main table lower on the spine relates to another main table (a deal to its source): it goes
// first in the switch. ponytail: by a relation field named as the other table, since the window
// is not told a relation's table; the core sending relatesTo replaces it.
export function lowerFirst(main: TableData[]): TableData[] {
  const relates = (t: TableData) => main.some((o) => o !== t && relationTo(t, o))
  return [...main].sort((a, b) => Number(relates(b)) - Number(relates(a)))
}
const relationTo = (t: TableData, o: { name: string }) =>
  t.fields.find(
    (f) =>
      f.kind === 'relation' &&
      o.name.toLowerCase().replace(/s$/, '') === f.name.toLowerCase().replace(/s$/, ''),
  )

const val = (r: RowView, f: Field) => r.values[f.slug] ?? r.values[f.name]
const num = (v: unknown): number | null =>
  typeof v === 'number'
    ? v
    : v && typeof v === 'object' && 'amount' in v
      ? Number((v as { amount: number }).amount)
      : null
const plural = (n: number, word: string, many = `${word}s`) =>
  `${n.toLocaleString()} ${n === 1 ? word : many}`
const WEEK = 7 * 864e5
const STEPS = [1, 0.75, 0.55, 0.4, 0.3, 0.2]

// What a card asks, as a signal: a sign-in has stopped work until it is done, so it needs the
// person now; anything put to them for a yes waits for it; the rest is for their information.
export const signalOf = (c: CardView): Signal =>
  c.gate === 'sign_in' || c.site || c.connector
    ? 'now'
    : c.draft || c.proposed || c.review || c.match || c.filing || c.options.length
      ? 'yes'
      : 'opt'
export const isQuestion = (c: CardView) =>
  c.options.length > 0 && !c.draft && !c.proposed && !c.review && !c.match && !c.filing

// --- What the module's tables say: read from their shape, never named --------------------

// The single choice that spreads the rows the most: Deals by stage, or by status at the source.
function spreadOf(t: TableData) {
  return t.fields
    .filter((f) => f.kind === 'choice' && !f.many && f.choices.length >= 3)
    .map((f) => ({
      f,
      marks: f.choices.map((c) => {
        const rows = t.rows.filter((r) => val(r, f) === c)
        return { label: c, n: rows.length, href: rowsHref(t, rows, `${f.name} is ${c}`) }
      }),
    }))
    .filter((x) => x.marks.filter((m) => m.n).length >= 2)
    .sort((a, b) => b.marks.filter((m) => m.n).length - a.marks.filter((m) => m.n).length)
}

// Rows counted by the row of another main table they point at: deals by source.
function fromOf(t: TableData, main: TableData[]) {
  for (const o of main) {
    if (o === t) continue
    const f = relationTo(t, o)
    if (!f) continue
    const by = new Map<string, RowView[]>()
    for (const r of t.rows) {
      const v = val(r, f)
      for (const id of Array.isArray(v) ? v : v ? [v] : [])
        by.set(String(id), [...(by.get(String(id)) ?? []), r])
    }
    const marks = [...by.entries()]
      .map(([id, rows]) => {
        const name = String(t.names[id] ?? id)
        return { label: name, n: rows.length, href: rowsHref(t, rows, `from ${name}`) }
      })
      .sort((a, b) => b.n - a.n)
    if (marks.length >= 2) return { from: o, marks }
  }
  return null
}

// New rows by week, by the date most of them carry (first seen, added): the last six weeks.
function weeksOf(t: TableData) {
  const f = t.fields
    .filter((x) => x.kind === 'date')
    .map((x) => ({ x, n: t.rows.filter((r) => val(r, x)).length }))
    .sort((a, b) => b.n - a.n)[0]
  if (!f || f.n < t.rows.length / 2) return null
  const now = Date.now()
  const weeks = [5, 4, 3, 2, 1, 0].map((ago) => {
    const rows = t.rows.filter((r) => {
      const d = Date.parse(String(val(r, f.x)))
      return d > now - (ago + 1) * WEEK && d <= now - ago * WEEK
    })
    const label = ago === 0 ? 'This week' : ago === 1 ? 'Last week' : `${ago} weeks ago`
    return {
      label,
      n: rows.length,
      rows,
      href: rowsHref(t, rows, `${f.x.name} ${label.toLowerCase()}`),
    }
  })
  return { field: f.x, weeks }
}

// Goals: a setup table whose choice names a point on a main table's choice (a stage), with a
// number per week. Measured by the rows at or past that point now, or dated this week by a date
// field of the same name.
function goalsOf(setup: TableData[], main: TableData[]) {
  for (const g of setup) {
    const pick = g.fields.find((f) => f.kind === 'choice')
    const target = g.fields.find((f) => f.kind === 'number')
    const name = g.fields.find((f) => f.kind === 'text')
    if (!pick || !target || !name) continue
    for (const t of main) {
      const stage = t.fields.find(
        (f) => f.kind === 'choice' && f.choices.filter((c) => pick.choices.includes(c)).length >= 3,
      )
      if (!stage) continue
      const marks: Mark[] = g.rows.map((r) => {
        const at = String(val(r, pick) ?? '')
        const i = stage.choices.indexOf(at)
        const dated = t.fields.find((f) => f.kind === 'date' && f.name === at)
        const rows =
          i >= 0
            ? t.rows.filter((x) => stage.choices.indexOf(String(val(x, stage) ?? '')) >= i)
            : dated
              ? t.rows.filter((x) => Date.now() - Date.parse(String(val(x, dated))) < WEEK)
              : []
        return {
          label: String(val(r, name) ?? at),
          n: rows.length,
          target: num(val(r, target)) ?? 0,
          href: rowsHref(t, rows, i >= 0 ? `${stage.name} at ${at} or past it` : `${at} this week`),
        }
      })
      if (marks.length) return { goals: g, table: t, marks }
    }
  }
  return null
}

// Criteria: a setup table of tests on a main table's fields (at most, at least a value): each
// one's bar is the rows it rules out now.
function criteriaOf(setup: TableData[], main: TableData[]) {
  for (const c of setup) {
    const test = c.fields.find(
      (f) => f.kind === 'choice' && f.choices.includes('At most') && f.choices.includes('At least'),
    )
    const value = c.fields.find((f) => f.kind === 'number')
    const name = c.fields.find((f) => f.kind === 'text')
    if (!test || !value || !name) continue
    for (const t of main) {
      const on = c.fields.find(
        (f) =>
          f.kind === 'text' &&
          c.rows.some((r) => t.fields.some((x) => x.name === String(val(r, f) ?? ''))),
      )
      if (!on) continue
      const marks = c.rows.flatMap((r) => {
        const field = t.fields.find((x) => x.name === String(val(r, on) ?? ''))
        const limit = num(val(r, value))
        if (!field || limit === null) return []
        const most = val(r, test) === 'At most'
        const out = t.rows.filter((x) => {
          const v = num(val(x, field))
          return v !== null && (most ? v > limit : v < limit)
        })
        const why = `${field.name} ${most ? 'over' : 'under'} ${limit.toLocaleString()}`
        return [
          { label: String(val(r, name) ?? field.name), n: out.length, href: rowsHref(t, out, why) },
        ]
      })
      if (marks.length) return { criteria: c, table: t, marks }
    }
  }
  return null
}

// --- The pulse strip: Home shows the same block for each module ---------------------------

export interface Tile {
  key: string
  label: string
  signal: Signal
  big: string
  small: string
  spark?: number[]
  lines: { s: Signal; words: string; href?: string }[]
  go: string // the card it stands for, scrolled to on a second click
}

export function pulseOf({
  m,
  main,
  setup,
  cards,
  runs,
}: {
  m: Pick<ModuleView, 'name' | 'agents'>
  main: TableData[]
  setup: TableData[]
  cards: CardView[]
  runs: RunView[] | null
}): Tile[] {
  const tiles: Tile[] = []
  const waiting = cards.filter((c) => c.module === m.name && !isQuestion(c))
  if (waiting.length)
    tiles.push({
      key: 'waiting',
      label: 'Waiting on you',
      signal: strongest(waiting.map(signalOf)) ?? 'yes',
      big: String(waiting.length),
      small: waiting.length === 1 ? 'thing' : 'things',
      lines: waiting.slice(0, 4).map((c) => ({ s: signalOf(c), words: c.words, href: '#/' })),
      go: 'needs',
    })
  const goals = goalsOf(setup, main)
  if (goals) {
    const met = goals.marks.filter((g) => g.n >= (g.target ?? 0)).length
    tiles.push({
      key: 'goals',
      label: 'Goals',
      signal: met === goals.marks.length ? 'done' : 'opt',
      big: String(met),
      small: `of ${goals.marks.length} on target`,
      lines: goals.marks.map((g) => ({
        s: g.n >= (g.target ?? 0) ? 'done' : 'opt',
        words: `${g.label}: ${g.n} of ${g.target}`,
        ...(g.href ? { href: g.href } : {}),
      })),
      go: 'goals',
    })
  }
  const big = [...main].sort((a, b) => b.rows.length - a.rows.length)[0]
  const weeks = big && weeksOf(big)
  if (big && weeks) {
    const now = weeks.weeks.at(-1)
    const last = weeks.weeks.at(-2)
    const spread = spreadOf(big)[0]
    const more = (now?.n ?? 0) - (last?.n ?? 0)
    tiles.push({
      key: 'new',
      label: `New ${big.name.toLowerCase()} this week`,
      signal: 'opt',
      big: (now?.n ?? 0).toLocaleString(),
      small: `${more >= 0 ? '+' : ''}${more.toLocaleString()}`,
      spark: weeks.weeks.map((w) => w.n),
      lines: [
        ...(now ? [{ s: 'opt' as const, words: `All ${now.n} new`, href: now.href }] : []),
        ...(spread?.marks ?? []).flatMap((x) => {
          const rows = (now?.rows ?? []).filter((r) => val(r, spread?.f as Field) === x.label)
          const why = `new this week, ${spread?.f.name} is ${x.label}`
          return rows.length
            ? [
                {
                  s: 'opt' as const,
                  words: `${rows.length} ${x.label}`,
                  href: rowsHref(big, rows, why),
                },
              ]
            : []
        }),
      ].slice(0, 4),
      go: `weeks:${big.id}`,
    })
  }
  const questions = cards.filter((c) => c.module === m.name && isQuestion(c))
  tiles.push({
    key: 'questions',
    label: questions.length ? 'Questions for you' : 'Interview me',
    signal: questions.length ? 'yes' : 'opt',
    big: questions.length ? String(questions.length) : 'Start',
    small: questions.length ? 'to answer' : 'a short one',
    lines: questions.length
      ? questions.slice(0, 3).map((c) => ({ s: 'yes' as const, words: c.words }))
      : [{ s: 'opt', words: 'Alpha asks one question at a time' }],
    go: 'ask',
  })
  if (m.agents.length) {
    const on = m.agents.filter((a) => a.state === 'on')
    const needs = m.agents.filter((a) => a.needs)
    const last =
      m.agents
        .map((a) => a.lastRunAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null
    tiles.push({
      key: 'agents',
      label: 'Agents',
      signal: needs.length ? 'now' : on.length ? 'done' : 'opt',
      big: String(on.length),
      small: `of ${m.agents.length} on`,
      lines: [
        ...needs.slice(0, 2).map((a) => ({
          s: 'now' as const,
          words: `${a.name} needs ${a.needs}`,
          href: `#/agent/${a.id}`,
        })),
        ...(m.agents.length - on.length
          ? [{ s: 'opt' as const, words: `${m.agents.length - on.length} off` }]
          : []),
        { s: 'done' as const, words: `Last ran ${when(last)}` },
      ],
      go: 'agents',
    })
  }
  const changed = (runs ?? []).filter(
    (r) => !r.quiet && Date.now() - Date.parse(r.startedAt) < WEEK,
  )
  if (tiles.length < 5 && changed.length)
    tiles.push({
      key: 'changed',
      label: 'Alpha changed',
      signal: 'opt',
      big: String(changed.length),
      small: changed.length === 1 ? 'thing this week' : 'things this week',
      lines: changed
        .slice(0, 3)
        .map((r) => ({ s: 'opt' as const, words: r.words ?? r.name, href: `#/run/${r.id}` })),
      go: 'maydo',
    })
  return tiles.slice(0, 5)
}

// Hover a tile and it opens a little to list what it counts; a click keeps it open; a second
// click goes to its card.
export function Strip({ tiles, onGo }: { tiles: Tile[]; onGo: (go: string) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])
  if (!tiles.length) return null
  return (
    <div ref={box} className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
      {tiles.map((t) => {
        const on = open === t.key
        return (
          <div key={t.key} className="group/tile relative h-19">
            {/* biome-ignore lint/a11y/useSemanticElements: it holds links of its own */}
            <div
              role="button"
              tabIndex={0}
              aria-expanded={on}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('a')) return
                if (on) {
                  setOpen(null)
                  onGo(t.go)
                } else setOpen(t.key)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') on ? onGo(t.go) : setOpen(t.key)
                if (e.key === 'Escape') setOpen(null)
              }}
              className={cn(
                'absolute inset-x-0 top-0 min-h-19 cursor-pointer overflow-hidden rounded-lg border border-line bg-surface px-3 py-2.5 transition-shadow',
                'group-hover/tile:z-10 group-hover/tile:shadow-pop',
                on && 'z-10 border-accent-line shadow-pop',
              )}
            >
              <div className="flex items-center gap-2 text-ink-3 text-sm">
                <Dot s={t.signal} />
                <span className="truncate">{t.label}</span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span className="font-serif text-2xl">{t.big}</span>
                  <span className="truncate text-ink-3 text-sm">{t.small}</span>
                </div>
                {t.spark && <Spark points={t.spark} />}
              </div>
              <div
                className={cn(
                  'mt-2 hidden border-hair border-t pt-1.5 group-hover/tile:block',
                  on && 'block',
                )}
              >
                {t.lines.map((l) => (
                  <div key={l.words} className="flex items-center gap-2 py-0.5 text-sm">
                    <Dot s={l.s} />
                    {l.href ? (
                      <a href={l.href} className="truncate hover:text-accent hover:underline">
                        {l.words}
                      </a>
                    ) : (
                      <span className="truncate">{l.words}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Spark({ points }: { points: number[] }) {
  const most = Math.max(1, ...points)
  const d = points.map((p, i) => `${i * 12},${22 - (p / most) * 20}`).join(' ')
  return (
    <svg viewBox="0 0 62 24" className="h-6 w-16 shrink-0" aria-hidden="true">
      <polyline points={d} fill="none" strokeWidth="1.75" className="stroke-accent" />
    </svg>
  )
}

// The setup tables with rows, whole: goals and criteria are read from them.
export function useSetup(m: ModuleView | null, version: number) {
  const [setup, setSetup] = useState<TableData[]>([])
  const ids = (m?.tables ?? [])
    .filter((t) => t.place === 'setup' && t.rows > 0)
    .map((t) => t.id)
    .join(',')
  useEffect(() => {
    if (version < 0) return
    if (!ids) return setSetup([])
    Promise.all(ids.split(',').map((id) => api.get<TableData>(`/api/tables/${id}`))).then(
      setSetup,
      () => setSetup([]),
    )
  }, [ids, version])
  return setup
}

// --- The Overview ---------------------------------------------------------------------------

export function Overview({
  m,
  main,
  cards,
  version,
  onChange,
}: {
  m: ModuleView
  main: TableData[]
  cards: CardView[]
  version: number
  onChange: () => void
}) {
  const [runs, setRuns] = useState<RunView[] | null>(null)
  const [rules, setRules] = useState<RuleView[]>([])
  const setup = useSetup(m, version)
  const { layout } = useLayout()
  useEffect(() => {
    if (version < 0) return
    api.get<RunView[]>('/api/activity').then(
      (all) => setRuns(all.filter((r) => r.moduleId === m.id)),
      () => setRuns([]),
    )
    api.get<RuleView[]>(`/api/rules?module=${encodeURIComponent(m.id)}`).then(
      (all) => setRules(all.filter((r) => !r.revokedAt)),
      () => setRules([]),
    )
  }, [m.id, version])
  useEffect(() => seen(`module:${m.id}`), [m.id])

  const tiles = pulseOf({ m, main, setup, cards, runs })
  const go = (id: string) =>
    document.getElementById(`ov-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // the module's own cards, the most opened first
  const work: { key: string; node: ReactNode }[] = []
  for (const t of main) {
    const spread = spreadOf(t)[0]
    if (spread)
      work.push({
        key: `chart:${t.id}`,
        node: (
          <ChartCard
            id={`chart:${t.id}`}
            title={`${t.name} by ${spread.f.name.toLowerCase()}`}
            href={`#/table/${t.id}`}
            kinds={['bar', 'donut', 'funnel']}
            marks={spread.marks}
          />
        ),
      })
    const from = fromOf(t, main)
    if (from)
      work.push({
        key: `from:${t.id}`,
        node: (
          <ChartCard
            id={`from:${t.id}`}
            title={`Where ${t.name.toLowerCase()} come from`}
            href={`#/table/${from.from.id}`}
            kinds={['bar', 'donut']}
            marks={from.marks}
            few={8}
          />
        ),
      })
  }
  const goals = goalsOf(setup, main)
  if (goals)
    work.push({
      key: 'goals',
      node: (
        <ChartCard
          id="goals"
          title="Goals"
          href={`#/table/${goals.goals.id}`}
          kinds={['bullet', 'rings']}
          marks={goals.marks}
        />
      ),
    })
  const criteria = criteriaOf(setup, main)
  if (criteria)
    work.push({
      key: 'criteria',
      node: (
        <ChartCard
          id="criteria"
          title={`What rules ${criteria.table.name.toLowerCase()} out`}
          href={`#/table/${criteria.criteria.id}`}
          kinds={['bar', 'donut']}
          marks={criteria.marks}
        />
      ),
    })
  const big = [...main].sort((a, b) => b.rows.length - a.rows.length)[0]
  const weeks = big && weeksOf(big)
  if (big && weeks && weeks.weeks.filter((w) => w.n).length >= 2)
    work.push({
      key: `weeks:${big.id}`,
      node: (
        <ChartCard
          id={`weeks:${big.id}`}
          title={`New ${big.name.toLowerCase()} by week`}
          href={`#/table/${big.id}`}
          kinds={['bar', 'donut']}
          marks={weeks.weeks}
        />
      ),
    })
  const count = (key: string) => layout.seen[`card:${m.id}:${key}`] ?? 0
  work.sort((a, b) => count(b.key) - count(a.key))
  const waiting = cards.filter((c) => c.module === m.name && !isQuestion(c))

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-4 px-7 py-4">
        <Strip tiles={tiles} onGo={go} />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            {waiting.length > 0 && <NeedsYou cards={waiting} />}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] items-start gap-4">
              {work.map((w) => (
                <div
                  key={w.key}
                  className="contents"
                  onClickCapture={() => seen(`card:${m.id}:${w.key}`)}
                >
                  {w.node}
                </div>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <InterviewMe m={m} cards={cards} onChange={onChange} />
            <Files m={m} onChange={onChange} />
            <Agents m={m} main={main} onChange={onChange} />
            <Intelligence m={m} rules={rules} />
            <MayDo m={m} runs={runs} rules={rules} onChange={onChange} />
            <Tables m={m} />
          </div>
        </div>
      </div>
    </div>
  )
}

// A card: its name, which opens its page; a count when there is one; its actions and Show more at
// the right of the head. No line of explanation under the name.
function Card({
  id,
  title,
  href,
  count,
  signal,
  grows,
  extra,
  children,
}: {
  id: string
  title: string
  href: string
  count?: number
  signal?: Signal | null
  grows?: boolean
  extra?: ReactNode
  children: (big: boolean) => ReactNode
}) {
  const [big, setBig] = useState(false)
  return (
    <section
      id={`ov-${id}`}
      className={cn(
        'flex min-w-0 flex-col rounded-lg border border-line bg-surface transition-shadow hover:shadow-pop',
        big && 'col-span-full',
      )}
    >
      <div className="flex h-11 items-center gap-2 px-3">
        {signal && <Dot s={signal} />}
        <a
          href={href}
          className="min-w-0 truncate font-semibold text-base text-ink hover:text-accent hover:underline"
        >
          {title}
        </a>
        {!!count && <span className="text-ink-3 text-sm tabular-nums">{count}</span>}
        <span className="flex-1" />
        {extra}
        {grows && (
          <button
            type="button"
            aria-label={big ? 'Show less' : 'Show more'}
            data-tip={big ? 'Show less' : 'Show more'}
            onClick={() => setBig(!big)}
            className="grid size-6 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink"
          >
            {big ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        )}
      </div>
      <div className="px-3 pb-3">{children(big)}</div>
    </section>
  )
}

// One line of a card: its signal, what it is, then its actions on the right, the primary last.
function Line({
  s,
  children,
  actions,
}: {
  s?: Signal | undefined
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex min-h-9 items-center gap-2.5 border-hair border-t py-1.5 text-md">
      {s && <Dot s={s} />}
      <div className="min-w-0 flex-1">{children}</div>
      {actions}
    </div>
  )
}

function ChartCard({
  id,
  title,
  href,
  kinds,
  marks,
  few,
}: {
  id: string
  title: string
  href: string
  kinds: ChartKind[]
  marks: Mark[]
  few?: number
}) {
  const [kind, setKind] = useState<ChartKind>(kinds[0] ?? 'bar')
  const shown = marks.filter((x) => x.n > 0 || x.target !== undefined)
  const cut = few ?? shown.length
  return (
    <Card
      id={id}
      title={title}
      href={href}
      grows={shown.length > cut || shown.length !== marks.length}
      extra={<KindPicker kinds={kinds} kind={kind} onKind={setKind} />}
    >
      {(big) => <Chart kind={kind} marks={big ? marks : shown.slice(0, cut)} />}
    </Card>
  )
}

// What waits on the person here, each with its signal; its primary opens it on Home, where it is
// answered.
function NeedsYou({ cards }: { cards: CardView[] }) {
  const verb = (c: CardView) =>
    c.gate === 'sign_in' || c.site || c.connector
      ? 'Sign in'
      : c.draft
        ? 'Review and send'
        : c.review || c.match || c.filing || c.proposed
          ? 'Review'
          : 'Open'
  return (
    <Card
      id="needs"
      title="Needs you"
      href="#/"
      count={cards.length}
      signal={strongest(cards.map(signalOf))}
      grows={cards.length > 5}
    >
      {(big) =>
        (big ? cards : cards.slice(0, 5)).map((c) => (
          <Line
            key={c.id}
            s={signalOf(c)}
            actions={
              <Button size="sm" variant="primary" onClick={() => (window.location.hash = '#/')}>
                {verb(c)}
              </Button>
            }
          >
            <span className="line-clamp-2">{c.words}</span>
          </Line>
        ))
      }
    </Card>
  )
}

// --- The standard column ------------------------------------------------------------------

// Alpha's questions for the person, each answered in place; Start begins an interview.
function InterviewMe({
  m,
  cards,
  onChange,
}: {
  m: ModuleView
  cards: CardView[]
  onChange: () => void
}) {
  const { busy, problem, act } = useAct(onChange)
  const questions = cards.filter((c) => c.module === m.name && isQuestion(c))
  const interview = () =>
    startAsk(
      `Interview me about ${m.name}: ask me one short question at a time about how I work and what I want from it, and keep what you learn in its notes.`,
    )
  return (
    <Card
      id="ask"
      title="Interview me"
      href={`#/module/${m.id}/conversation`}
      count={questions.length}
      extra={
        <Button size="sm" variant={questions.length ? 'default' : 'primary'} onClick={interview}>
          {questions.length ? 'Ask me more' : 'Start'}
        </Button>
      }
    >
      {() => (
        <div>
          <Refusal words={problem} />
          {questions.slice(0, 4).map((c) => (
            <Line
              key={c.id}
              s="yes"
              actions={c.options.map((o, i) => (
                <Button
                  key={o}
                  size="sm"
                  variant={i === c.options.length - 1 ? 'primary' : 'default'}
                  disabled={busy}
                  onClick={() => act(() => api.post(`/api/cards/${c.id}`, { answer: o }))}
                >
                  {o}
                </Button>
              ))}
            >
              {c.words}
            </Line>
          ))}
          {!questions.length && (
            <Line s="opt">
              <span className="text-ink-2">
                One question at a time; each answer goes into {m.name}'s notes.
              </span>
            </Line>
          )}
        </div>
      )}
    </Card>
  )
}

// The module's files as a desktop: an icon each, its name, the row it sits on. Drop a file on it
// to add it; Alpha reads it and files it.
function Files({ m, onChange }: { m: ModuleView; onChange: () => void }) {
  const { busy, problem, act } = useAct(onChange)
  const [over, setOver] = useState(false)
  const icon = (f: ModuleFileView) =>
    f.mime.startsWith('image/') ? Image : /sheet|csv|excel/.test(f.mime) ? Sheet : FileText
  const drop = (files: FileList) => act(() => Promise.all([...files].map((f) => api.upload(f))))
  const unread = m.files.filter((f) => f.read !== 'read').length
  return (
    <Card
      id="files"
      title="Files"
      href={`#/module/${m.id}/agents`}
      count={m.files.length}
      signal={unread ? 'opt' : null}
      grows={m.files.length > 8}
    >
      {(big) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: a drop target; the files are links
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            drop(e.dataTransfer.files)
          }}
          className={cn(
            'rounded-md border border-dashed p-1.5',
            over ? 'border-accent bg-accent-soft' : 'border-line',
          )}
        >
          <Refusal words={problem} />
          {m.files.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-1">
              {(big ? m.files : m.files.slice(0, 8)).map((f) => {
                const Icon = icon(f)
                return (
                  <a
                    key={`${f.hash}${f.row.id}`}
                    href={`#/row/${f.row.id}`}
                    data-tip={`${f.name}, on ${f.row.name}${f.read === 'read' ? '' : '; not read yet'}`}
                    className="relative flex flex-col items-center gap-1 rounded-md p-1.5 text-center hover:bg-hover"
                  >
                    <Icon className="size-8 text-ink-3" strokeWidth={1.25} />
                    {f.read !== 'read' && (
                      <Dot
                        s={f.read === 'reading' ? 'done' : 'opt'}
                        tip={f.read === 'reading' ? 'Being read' : 'Not read yet'}
                        className="absolute top-1 right-3"
                      />
                    )}
                    <span className="line-clamp-2 break-all text-xs">{f.name}</span>
                  </a>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-4 text-ink-3 text-sm">
              <Upload className="size-5" />
              {busy ? 'Adding…' : 'Drop files here'}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// Agents named after the rows of one of the module's tables are one line, one switch for all: the
// 20 source readers of DealPilot read as "Source readers, 15 of 20 on".
function groupsOf(agents: AgentView[], main: TableData[]) {
  const groups: { name: string; agents: AgentView[] }[] = []
  let rest = agents
  for (const t of main) {
    const names = new Set(
      t.rows.map((r) => String(r.values.Name ?? r.values.name ?? '')).filter(Boolean),
    )
    const mine = rest.filter((a) => names.has(a.name))
    if (mine.length < 3) continue
    groups.push({ name: `${t.name.replace(/s$/, '')} readers`, agents: mine })
    rest = rest.filter((a) => !mine.includes(a))
  }
  return { groups, rest }
}
const agentSignal = (a: AgentView): Signal => (a.needs ? 'now' : a.state === 'on' ? 'done' : 'opt')

function Agents({ m, main, onChange }: { m: ModuleView; main: TableData[]; onChange: () => void }) {
  const { busy, problem, act } = useAct(onChange)
  if (!m.agents.length) return null
  const { groups, rest } = groupsOf(m.agents, main)
  const on = m.agents.filter((a) => a.state === 'on').length
  const turn = (as: AgentView[], state: boolean) =>
    act(() =>
      Promise.all(
        as.map((a) => api.post(`/api/agents/${a.id}`, { state: state ? 'on' : 'paused' })),
      ),
    )
  const sync = (as: AgentView[]) =>
    act(() =>
      Promise.all(
        as.filter((a) => a.state === 'on').map((a) => api.post(`/api/agents/${a.id}/run`)),
      ),
    )
  const toggle = (a: AgentView) => (
    <Switch
      checked={a.state === 'on'}
      disabled={busy}
      label={a.state === 'on' ? `Pause ${a.name}` : `Turn on ${a.name}`}
      onChange={(v) => turn([a], v)}
    />
  )
  return (
    <Card
      id="agents"
      title="Agents"
      href={`#/module/${m.id}/agents`}
      count={on}
      grows={groups.length > 0}
    >
      {(big) => (
        <div>
          <Refusal words={problem} />
          {groups.map((g) => {
            const gon = g.agents.filter((a) => a.state === 'on')
            return (
              <div key={g.name}>
                <Line
                  s={strongest(g.agents.map(agentSignal)) ?? 'opt'}
                  actions={
                    <>
                      <Button
                        size="sm"
                        disabled={busy || !gon.length}
                        onClick={() => sync(g.agents)}
                        data-tip={`Run every ${g.name.toLowerCase().replace(/s$/, '')} that is on, now`}
                      >
                        <RefreshCw className="size-3.5" />
                        Sync now
                      </Button>
                      <Switch
                        checked={gon.length > 0}
                        disabled={busy}
                        label={gon.length ? `Pause every ${g.name}` : `Turn on every ${g.name}`}
                        onChange={(v) => turn(g.agents, v)}
                      />
                    </>
                  }
                >
                  {g.name}{' '}
                  <span className="text-ink-3 text-sm">
                    {gon.length} of {g.agents.length} on
                  </span>
                  <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-sunk">
                    <span
                      className="bg-good"
                      style={{ width: `${(gon.length / g.agents.length) * 100}%` }}
                    />
                  </div>
                </Line>
                {big &&
                  g.agents.map((a) => (
                    <Line key={a.id} s={agentSignal(a)} actions={toggle(a)}>
                      <a
                        href={`#/agent/${a.id}`}
                        className="pl-3 hover:text-accent hover:underline"
                      >
                        {a.name}
                      </a>{' '}
                      <span className="text-ink-3 text-sm">
                        {a.state === 'on' ? `ran ${when(a.lastRunAt)}` : 'off'}
                      </span>
                    </Line>
                  ))}
              </div>
            )
          })}
          {rest.map((a) => (
            <Line key={a.id} s={agentSignal(a)} actions={toggle(a)}>
              <a href={`#/agent/${a.id}`} className="hover:text-accent hover:underline">
                {a.name}
              </a>{' '}
              <span className="text-ink-3 text-sm">{a.when}</span>
            </Line>
          ))}
        </div>
      )}
    </Card>
  )
}

// What Alpha knows about the module, counted: the notes it reads first, the documents it has
// read, the rules it keeps, the agents that work here; then what it keeps, table by table.
function Intelligence({ m, rules }: { m: ModuleView; rules: RuleView[] }) {
  const notes = m.notes.split('\n').filter((l) => !l.startsWith('#') && l.trim().length > 20)
  const here = `#/module/${m.id}/agents`
  const tiles = [
    { n: notes.length, label: 'notes', href: here },
    { n: m.files.filter((f) => f.read === 'read').length, label: 'documents read', href: here },
    { n: rules.length + 1, label: 'rules', href: here },
    { n: m.agents.length, label: 'agents', href: here },
  ]
  const kept = m.tables.filter((t) => t.rows).sort((a, b) => b.rows - a.rows)
  const total = kept.reduce((a, t) => a + t.rows, 0) || 1
  return (
    <Card id="intelligence" title="Intelligence" href="#/intelligence/brain">
      {() => (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-4 gap-2">
            {tiles.map((t) => (
              <a
                key={t.label}
                href={t.href}
                className="flex flex-col rounded-md bg-sunk px-2 py-1.5 hover:bg-hover"
              >
                <span className="font-serif text-xl tabular-nums">{t.n.toLocaleString()}</span>
                <span className="truncate text-ink-3 text-xs">{t.label}</span>
              </a>
            ))}
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-sunk">
            {kept.slice(0, 6).map((t, i) => (
              <a
                key={t.id}
                href={`#/table/${t.id}`}
                data-tip={`${t.name}: ${plural(t.rows, 'row')}`}
                className="bg-accent"
                style={{ width: `${(t.rows / total) * 100}%`, opacity: STEPS[i] }}
              >
                <span className="sr-only">{`${t.name}: ${plural(t.rows, 'row')}`}</span>
              </a>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-ink-2 text-sm">
            {kept.slice(0, 6).map((t, i) => (
              <a
                key={t.id}
                href={`#/table/${t.id}`}
                className="flex items-center gap-1.5 hover:text-accent"
              >
                <span className="size-2 rounded-xs bg-accent" style={{ opacity: STEPS[i] }} />
                {t.name} {t.rows.toLocaleString()}
              </a>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// What Alpha may do here: its rules as one bar (allowed, never; anything else asks first), then
// what it changed lately, each with Revert.
function MayDo({
  m,
  runs,
  rules,
  onChange,
}: {
  m: ModuleView
  runs: RunView[] | null
  rules: RuleView[]
  onChange: () => void
}) {
  const changed = (runs ?? []).filter((r) => !r.quiet)
  const allow = rules.filter((r) => r.side === 'allow').length
  const deny = rules.filter((r) => r.side === 'deny').length
  const parts = [
    { n: allow, label: `${allow} allowed`, cls: 'bg-good' },
    { n: 1, label: 'Anything else asks first', cls: 'bg-accent' },
    { n: deny, label: `${deny} never`, cls: 'bg-bad' },
  ].filter((p) => p.n)
  const total = parts.reduce((a, p) => a + p.n, 0)
  return (
    <Card
      id="maydo"
      title="What Alpha may do"
      href={`#/module/${m.id}/agents`}
      grows={changed.length > 3}
    >
      {(big) => (
        <div>
          <a href={`#/module/${m.id}/agents`} className="block">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
              {parts.map((p) => (
                <span
                  key={p.label}
                  className={p.cls}
                  style={{ width: `${(p.n / total) * 100}%` }}
                />
              ))}
            </div>
            <div className="mt-1.5 mb-1 flex flex-wrap gap-x-3 text-ink-2 text-sm hover:text-accent">
              {parts.map((p) => (
                <span key={p.label} className="flex items-center gap-1.5">
                  <span className={cn('size-2 rounded-xs', p.cls)} />
                  {p.label}
                </span>
              ))}
            </div>
          </a>
          {(big ? changed.slice(0, 12) : changed.slice(0, 3)).map((r) => (
            <Line key={r.id} s="opt" actions={<Undo run={r} onDone={onChange} />}>
              <a href={`#/run/${r.id}`} className="line-clamp-2 hover:text-accent hover:underline">
                {r.words ?? r.name}
              </a>
              <span className="text-ink-3 text-sm">{when(r.startedAt)}</span>
            </Line>
          ))}
        </div>
      )}
    </Card>
  )
}

// Every table of the module as a tree: main tables, the parts of a row under it, the setup tables
// last. The pin puts a table in the bar's switch, or takes it out.
function Tables({ m }: { m: ModuleView }) {
  const { pins, toggle } = usePins(m)
  const [open, setOpen] = useState<string[]>([])
  const main = m.tables.filter((t) => t.place === 'main')
  const setup = m.tables.filter((t) => t.place === 'setup')
  const partsOf = (name: string) => m.tables.filter((t) => t.place === 'part' && t.of === name)
  const row = (t: Table, depth: number, lead?: ReactNode) => (
    <div
      key={t.id}
      className="group/t flex h-8 items-center gap-1.5 border-hair border-t text-md"
      style={{ paddingLeft: depth * 16 }}
    >
      <span className="grid w-4 place-items-center text-ink-3">{lead}</span>
      <a
        href={`#/table/${t.id}`}
        className="min-w-0 truncate text-ink hover:text-accent hover:underline"
      >
        {t.name}
      </a>
      <span className="flex-1 text-ink-3 text-sm tabular-nums">{t.rows.toLocaleString()}</span>
      <button
        type="button"
        aria-label={
          pins.includes(t.id) ? `Unpin ${t.name} from the bar` : `Pin ${t.name} to the bar`
        }
        data-tip={pins.includes(t.id) ? 'Unpin from the bar' : 'Pin to the bar'}
        onClick={() => toggle(t.id)}
        className={cn(
          'grid size-6 place-items-center rounded-sm hover:bg-hover',
          pins.includes(t.id) ? 'text-accent' : 'text-ink-3 opacity-0 group-hover/t:opacity-100',
        )}
      >
        <Pin className="size-3.5" />
      </button>
    </div>
  )
  return (
    <Card id="tables" title="Tables" href={`#/module/${m.id}/agents`} count={m.tables.length}>
      {() => (
        <div>
          {main.map((t) => {
            const parts = partsOf(t.name)
            const shut = !open.includes(t.id)
            return (
              <div key={t.id}>
                {row(
                  t,
                  0,
                  parts.length > 0 && (
                    <button
                      type="button"
                      aria-label={shut ? `Show the parts of ${t.name}` : 'Hide the parts'}
                      onClick={() =>
                        setOpen(shut ? [...open, t.id] : open.filter((x) => x !== t.id))
                      }
                    >
                      {shut ? (
                        <ChevronRight className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </button>
                  ),
                )}
                {!shut && parts.map((p) => row(p, 1))}
              </div>
            )
          })}
          {setup.length > 0 && (
            <div className="pt-2 pb-0.5 text-ink-3 text-sm">What you set up</div>
          )}
          {setup.map((t) => row(t, 0))}
        </div>
      )}
    </Card>
  )
}

// Home's part of each module: the same pulse strip its Overview opens on, the most opened module
// first; a tile's second click opens the module's Overview at that card.
export function ModulePulses({
  modules,
  cards,
  version,
}: {
  modules: { id: string; name: string; tables: { id: string; place: string }[] }[]
  cards: CardView[]
  version: number
}) {
  const { layout } = useLayout()
  const [runs, setRuns] = useState<RunView[]>([])
  useEffect(() => {
    if (version >= 0) api.get<RunView[]>('/api/activity').then(setRuns, () => setRuns([]))
  }, [version])
  const shown = modules
    .filter((m) => m.tables.some((t) => t.place === 'main'))
    .sort((a, b) => (layout.seen[`module:${b.id}`] ?? 0) - (layout.seen[`module:${a.id}`] ?? 0))
  if (!shown.length) return null
  return (
    <div className="flex flex-col gap-5">
      {shown.map((m) => (
        <ModulePulse key={m.id} id={m.id} cards={cards} runs={runs} version={version} />
      ))}
    </div>
  )
}

function ModulePulse({
  id,
  cards,
  runs,
  version,
}: {
  id: string
  cards: CardView[]
  runs: RunView[]
  version: number
}) {
  const [m, setM] = useState<ModuleView | null>(null)
  const [main, setMain] = useState<TableData[]>([])
  useEffect(() => {
    if (version < 0) return
    api.get<ModuleView>(`/api/modules/${id}`).then(
      (got) => {
        setM(got)
        Promise.all(
          got.tables
            .filter((t) => t.place === 'main')
            .map((t) => api.get<TableData>(`/api/tables/${t.id}`)),
        ).then(setMain, () => setMain([]))
      },
      () => setM(null),
    )
  }, [id, version])
  const setup = useSetup(m, version)
  if (!m) return null
  const tiles = pulseOf({ m, main, setup, cards, runs: runs.filter((r) => r.moduleId === m.id) })
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-serif text-xl">
        <a
          href={`#/module/${m.id}/overview`}
          className="text-ink hover:text-accent hover:underline"
        >
          {m.name}
        </a>
      </h2>
      <Strip
        tiles={tiles}
        onGo={(go) => {
          window.location.hash = `#/module/${m.id}/overview`
          setTimeout(
            () =>
              document
                .getElementById(`ov-${go}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
            600,
          )
        }}
      />
    </section>
  )
}
