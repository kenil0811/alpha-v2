// A module's Overview (Vikas, 27 Oct; proposal v4): the pulse strip on top, the same block Home
// shows for the module; under it the module's own work on the left (what waits on the person,
// then its charts, the most opened first) and the standard column on the right, the same cards in
// the same order in every module: Interview me, Files, Agents, Intelligence, What Alpha may do,
// Tables. Every line, bar, slice and count opens what it counts: a table filtered to those rows,
// with Clear filters. A card's head is its name only; a card with nothing to show is not drawn.
import type {
  AgentView,
  CardView,
  ModuleFileView,
  ModuleSummary,
  ModuleView,
  RowView,
  RuleView,
  RunView,
  TableView as TableData,
} from '@alpha/core/api'
import {
  FileText,
  Image,
  LoaderCircle,
  Maximize2,
  MessageCircleQuestion,
  Minimize2,
  Pin,
  Plus,
  Sheet,
} from 'lucide-react'
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react'
import { byFunction } from './AgentList.tsx'
import { api } from './api.ts'
import { Arranged, type Block, pairs } from './arrange.tsx'
import { interviewMe, useInterview } from './ask.ts'
import { GovernanceSection } from './Governance.tsx'
import { useLayout } from './layout.ts'
import { when } from './ModulesAndAgents.tsx'
import { moduleNumbers, numberTables } from './Parts.tsx'
import { Stack, stacksOf } from './stack.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import {
  Bubbles,
  Chart,
  type ChartKind,
  Heat,
  KindPicker,
  Lines,
  type Mark,
  Scatter,
} from './ui/chart.tsx'
import { cn } from './ui/cn.ts'
import { Dot, type Signal, strongest } from './ui/dot.tsx'
import { DropZone } from './ui/drop-zone.tsx'
import { IconTile } from './ui/icon-tile.tsx'
import { Popover } from './ui/popover.tsx'
import { Switch } from './ui/switch.tsx'
import { UpdateNow } from './ui/update-now.tsx'

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
  c.options.length > 0 &&
  !c.draft &&
  !c.proposed &&
  !c.review &&
  !c.match &&
  !c.filing &&
  !c.failed?.length

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

// Rows as bubbles (Vikas, 27 Oct): along the date most of them have, in lanes by their main
// choice, sized by their first amount, coloured by a choice whose words carry a tone (Risk). Only
// when the table has all three, and enough rows dated to read.
function bubblesOf(t: TableData) {
  const dated = (f: Field) => t.rows.filter((r) => typeof val(r, f) === 'string').length
  const date = t.fields.filter((f) => f.kind === 'date').sort((a, b) => dated(b) - dated(a))[0]
  const size = t.fields.find((f) => f.kind === 'money') ?? t.fields.find((f) => f.kind === 'number')
  const lane = spreadOf(t)[0]?.f
  const tone = toneOf(t, lane)
  if (!date || !size || !lane || dated(date) < 8) return null
  const name = nameOf(t)
  const points = t.rows.flatMap((r) => {
    const d = val(r, date)
    const lanes = val(r, lane)
    if (typeof d !== 'string' || typeof lanes !== 'string') return []
    const said = tone ? String(val(r, tone) ?? '') : ''
    const n = num(val(r, size)) ?? 0
    return [
      {
        at: Date.parse(d),
        lane: lanes,
        size: n,
        tone: tone?.tones[said],
        label: [
          name ? String(val(r, name) ?? '') : '',
          `${date.name} ${d}`,
          `${size.name} ${n.toLocaleString()}`,
          said && tone ? `${tone.name} ${said}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        href: `#/row/${r.id}`,
      },
    ]
  })
  const lanes = lane.choices.filter((c) => points.some((p) => p.lane === c))
  return { date, size, lane, points, lanes, tones: tonesOf(tone) }
}

const toneOf = (t: TableData, not?: Field) =>
  t.fields.find((f) => f.kind === 'choice' && !f.many && f !== not && Object.keys(f.tones).length)
const tonesOf = (tone: Field | undefined) =>
  tone
    ? tone.choices
        .filter((c) => tone.tones[c])
        .map((c) => ({ label: `${tone.name} ${c}`, tone: tone.tones[c] as 'good' }))
    : []
const nameOf = (t: TableData) => t.fields.find((f) => f.kind === 'text')

// Rows as dots on two of their amounts (Vikas, 28 Oct): the first and the last amount the table
// has, a middle one as the size, a toned choice as the colour. Only amounts that vary.
function scatterOf(t: TableData) {
  // amounts that vary and are mostly not zero
  const nums = t.fields.filter((f) => {
    if (f.kind !== 'number' && f.kind !== 'money' && f.kind !== 'summary') return false
    const ns = t.rows.map((r) => num(val(r, f))).filter((n) => n !== null)
    return new Set(ns).size >= 3 && ns.filter((n) => n !== 0).length > ns.length / 2
  })
  const x = nums[0]
  const y = nums.at(-1)
  if (!x || !y || x === y) return null
  const size = nums.length >= 3 ? nums[1] : undefined
  const tone = toneOf(t)
  const name = nameOf(t)
  const points = t.rows.flatMap((r) => {
    const a = num(val(r, x))
    const b = num(val(r, y))
    if (a === null || b === null) return []
    const said = tone ? String(val(r, tone) ?? '') : ''
    const n = size ? (num(val(r, size)) ?? 0) : undefined
    return [
      {
        x: a,
        y: b,
        size: n,
        tone: tone?.tones[said],
        label: [
          name ? String(val(r, name) ?? '') : '',
          `${x.name} ${a.toLocaleString()}`,
          `${y.name} ${b.toLocaleString()}`,
          size && n !== undefined ? `${size.name} ${n.toLocaleString()}` : '',
          said && tone ? `${tone.name} ${said}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        href: `#/row/${r.id}`,
      },
    ]
  })
  if (points.length < 5) return null // five people's load still reads; fewer is a list
  // two amounts that move together (a fee is a share of the amount) draw a line that says nothing
  const mean = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length
  const [ax, ay] = [mean(points.map((p) => p.x)), mean(points.map((p) => p.y))]
  const [sxy, sxx, syy] = points.reduce(
    ([a, b, c], p) => [a + (p.x - ax) * (p.y - ay), b + (p.x - ax) ** 2, c + (p.y - ay) ** 2],
    [0, 0, 0],
  )
  if (Math.abs(sxy) / Math.sqrt(sxx * syy || 1) > 0.95) return null
  return { x, y, size, points, tones: tonesOf(tone) }
}

// Rows arriving over time, one line per kind (Vikas, 28 Oct): counted by week along a date that is
// mostly past (received, denied; a due date is the bubbles'), by a twelfth of the span when that is
// longer; one line per value of the main choice, the four biggest in colour and the rest as Other.
function linesOf(t: TableData, not?: Field) {
  const today = new Date().toISOString().slice(0, 10)
  const days = (f: Field) => t.rows.map((r) => val(r, f)).filter((v) => typeof v === 'string')
  const date = t.fields
    .filter((f) => f.kind === 'date' && f !== not)
    .filter((f) => days(f).filter((d) => d <= today).length > days(f).length / 2)
    .sort((a, b) => days(b).length - days(a).length)[0]
  const by = spreadOf(t)[0]?.f
  if (!date || !by || days(date).length < 8) return null
  const rows = t.rows.filter((r) => typeof val(r, date) === 'string')
  const at = (r: RowView) => Date.parse(String(val(r, date)))
  const from = Math.min(...rows.map(at))
  const span = Math.max(...rows.map(at)) - from
  const width = Math.max(WEEK, span / 11)
  const count = Math.floor(span / width) + 1
  if (count < 4) return null // three points make a zigzag, not a trend
  const bin = (r: RowView) => Math.min(Math.floor((at(r) - from) / width), count - 1)
  const periods = Array.from({ length: count }, (_, i) => {
    const label = new Date(from + i * width).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    })
    const these = rows.filter((r) => bin(r) === i)
    return {
      label,
      href: these.length ? rowsHref(t, these, `${date.name} from ${label}`) : undefined,
    }
  })
  const line = (label: string, has: (v: unknown) => boolean) => {
    const n = Array<number>(count).fill(0)
    for (const r of rows) if (has(val(r, by))) n[bin(r)] = (n[bin(r)] ?? 0) + 1
    return { label, n }
  }
  const kinds = by.choices
    .map((c) => ({ c, n: rows.filter((r) => val(r, by) === c).length }))
    .filter((k) => k.n)
    .sort((a, b) => b.n - a.n)
  const top = kinds.slice(0, 4).map((k) => k.c)
  const series = top.map((c) => line(c, (v) => v === c))
  if (kinds.length > 4) series.push(line('Other', (v) => !top.includes(String(v))))
  if (series.length < 2) return null
  return { date, by, series, periods }
}

// Rows counted on two things at once (Vikas, 28 Oct): down the side what they point at (an
// insurer, a person) or a second choice, along the top the main choice.
function heatOf(t: TableData) {
  const col = spreadOf(t)[0]?.f
  if (!col) return null
  const one = (r: RowView, f: Field) => {
    const v = val(r, f)
    const id = Array.isArray(v) ? v[0] : v
    return id === null || id === undefined || id === '' ? null : String(id)
  }
  const used = (f: Field) => new Set(t.rows.map((r) => one(r, f)).filter(Boolean)).size
  const row =
    t.fields.find((f) => f.kind === 'relation' && !f.many && used(f) >= 2 && used(f) <= 12) ??
    t.fields.find(
      (f) => f.kind === 'choice' && !f.many && f !== col && used(f) >= 2 && used(f) <= 12,
    )
  if (!row) return null
  const said = (id: string) => (row.kind === 'relation' ? String(t.names[id] ?? id) : id)
  const rowIds = [...new Set(t.rows.map((r) => one(r, row)).filter((v) => v !== null))]
  const cols = col.choices.filter((c) => t.rows.some((r) => val(r, col) === c))
  const cells = rowIds.map((id) =>
    cols.map((c) => {
      const these = t.rows.filter((r) => one(r, row) === id && val(r, col) === c)
      return {
        n: these.length,
        href: these.length
          ? rowsHref(t, these, `${row.name} is ${said(id)}, ${col.name} is ${c}`)
          : undefined,
      }
    }),
  )
  if (cols.length < 2) return null
  return { row, col, rows: rowIds.map(said), cols, cells }
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
// field of the same name. Each says what to do next (Vikas, 29 Oct: "it should say Review
// listings"): its verb, read from its measure, and the rows to do it on, the ones just short of it.
export interface Goal extends Mark {
  row: string // the goal's own row, which its task sits on
  verb: string // "Review listings"
  task: string // "Review 10 more listings this week"
  todo: string // the rows to act on, filtered
  left: number // how many those are, said on its tile as the view it opens shows them
  of: string // "of 13 this week · 214 listings to review"
  met: boolean
  date: Field | null // the date that says when a row counted, where the table has one
}
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
      const stageOf = (x: RowView) => stage.choices.indexOf(String(val(x, stage) ?? ''))
      // a row that left (Passed, Lost) reached no later stage, though its choice comes after them
      const left = (x: RowView) => {
        const c = String(val(x, stage) ?? '')
        return stage.tones[c] === 'bad' || /pass|lost|drop|declin|gone|cancel/i.test(c)
      }
      const weekly = /week/i.test(target.name)
      // a weekly goal counts the rows whose stage was set this week, not every row ever there
      // (Vikas, 30 Oct: "13 broker calls held of 2 this week")
      const recent = (x: RowView) => {
        const at = x.sources[stage.slug]?.at
        return !weekly || (at != null && Date.now() - Date.parse(at) < WEEK)
      }
      const marks: Goal[] = g.rows.map((r) => {
        const at = String(val(r, pick) ?? '')
        const i = stage.choices.indexOf(at)
        const dated = t.fields.find((f) => f.kind === 'date' && f.name === at)
        const rows =
          i >= 0
            ? t.rows.filter((x) => stageOf(x) >= i && !left(x) && recent(x))
            : dated
              ? t.rows.filter((x) => Date.now() - Date.parse(String(val(x, dated))) < WEEK)
              : []
        // just short of it: the stage before, or not yet dated and still at the first stage
        const todo =
          i > 0
            ? t.rows.filter((x) => stageOf(x) === i - 1)
            : dated
              ? t.rows.filter((x) => !val(x, dated) && stageOf(x) <= 0)
              : []
        const label = String(val(r, name) ?? at)
        // a weekly share of a monthly goal can be 12.5: nobody reviews half a listing
        const goal = Math.ceil(num(val(r, target)) ?? 0)
        const { verb, thing } = verbOf(label, at)
        const need = Math.max(0, Math.ceil(goal - rows.length))
        const week = weekly ? ' this week' : ''
        // the tile says what it counts and what its button opens, each as the view shows it
        // (Vikas, 30 Oct: "0 of 13 reviewed, but on that page I see too many listings")
        const things = thing || t.name.toLowerCase()
        const doing = `${verb.toLowerCase()}${thing ? '' : ` ${at.toLowerCase()}`}`
        return {
          label,
          n: rows.length,
          target: goal,
          href: rowsHref(
            t,
            rows,
            i >= 0 ? `${stage.name} at ${at} or past it${week}` : `${at} this week`,
          ),
          row: r.id,
          verb: thing ? `${verb} ${thing}` : verb,
          task: thing ? `${verb} ${need} more ${thing}${week}` : `${verb}: ${need} more${week}`,
          todo: rowsHref(
            t,
            todo,
            i > 0 ? `${stage.name} is ${stage.choices[i - 1]}` : `not yet ${at.toLowerCase()}`,
          ),
          left: todo.length,
          of: `of ${goal}${week}${todo.length ? ` · ${todo.length.toLocaleString()} ${things} to ${doing}` : ''}`,
          met: rows.length >= goal,
          date: dated ?? null,
        }
      })
      if (marks.length) return { goals: g, table: t, marks }
    }
  }
  return null
}

// A measure said as what to do: "Listings reviewed" is "Review listings", "LOIs sent" is "Send
// LOIs"; one that is not a thing done is "Move to" its stage.
// ponytail: English verbs by a few endings and a short list; a goal's own verb field replaces it
const IRREGULAR: Record<string, string> = { sent: 'send', made: 'make', held: 'hold', won: 'win' }
export function verbOf(measure: string, stage: string): { verb: string; thing: string } {
  const words = measure.trim().split(/\s+/)
  const last = (words.at(-1) ?? '').toLowerCase()
  const base =
    IRREGULAR[last] ??
    (/ied$/.test(last)
      ? `${last.slice(0, -3)}y`
      : /[^s][svzcu]ed$/.test(last)
        ? last.slice(0, -1)
        : /ed$/.test(last)
          ? last.slice(0, -2)
          : null)
  if (!base || words.length < 2) return { verb: 'Move to', thing: stage.toLowerCase() }
  const thing = words.slice(0, -1).join(' ')
  return {
    verb: base[0]?.toUpperCase() + base.slice(1),
    // sentence case, but CIMs and LOIs keep their capitals
    thing: /^[A-Z][a-z]/.test(thing) ? thing[0]?.toLowerCase() + thing.slice(1) : thing,
  }
}

// The way some rows split that says the most (Vikas, 29 Oct: "not 'listed under LOI', maybe
// location based"): a choice, or a short text (a place by what follows its last comma, its
// state), whose values spread the rows most evenly; never the main stage or a toned status.
export function explainOf(t: TableData, rows: RowView[], about = '') {
  if (rows.length < 3) return null
  const main = spreadOf(t)[0]?.f
  const keyOf = (f: Field, r: RowView) => {
    const v = val(r, f)
    if (typeof v !== 'string' || !v.trim()) return null
    return f.kind === 'text' && v.includes(',') ? (v.split(',').at(-1) ?? v).trim() : v.trim()
  }
  let best: { f: Field; score: number; groups: Map<string, RowView[]> } | null = null
  for (const f of t.fields) {
    const fits =
      f !== main &&
      ((f.kind === 'choice' && !f.many && !Object.keys(f.tones).length) || f.kind === 'text')
    if (!fits) continue
    const groups = new Map<string, RowView[]>()
    for (const r of rows) {
      const k = keyOf(f, r)
      if (k) groups.set(k, [...(groups.get(k) ?? []), r])
    }
    const had = [...groups.values()].reduce((a, g) => a + g.length, 0)
    if (groups.size < 2 || groups.size > 8 || had < rows.length / 2) continue
    // how evenly it spreads them (entropy), times the share of rows it says something about
    const h = [...groups.values()].reduce(
      (a, g) => a - (g.length / had) * Math.log(g.length / had),
      0,
    )
    const score = (h * had) / rows.length
    if (!best || score > best.score) best = { f, score, groups }
  }
  if (!best) return null
  const { f, groups } = best
  return {
    field: f,
    marks: [...groups.entries()]
      .map(([label, these]) => ({
        label,
        n: these.length,
        href: rowsHref(t, these, `${about}${f.name} is ${label}`),
      }))
      .sort((a, b) => b.n - a.n),
  }
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
  big: string // the number, or '' for a tile of words alone
  small: string // the words after the number: "listings reviewed · of 13 this week"
  spark?: number[]
  lines: { s: Signal; words: string; href?: string }[]
  go: string // the card it stands for, scrolled to on a second click
  // what to do about it, said as the verb (Vikas, 29 Oct: "everything to be made actionable"):
  // a place to go, or the card to scroll to. Every tile has one; with nothing to do it is greyed
  // (`off`) and says it is done, its tip saying why (Vikas, 30 Oct)
  act: { label: string; href?: string; go?: string; off?: boolean; tip?: string }
}

// A label as the words after a number: "Listings reviewed" → "listings reviewed"; "CIMs" kept.
const asWords = (w: string) => (/^.[a-z]/.test(w) ? w[0]?.toLowerCase() + w.slice(1) : w)

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
      small: 'waiting on you',
      lines: waiting.slice(0, 4).map((c) => ({ s: signalOf(c), words: c.words, href: '#/' })),
      go: 'needs',
      act: { label: 'Review', go: 'needs' },
    })
  const goals = goalsOf(setup, main)
  // a few goals are each their own tile with its next step; many are one tile (Vikas, 29 Oct)
  if (goals && goals.marks.length <= 6)
    for (const g of goals.marks)
      tiles.push({
        key: `goal:${g.row}`,
        label: g.label,
        signal: g.met ? 'done' : 'yes',
        big: g.n.toLocaleString(),
        small: `${asWords(g.label)} · ${g.of.split(' · ')[0]}`,
        // a link to no rows would open the whole table: only rows there are
        lines: [
          ...(g.met
            ? [{ s: 'done' as const, words: 'On target' }]
            : g.left
              ? [{ s: 'yes' as const, words: g.task, href: g.todo }]
              : []),
          ...(g.n && g.href
            ? [{ s: 'opt' as const, words: `The ${g.n} counted`, href: g.href }]
            : []),
        ],
        go: 'goals',
        act: g.met
          ? {
              label: `All ${g.label.split(' ').at(-1)?.toLowerCase()}`,
              off: true,
              tip: `On target: ${g.n.toLocaleString()} ${g.of.split(' · ')[0]}`,
            }
          : g.left
            ? { label: g.verb, href: g.todo, tip: g.of.split(' · ')[1] ?? g.task }
            : { label: g.verb, off: true, tip: 'Nothing waits for this now' },
      })
  else if (goals) {
    const met = goals.marks.filter((g) => g.met).length
    const behind = goals.marks.find((g) => !g.met)
    tiles.push({
      key: 'goals',
      label: 'Goals',
      signal: met === goals.marks.length ? 'done' : 'yes',
      big: String(met),
      small: `of ${goals.marks.length} goals on target`,
      lines: goals.marks.map((g) => ({
        s: g.met ? 'done' : 'yes',
        words: g.met ? `${g.label}: on target` : g.task,
        href: (g.met ? g.href : g.todo) ?? '',
      })),
      go: 'goals',
      act: behind
        ? { label: behind.verb, href: behind.todo, tip: behind.task }
        : { label: 'All on target', off: true, tip: 'Every goal is on target' },
    })
  }
  const big = [...main].sort((a, b) => b.rows.length - a.rows.length)[0]
  const weeks = big && weeksOf(big)
  if (big && weeks) {
    const now = weeks.weeks.at(-1)
    const last = weeks.weeks.at(-2)
    const more = (now?.n ?? 0) - (last?.n ?? 0)
    const why = explainOf(big, now?.rows ?? [], 'new this week, ')
    tiles.push({
      key: 'new',
      label: `New ${big.name.toLowerCase()} this week`,
      signal: 'opt',
      big: (now?.n ?? 0).toLocaleString(),
      small: `new ${big.name.toLowerCase()} this week · ${more >= 0 ? '+' : ''}${more.toLocaleString()} on last week`,
      spark: weeks.weeks.map((w) => w.n),
      lines: [
        ...(why
          ? why.marks.slice(0, 4).map((x) => ({
              s: 'opt' as const,
              words: why.field.kind === 'text' ? `${x.n} in ${x.label}` : `${x.n} ${x.label}`,
              href: x.href,
            }))
          : []),
      ],
      act: now?.n
        ? { label: `Review ${now.n.toLocaleString()} new`, href: now.href }
        : { label: 'Nothing new', off: true, tip: `No new ${big.name.toLowerCase()} this week` },
      go: `weeks:${big.id}`,
    })
  }
  const questions = cards.filter((c) => c.module === m.name && isQuestion(c))
  tiles.push({
    key: 'questions',
    label: questions.length ? 'Questions for you' : 'Interview me',
    signal: questions.length ? 'yes' : 'opt',
    big: questions.length ? String(questions.length) : '',
    small: questions.length
      ? `${questions.length === 1 ? 'question' : 'questions'} for you`
      : 'Interview me: Alpha asks one question at a time',
    lines: questions.length
      ? questions.slice(0, 3).map((c) => ({ s: 'yes' as const, words: c.words }))
      : [{ s: 'opt', words: 'Alpha asks one question at a time' }],
    go: 'ask',
    act: { label: questions.length ? 'Answer' : 'Start', go: 'ask' },
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
      small: `of ${m.agents.length} agents active`,
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
      act: needs[0]
        ? { label: 'Fix', href: `#/agent/${needs[0].id}` }
        : { label: 'Open agents', go: 'agents' },
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
      small: `${changed.length === 1 ? 'thing' : 'things'} Alpha changed this week`,
      lines: changed
        .slice(0, 3)
        .map((r) => ({ s: 'opt' as const, words: r.words ?? r.name, href: `#/run/${r.id}` })),
      go: 'maydo',
      act: { label: 'See changes', href: '#/activity' },
    })
  return tiles.slice(0, 8)
}

// Hover a tile and it opens a little to list what it counts; a click keeps it open; a second
// click goes to its card.
// A tile's lines with the same words said once, with how many times (Vikas, 30 Oct: "Lead aging
// finished." four times over), at most five.
export function folded(lines: Tile['lines']) {
  const out: (Tile['lines'][number] & { n: number })[] = []
  for (const l of lines) {
    const had = out.find((o) => o.words === l.words)
    if (had) had.n++
    else out.push({ ...l, n: 1 })
  }
  return out.slice(0, 5)
}

// One row of square tiles that scrolls sideways inside itself (Vikas, 30 Oct: "I don't see a point
// in so much width"); a tile's name wraps to three lines. What a hover or a click opens (the whole
// name, the lines it counts) floats over the page in a popover, so the scrolling row never clips it.
export function Strip({ tiles, onGo }: { tiles: Tile[]; onGo: (go: string) => void }) {
  const [open, setOpen] = useState<string | null>(null) // opened by a click, kept until a click away
  const [hover, setHover] = useState<string | null>(null)
  const leave = useRef<ReturnType<typeof setTimeout>>(undefined)
  const stay = () => clearTimeout(leave.current)
  const away = () => {
    stay()
    leave.current = setTimeout(() => setHover(null), 120) // time to cross into the popover
  }
  useEffect(() => stay, [])
  if (!tiles.length) return null
  return (
    // keyed by its tiles: a snapping row keeps to the tile it snapped to, so tiles coming in
    // ahead of it would leave the row scrolled past the first
    <div
      key={tiles.map((t) => t.key).join()}
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
    >
      {tiles.map((t) => (
        <StripTile
          key={t.key}
          t={t}
          shown={(open ?? hover) === t.key}
          on={open === t.key}
          onOpen={(o) => setOpen(o ? t.key : null)}
          onHover={(h) => {
            if (h) {
              stay()
              setHover(t.key)
            } else away()
          }}
          onGo={onGo}
        />
      ))}
    </div>
  )
}

function StripTile({
  t,
  shown,
  on,
  onOpen,
  onHover,
  onGo,
}: {
  t: Tile
  shown: boolean
  on: boolean
  onOpen: (open: boolean) => void
  onHover: (hover: boolean) => void
  onGo: (go: string) => void
}) {
  const tile = useRef<HTMLDivElement>(null)
  const lines = folded(t.lines)
  // the tile's one button wears its signal as a small dot before its words: the dot is this
  // action's state (Vikas, 30 Oct: "the dot belongs to the call to action")
  const button =
    'flex min-w-0 max-w-full items-center gap-1.5 rounded-sm border border-line px-2 py-0.5 text-left text-accent text-sm leading-5 hover:border-accent-line hover:bg-accent-soft'
  const dot = t.act.off ? (t.signal === 'done' ? 'done' : 'opt') : t.signal
  const words = (
    <>
      <Dot s={dot} className="size-1.5" />
      <span className="truncate">{t.act.label}</span>
    </>
  )
  // the popover is the tile's sibling, not its child: a portal's events bubble to its React parent
  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: it holds links of its own */}
      <div
        ref={tile}
        role="button"
        tabIndex={0}
        aria-expanded={on}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a, button')) return
          // nothing to open: straight to what it stands for
          if (on || !lines.length) {
            onOpen(false)
            onGo(t.go)
          } else onOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') on || !lines.length ? onGo(t.go) : onOpen(true)
        }}
        className={cn(
          'flex w-52 shrink-0 snap-start cursor-pointer flex-col rounded-lg border border-line bg-surface px-3 py-2.5 transition-shadow hover:shadow-pop',
          on && 'border-accent-line shadow-pop',
        )}
      >
        {/* the number big, its words after it on the same line; a number of four characters or
            more ("1,016") stands on its own line above them (Vikas, 30 Oct) */}
        {t.big.length >= 4 ? (
          <>
            <div className="font-serif text-2xl leading-none">{t.big}</div>
            <p className="mt-1 truncate text-ink-2 text-sm">{t.small}</p>
          </>
        ) : (
          <p className="line-clamp-2 text-ink-2 text-sm">
            {t.big && (
              <span className="mr-1.5 font-serif text-2xl text-ink leading-none">{t.big}</span>
            )}
            {t.small}
          </p>
        )}
        {/* three lines in all (Vikas, 30 Oct): the number and its words, then one row with the
            spark at the left and the button at the right */}
        <div className="mt-auto flex items-end justify-end gap-2 pt-1.5">
          {t.spark && (
            <div className="min-w-0 flex-1">
              <Spark points={t.spark} />
            </div>
          )}
          {t.act.off ? (
            <span
              aria-disabled="true"
              data-tip={t.act.tip ?? t.act.label}
              className={cn(
                button,
                'cursor-default border-transparent bg-sunk text-ink-3 hover:border-transparent hover:bg-sunk',
              )}
            >
              {words}
            </span>
          ) : t.act.href ? (
            <a href={t.act.href} data-tip={t.act.tip ?? t.act.label} className={button}>
              {words}
            </a>
          ) : (
            <button
              type="button"
              data-tip={t.act.tip ?? t.act.label}
              onClick={() => {
                onOpen(false)
                onGo(t.act.go ?? t.go)
              }}
              className={button}
            >
              {words}
            </button>
          )}
        </div>
      </div>
      <Popover
        anchor={tile}
        open={shown}
        onClose={() => {
          onOpen(false)
          onHover(false)
        }}
        className="w-64 p-0"
      >
        {/* what a tile opens (Review listings, the rows it counts) opens beside, in the side panel */}
        <div
          data-peek-all
          className="px-3 py-2"
          onPointerEnter={() => onHover(true)}
          onPointerLeave={() => onHover(false)}
        >
          <div className="text-ink-3 text-sm">{t.label}</div>
          <div className="text-sm">
            {t.big} {t.small}
          </div>
          {lines.length > 0 && (
            <div className="mt-2 border-hair border-t pt-1.5">
              {lines.map((l) => (
                <div key={l.words} className="flex items-center gap-2 py-0.5 text-sm">
                  <Dot s={l.s} />
                  {l.href ? (
                    <a href={l.href} className="truncate hover:text-accent hover:underline">
                      {l.words}
                    </a>
                  ) : (
                    <span className="truncate">{l.words}</span>
                  )}
                  {l.n > 1 && (
                    <span className="ml-auto shrink-0 text-ink-3 tabular-nums">×{l.n}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Popover>
    </>
  )
}

function Spark({ points }: { points: number[] }) {
  const most = Math.max(1, ...points)
  const d = points.map((p, i) => `${i * 12},${22 - (p / most) * 20}`).join(' ')
  return (
    <svg viewBox="0 0 62 24" className="h-6 w-16 min-w-0 shrink" aria-hidden="true">
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

  // a tile only for what no card below says: Interview me, Agents and what Alpha changed each
  // have their card (Vikas, 27 Oct: nothing twice)
  const tiles = pulseOf({ m, main, setup, cards, runs }).filter(
    (t) =>
      !['agents', 'changed'].includes(t.key) &&
      !(t.key === 'questions' && t.big === 'Start') &&
      !(t.key === 'new' && t.big === '0'),
  )
  const go = (id: string) =>
    document.getElementById(`ov-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // the module's own cards, the most opened first; a chart only where it says something (Vikas,
  // 27 Oct): enough rows to read, and bars that differ
  const says = (marks: { n: number }[]) =>
    marks.length > 1 && new Set(marks.map((x) => x.n)).size > 1
  const work: (Block & { wide?: boolean })[] = []
  // a table whose rows report to its own rows draws as an organization chart, first and whole width
  for (const t of main) {
    const org = orgOf(t)
    if (org)
      work.push({
        key: `org:${t.id}`,
        name: 'Organization',
        wide: true,
        node: <OrgChart t={t} {...org} />,
      })
  }
  for (const t of main.filter((x) => x.rows.length >= 8)) {
    const spread = spreadOf(t)[0]
    if (spread && says(spread.marks))
      work.push({
        key: `chart:${t.id}`,
        name: `${t.name} by ${spread.f.name.toLowerCase()}`,
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
    // a stage as a funnel (Vikas, 29 Oct: the Funnel page's analytics on the Overview): the rows
    // at or past each stage, the ones that left (Passed, Lost) out
    if (spread && /stage|step|phase/i.test(spread.f.name)) {
      const f = spread.f
      const left = (c: string) =>
        f.tones[c] === 'bad' || /pass|lost|drop|declin|gone|cancel/i.test(c)
      const steps = f.choices.filter((c) => !left(c))
      const at = (r: RowView) => steps.indexOf(String(val(r, f) ?? ''))
      const marks = steps.map((c, i) => {
        const rows = t.rows.filter((r) => at(r) >= i)
        return { label: c, n: rows.length, href: rowsHref(t, rows, `${f.name} at ${c} or past it`) }
      })
      if (marks.filter((x) => x.n).length >= 2)
        work.push({
          key: `funnel:${t.id}`,
          name: `${t.name} funnel`,
          node: (
            <ChartCard
              id={`funnel:${t.id}`}
              title={`${t.name} funnel`}
              href={`#/table/${t.id}`}
              kinds={['funnel', 'bar']}
              marks={marks}
            />
          ),
        })
    }
    const bubbles = bubblesOf(t)
    if (bubbles)
      work.push({
        key: `bubbles:${t.id}`,
        name: `${t.name} by ${bubbles.date.name.toLowerCase()}`,
        wide: true,
        node: (
          <Card
            id={`bubbles:${t.id}`}
            title={`${t.name} by ${bubbles.date.name.toLowerCase()}`}
            href={`#/table/${t.id}`}
            wide
          >
            {() => (
              <Bubbles
                points={bubbles.points}
                lanes={bubbles.lanes}
                size={bubbles.size.name}
                tones={bubbles.tones}
              />
            )}
          </Card>
        ),
      })
    // on another date than the bubbles': on the same one they would say it twice
    const lines = linesOf(t, bubbles?.date)
    if (lines)
      work.push({
        key: `lines:${t.id}`,
        name: `${t.name} per week`,
        wide: true,
        node: (
          <Card
            id={`lines:${t.id}`}
            title={`${t.name} per week of ${lines.date.name.toLowerCase()}, by ${lines.by.name.toLowerCase()}`}
            href={`#/table/${t.id}`}
            wide
          >
            {() => <Lines series={lines.series} periods={lines.periods} />}
          </Card>
        ),
      })
    const scatter = scatterOf(t)
    if (scatter)
      work.push({
        key: `scatter:${t.id}`,
        name: `${t.name}: ${scatter.y.name.toLowerCase()} against ${scatter.x.name.toLowerCase()}`,
        wide: true,
        node: (
          <Card
            id={`scatter:${t.id}`}
            title={`${t.name}: ${scatter.y.name.toLowerCase()} against ${scatter.x.name.toLowerCase()}`}
            href={`#/table/${t.id}`}
            wide
          >
            {() => (
              <Scatter
                points={scatter.points}
                x={scatter.x.name}
                y={scatter.y.name}
                size={scatter.size?.name}
                tones={scatter.tones}
              />
            )}
          </Card>
        ),
      })
    const heat = heatOf(t)
    if (heat)
      work.push({
        key: `heat:${t.id}`,
        name: `${t.name} by ${heat.row.name.toLowerCase()} and ${heat.col.name.toLowerCase()}`,
        wide: true,
        node: (
          <Card
            id={`heat:${t.id}`}
            title={`${t.name} by ${heat.row.name.toLowerCase()} and ${heat.col.name.toLowerCase()}`}
            href={`#/table/${t.id}`}
            wide
          >
            {() => <Heat rows={heat.rows} cols={heat.cols} cells={heat.cells} />}
          </Card>
        ),
      })
    const from = fromOf(t, main)
    if (from && says(from.marks))
      work.push({
        key: `from:${t.id}`,
        name: `Where ${t.name.toLowerCase()} come from`,
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
      name: 'Goals',
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
  // each goal week by week and month by month, and the first one's weeks against its target
  // ponytail: by the date a row carries for the goal (Reviewed); a stage reached has no date
  // until the core gives a row's stage history, so those goals show only where they stand
  if (goals?.marks.some((g) => g.date)) {
    const first = goals.marks.find((g) => g.date) as Goal
    work.push({
      key: 'goal-weeks',
      name: 'Goals by week',
      wide: true,
      node: <GoalWeeks t={goals.table} goals={goals.marks} href={`#/table/${goals.goals.id}`} />,
    })
    work.push({
      key: 'goal-first',
      name: `${first.label} per week`,
      node: (
        <ChartCard
          id="goal-first"
          title={`${first.label} per week`}
          href={`#/table/${goals.table.id}`}
          kinds={['bullet', 'bar']}
          marks={periodsOf(goals.table, first).weeks}
        />
      ),
    })
  }
  const criteria = criteriaOf(setup, main)
  if (criteria)
    work.push({
      key: 'criteria',
      name: `What rules ${criteria.table.name.toLowerCase()} out`,
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
  if (big && weeks && weeks.weeks.filter((w) => w.n).length >= 2 && says(weeks.weeks))
    work.push({
      key: `weeks:${big.id}`,
      name: `New ${big.name.toLowerCase()} by week`,
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

  // a goal behind has its task, made once and kept to its numbers; met, the task is done
  const goalKey = goals ? JSON.stringify(goals.marks.map((g) => [g.row, g.task, g.met])) : ''
  useEffect(() => {
    if (!goals) return
    const sunday = new Date()
    sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7))
    const weekly = goals.marks.some((g) => g.task.endsWith('this week'))
    for (const g of goals.marks)
      api
        .post('/api/tasks/ensure', {
          title: g.task,
          met: g.met,
          ...(weekly ? { due: sunday.toISOString().slice(0, 10) } : {}),
          on: { module: m.id, table: goals.goals.id, row: g.row },
        })
        .catch(() => undefined)
  }, [goalKey, m.id])

  const insights = m.agents.find((a) => /insight/i.test(a.name))
  const questions = cards.some((c) => c.module === m.name && isQuestion(c))
  const lead: (Block & { wide?: boolean })[] = [
    ...(insights
      ? [{ key: 'insights', name: 'Insights', node: <Insights a={insights} onChange={onChange} /> }]
      : []),
    ...(waiting.length
      ? [
          {
            key: 'needs',
            name: 'Needs you',
            node: <NeedsYou cards={waiting} onChange={onChange} />,
          },
        ]
      : []),
  ]
  // nothing to show yet says what will be here and how it comes (Vikas, 29 Oct: never blank)
  if (!lead.length && !work.length)
    lead.push({
      key: 'empty',
      name: 'No data yet',
      wide: true,
      node: <NoData m={m} main={main} />,
    })
  // the standard blocks, in this order in every module (Vikas, 29 Oct)
  const standard: Block[] = [
    // Interview me first, a square smaller than the strip's (Vikas, 30 Oct)
    { key: 'interview', name: 'Interview me', node: <InterviewTile m={m} /> },
    ...(questions
      ? [
          {
            key: 'ask',
            name: 'Interview me',
            node: <InterviewMe m={m} cards={cards} onChange={onChange} />,
          },
        ]
      : []),
    ...(m.agents.length
      ? [
          {
            key: 'agents',
            name: 'Agents',
            node: (
              <Agents
                m={m}
                main={main}
                onChange={onChange}
                onNew={() => (window.location.hash = `#/agent/new?module=${m.id}`)}
              />
            ),
          },
        ]
      : []),
    {
      key: 'governance',
      name: 'Governance',
      node: (
        <div id="ov-governance" className="rounded-lg border border-line bg-surface px-3 py-3">
          <GovernanceSection module={m.id} version={version} />
        </div>
      ),
    },
    {
      key: 'tables',
      name: 'Tables',
      node: <Tables ms={[m]} href={`#/module/${m.id}/agents`} />,
    },
    { key: 'brain', name: 'Second Brain', node: <Intelligence m={m} rules={rules} /> },
    { key: 'files', name: 'Files', node: <Files m={m} onChange={onChange} /> },
  ]
  const wide = new Set([...lead, ...work].filter((b) => 'wide' in b && b.wide).map((b) => b.key))

  return (
    // its own width decides the columns, not the window's: it is drawn in the side panel too
    <div className="@container h-full overflow-y-auto">
      <div className="flex flex-col gap-4 px-7 py-4">
        <Strip tiles={tiles} onGo={go} />
        {/* the work left and the standard column right, in every module (27 Oct, kept when
            blocks became movable on 29 Oct); a block moves within or across them (30 Oct) */}
        <Arranged
          className="grid gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"
          blocks={[...lead, ...work, ...standard]}
          columns={[
            {
              page: `overview:${m.id}:work`,
              start: pairs(
                [...lead, ...work].map((b) => b.key),
                (k) => wide.has(k),
              ),
            },
            { page: `overview:${m.id}:side`, start: standard.map((b) => [b.key]) },
          ]}
        />
      </div>
    </div>
  )
}

// A goal's rows counted by its date: the last six weeks, this month and last month, each with
// the rows it counts.
function periodsOf(t: TableData, g: Goal) {
  const at = (r: RowView) => (g.date ? Date.parse(String(val(r, g.date) ?? '')) : Number.NaN)
  const count = (label: string, from: number, to: number, target?: number) => {
    const rows = t.rows.filter((r) => at(r) >= from && at(r) < to)
    return {
      label,
      n: rows.length,
      href: rowsHref(t, rows, `${g.label}: ${label.toLowerCase()}`),
      ...(target !== undefined ? { target } : {}),
    }
  }
  const monday = new Date()
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const weeks = [5, 4, 3, 2, 1, 0].map((ago) => {
    const from = monday.getTime() - ago * WEEK
    const label =
      ago === 0
        ? 'This week'
        : new Date(from).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    return count(label, from, from + WEEK, g.target)
  })
  const d = new Date()
  const month = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  const last = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime()
  return {
    weeks,
    months: [count('Last month', last, month), count('This month', month, Date.now() + 864e5)],
  }
}

function GoalWeeks({ t, goals, href }: { t: TableData; goals: Goal[]; href: string }) {
  const dated = goals.filter((g) => g.date)
  const head = periodsOf(t, dated[0] as Goal)
  const cols = [...head.weeks, ...head.months].map((c) => c.label)
  return (
    <Card id="goal-weeks" title="Goals by week" href={href} wide>
      {() => (
        <div className="overflow-x-auto">
          <table className="w-full text-md tabular-nums">
            <thead>
              <tr className="text-ink-3 text-sm">
                <th className="py-1 pr-3 text-left font-normal">Goal</th>
                {cols.map((c) => (
                  <th key={c} className="px-2 py-1 text-right font-normal">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dated.map((g) => {
                const p = periodsOf(t, g)
                return (
                  <tr key={g.row} className="border-hair border-t">
                    <td className="py-1.5 pr-3">{g.label}</td>
                    {[...p.weeks, ...p.months].map((c) => (
                      <td key={c.label} className="px-2 py-1.5 text-right">
                        <a
                          href={c.href}
                          className={cn(
                            'hover:text-accent hover:underline',
                            c.target !== undefined && c.n >= c.target && 'text-good',
                          )}
                        >
                          {c.n}
                        </a>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// An Overview with nothing to show says what will be here and how it comes.
function NoData({ m, main }: { m: ModuleView; main: TableData[] }) {
  const names = main.map((t) => t.name)
  const listed =
    names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : (names[0] ?? '')
  return (
    <section id="ov-empty" className="rounded-lg border border-line border-dashed px-4 py-5">
      <p className="font-semibold text-ink">No data yet</p>
      <p className="mt-1 text-ink-2 text-md">
        {names.length
          ? `Rows added to ${listed} show here: charts of them, the goals they count towards and what needs you.`
          : `${m.name} keeps no rows yet. Tell Alpha what to keep, or add files, and what it keeps shows here.`}
      </p>
      <div className="mt-3 flex gap-2">
        {main[0] && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => (window.location.hash = `#/table/${main[0]?.id}`)}
          >
            Open {main[0].name}
          </Button>
        )}
        <InterviewButton m={m} />
      </div>
    </section>
  )
}

// What the module's Insights agent last found (Vikas, 29 Oct: "a particular agent handling all
// this analysis… proactively working on the overview page"): its last run's words, a line each.
// ponytail: an agent's only output to the window is its run's words; insights as rows of their
// own, each with its chart and the rows it rests on, need the core to keep them
function Insights({ a, onChange }: { a: AgentView; onChange: () => void }) {
  const { busy, problem, act } = useAct(onChange)
  const said = a.lastResult?.ok ? a.lastResult.words.split(/\n+/).filter((l) => l.trim()) : []
  return (
    <Card
      id="insights"
      title="Insights"
      href={`#/agent/${a.id}`}
      signal={a.lastResult && !a.lastResult.ok ? 'now' : null}
      extra={
        a.state === 'on' ? (
          <UpdateNow
            at={a.lastResult?.at ?? a.lastRunAt}
            busy={busy || a.running}
            tip={`${a.name} looks at the rows again now`}
            onClick={() => act(() => api.post(`/api/agents/${a.id}/run`))}
          />
        ) : (
          <Button
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => act(() => api.post(`/api/agents/${a.id}`, { state: 'on' }))}
          >
            Turn on
          </Button>
        )
      }
    >
      {() => (
        <div>
          <Refusal words={problem} />
          {said.length ? (
            said.map((l) => (
              <Line key={l} s="opt">
                {l}
              </Line>
            ))
          ) : (
            <p className="text-ink-3 text-md">
              {a.lastResult && !a.lastResult.ok
                ? `${a.name} did not finish: ${a.lastResult.words}`
                : `No insights yet: ${a.name} writes what it finds here, ${a.when}.`}
            </p>
          )}
        </div>
      )}
    </Card>
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
  wide,
  children,
}: {
  id: string
  title: string
  href: string
  count?: number
  signal?: Signal | null
  grows?: boolean
  extra?: ReactNode
  wide?: boolean // the whole width: a chart that needs it to read
  children: (big: boolean) => ReactNode
}) {
  const [big, setBig] = useState(false)
  return (
    <section
      id={`ov-${id}`}
      className={cn(
        'flex min-w-0 flex-col rounded-lg border border-line bg-surface transition-shadow hover:shadow-pop',
        (big || wide) && 'col-span-full',
      )}
    >
      <div data-head className="flex h-11 items-center gap-2 rounded-t-lg px-3">
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
// answered. Cards of one kind are one line, a stack: "1 of N" with previous and next, and one
// answer for all where the cards allow it (Vikas, 29 Oct).
function NeedsYou({ cards, onChange }: { cards: CardView[]; onChange: () => void }) {
  const verb = (c: CardView) =>
    c.gate === 'sign_in' || c.site || c.connector
      ? 'Sign in'
      : c.draft
        ? 'Review and send'
        : c.review || c.match || c.filing || c.proposed
          ? 'Review'
          : 'Open'
  const stacks = stacksOf(cards)
  return (
    <Card
      id="needs"
      title="Needs you"
      href="#/"
      count={cards.length}
      signal={strongest(cards.map(signalOf))}
      grows={stacks.length > 5}
    >
      {(big) =>
        (big ? stacks : stacks.slice(0, 5)).map((st) => (
          <Stack
            key={st[0]?.id}
            cards={st}
            onChange={onChange}
            render={(c, head) => (
              <Line
                s={signalOf(c)}
                actions={
                  <Button size="sm" variant="primary" onClick={() => (window.location.hash = '#/')}>
                    {verb(c)}
                  </Button>
                }
              >
                <span className="line-clamp-2">{c.words}</span>
                {head}
              </Line>
            )}
          />
        ))
      }
    </Card>
  )
}

// --- The standard column ------------------------------------------------------------------

// Interview me (Vikas, 30 Oct): opens the Interviewer's thread under Agents, scoped to this
// module, where it prepares (with Stop) and asks; on a hover, what it prepared and its first one.
function InterviewButton({ m, label = 'Interview me' }: { m: ModuleView; label?: string }) {
  const interview = useInterview(m.id)
  return (
    <Button size="sm" onClick={() => interviewMe(m.id)} data-tip={interview.tip}>
      {interview.busy ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : (
        <MessageCircleQuestion className="size-3.5" />
      )}
      {label}
    </Button>
  )
}

// The same as a square at the head of the standard column: its name is its tooltip.
function InterviewTile({ m }: { m: ModuleView }) {
  const interview = useInterview(m.id)
  return (
    <div className="w-13">
      <IconTile label={`Interview me. ${interview.tip}`} onClick={() => interviewMe(m.id)}>
        {interview.busy ? <LoaderCircle className="animate-spin" /> : <MessageCircleQuestion />}
      </IconTile>
    </div>
  )
}

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
  if (!questions.length) return null
  return (
    <Card
      id="ask"
      title="Interview me"
      href={`#/module/${m.id}/conversation`}
      count={questions.length}
      extra={<InterviewButton m={m} label="Ask me more" />}
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
        </div>
      )}
    </Card>
  )
}

// The module's files as a desktop: an icon each, its name, the row it sits on. Drop a file on it
// to add it; Alpha reads it and files it.
export function Files({
  m,
  onChange,
  href = `#/module/${m.id}/agents`,
}: {
  m: ModuleView
  onChange: () => void
  href?: string
}) {
  const { busy, problem, act } = useAct(onChange)
  const icon = (f: ModuleFileView) =>
    f.mime.startsWith('image/') ? Image : /sheet|csv|excel/.test(f.mime) ? Sheet : FileText
  const drop = (files: FileList) => act(() => Promise.all([...files].map((f) => api.upload(f))))
  const unread = m.files.filter((f) => f.read !== 'read').length
  return (
    <Card
      id="files"
      title="Files"
      href={href}
      count={m.files.length}
      signal={unread ? 'opt' : null}
      grows={m.files.length > 8}
    >
      {(big) => (
        <DropZone onFiles={drop} busy={busy}>
          <Refusal words={problem} />
          {m.files.length > 0 && (
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
          )}
        </DropZone>
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

// On Home (byFunction) every agent of the workspace, grouped by what it does as the Agents list
// groups them, its module beside its name; eight until Show more.
export function Agents({
  m,
  main,
  onChange,
  onNew,
  href = `#/module/${m.id}/agents`,
  byFunction: fn = false,
}: {
  m: ModuleView
  main: TableData[]
  onChange: () => void
  onNew?: () => void
  href?: string
  byFunction?: boolean
}) {
  const { busy, problem, act } = useAct(onChange)
  if (!m.agents.length) return null
  const { groups, rest: all } = groupsOf(m.agents, main)
  const rest = fn
    ? all
        .map((a) => ({ ...a, function: a.function ?? 'Admin' }))
        .sort((a, b) => byFunction(a.function, b.function))
    : all
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
      href={href}
      count={on}
      grows={groups.length > 0 || (fn && rest.length > 8)}
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
                    <Switch
                      checked={gon.length > 0}
                      disabled={busy}
                      label={gon.length ? `Pause every ${g.name}` : `Turn on every ${g.name}`}
                      onChange={(v) => turn(g.agents, v)}
                    />
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
                  {/* when they last updated, beside the one button that updates them now */}
                  <div className="mt-1.5 flex">
                    <UpdateNow
                      at={g.agents
                        .map((a) => a.lastRunAt)
                        .filter(Boolean)
                        .sort()
                        .at(-1)}
                      busy={busy || gon.some((a) => a.running)}
                      disabled={!gon.length}
                      onClick={() => sync(g.agents)}
                      tip={`Run every ${g.name.toLowerCase().replace(/s$/, '')} that is on, now`}
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
          {(fn && !big ? rest.slice(0, 8) : rest).map((a, i) => (
            <Fragment key={a.id}>
              {fn && a.function !== rest[i - 1]?.function && (
                <p className="pt-2 pb-1 text-ink-3 text-xs">{a.function}</p>
              )}
              <Line s={agentSignal(a)} actions={toggle(a)}>
                <a href={`#/agent/${a.id}`} className="hover:text-accent hover:underline">
                  {a.name}
                </a>{' '}
                <span className="text-ink-3 text-sm">{fn ? a.module.name : a.when}</span>
              </Line>
            </Fragment>
          ))}
          {onNew && (
            <button
              type="button"
              onClick={onNew}
              className="mt-1 flex items-center gap-1.5 py-1 text-ink-3 text-sm hover:text-accent"
            >
              <Plus className="size-3.5" />
              New agent
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

// What Alpha knows about the module, counted: the notes it reads first, the documents it has
// read, the rules it keeps, the agents that work here; then what it keeps, table by table.
export function Intelligence({
  m,
  rules,
  here = `#/module/${m.id}/agents`,
}: {
  m: ModuleView
  rules: RuleView[]
  here?: string
}) {
  const notes = m.notes.split('\n').filter((l) => !l.startsWith('#') && l.trim().length > 20)
  // only what it has: a nought says nothing (Vikas, 27 Oct)
  const tiles = [
    { n: notes.length, label: 'notes', href: here },
    { n: m.files.filter((f) => f.read === 'read').length, label: 'documents read', href: here },
    { n: rules.length, label: 'rules', href: here },
  ].filter((t) => t.n > 0)
  const kept = m.tables.filter((t) => t.rows).sort((a, b) => b.rows - a.rows)
  const total = kept.reduce((a, t) => a + t.rows, 0) || 1
  return (
    <Card id="intelligence" title="Second Brain" href="#/intelligence/brain">
      {() => (
        <div className="flex flex-col gap-2.5">
          {tiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
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
          )}
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

// Every table of the module, numbered as the rail numbers its modules (2.2, its parts 2.2.1),
// all of them in sight. The pin puts a table in the bar's switch, or takes it out. On Home, every
// module's, each under its name, the tables on rows folded until Show more.
type TablesOf = Pick<ModuleView, 'id' | 'name' | 'tables'>
export function Tables({ ms, href }: { ms: TablesOf[]; href: string }) {
  const [numbers, setNumbers] = useState(new Map<string, string>())
  useEffect(() => {
    api.get<ModuleSummary[]>('/api/modules').then(
      (all) => setNumbers(moduleNumbers(all)),
      () => undefined,
    )
  }, [])
  const shown = ms.filter((m) => m.tables.length)
  return (
    <Card
      id="tables"
      title="Tables"
      href={href}
      count={shown.reduce((a, m) => a + m.tables.length, 0)}
      grows={ms.length > 1}
    >
      {(big) => (
        <div>
          {shown.map((m) => (
            <div key={m.id}>
              {ms.length > 1 && <p className="pt-2 pb-1 text-ink-3 text-xs">{m.name}</p>}
              <TableRows m={m} number={numbers.get(m.id) ?? ''} all={big || ms.length === 1} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function TableRows({ m, number, all }: { m: TablesOf; number: string; all: boolean }) {
  const { pins, toggle } = usePins(m)
  return (
    <>
      {numberTables(m.tables, number)
        .filter((x) => all || x.depth === 0)
        .map(({ table: t, n, depth }) => (
          <div
            key={t.id}
            className="group/t flex h-8 items-center gap-1.5 border-hair border-t text-md"
            style={{ paddingLeft: depth * 16 }}
          >
            <span className="text-ink-3 text-sm tabular-nums">{n}</span>
            <a
              href={`#/table/${t.id}`}
              className="min-w-0 truncate text-ink hover:text-accent hover:underline"
            >
              {t.name}
            </a>
            <span className="flex-1 text-ink-3 text-sm tabular-nums">
              {t.rows.toLocaleString()}
            </span>
            <button
              type="button"
              aria-label={
                pins.includes(t.id) ? `Unpin ${t.name} from the bar` : `Pin ${t.name} to the bar`
              }
              data-tip={pins.includes(t.id) ? 'Unpin from the bar' : 'Pin to the bar'}
              onClick={() => toggle(t.id)}
              className={cn(
                'grid size-6 place-items-center rounded-sm hover:bg-hover',
                pins.includes(t.id)
                  ? 'text-accent'
                  : 'text-ink-3 opacity-0 group-hover/t:opacity-100',
              )}
            >
              <Pin className="size-3.5" />
            </button>
          </div>
        ))}
    </>
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

// The organization chart (Vikas, 28 Oct): a table with a relation to its own rows ("Reports to",
// "Manager") drawn as a tree, each person under the one they report to; a click opens the row.
function orgOf(t: TableData) {
  const ids = new Set(t.rows.map((r) => r.id))
  const up = t.fields
    .filter(
      (f) =>
        f.kind === 'relation' &&
        !f.many &&
        t.rows.some((r) => ids.has(r.values[f.slug] as string)) &&
        t.rows.every((r) => r.values[f.slug] == null || ids.has(r.values[f.slug] as string)),
    )
    .sort(
      (a, b) =>
        Number(/report|manager|lead/i.test(b.name)) - Number(/report|manager|lead/i.test(a.name)),
    )[0]
  if (!up) return null
  const name = t.fields.find((f) => f.kind === 'text') ?? t.fields[0]
  const role = t.fields.find((f) => f.kind === 'choice' && /role|title|position/i.test(f.name))
  return name ? { up: up.slug, name: name.slug, role: role?.slug ?? null, upName: up.name } : null
}

function OrgChart({
  t,
  up,
  name,
  role,
  upName,
}: {
  t: TableData
  up: string
  name: string
  role: string | null
  upName: string
}) {
  const under = (id: string | null) =>
    t.rows.filter((r) => ((r.values[up] as string | undefined) ?? null) === id)
  const node = (r: TableData['rows'][number], depth: number): ReactNode => {
    const kids = depth < 6 ? under(r.id) : []
    return (
      <li key={r.id} className="flex flex-col items-center">
        <a
          href={`#/row/${r.id}`}
          className="flex min-w-32 flex-col items-center rounded-md border border-line bg-surface px-3 py-1.5 text-center shadow-btn hover:border-accent-line hover:bg-accent-soft"
        >
          <span className="font-medium text-ink text-sm">{String(r.values[name] ?? '…')}</span>
          {role && r.values[role] != null && (
            <span className="text-ink-3 text-xs">{String(r.values[role])}</span>
          )}
        </a>
        {kids.length > 0 && (
          <>
            <span className="h-3 w-px bg-line" />
            {/* those who manage no one stand in a column under their manager, so it stays narrow */}
            <ul
              className={cn(
                'flex gap-3',
                kids.some((k) => under(k.id).length)
                  ? 'border-line border-t pt-3'
                  : 'flex-col items-center gap-1.5',
              )}
            >
              {kids.map((k) => node(k, depth + 1))}
            </ul>
          </>
        )}
      </li>
    )
  }
  return (
    <Card
      id={`org:${t.id}`}
      title="Organization"
      href={`#/table/${t.id}`}
      count={t.rows.length}
      wide
    >
      {() => (
        <div
          // a wide chart opens on its top, in the middle
          ref={(el) => {
            if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
          }}
          className="overflow-x-auto px-3 pb-3"
          title={`By ${upName.toLowerCase()}`}
        >
          <ul className="mx-auto flex w-max gap-6">{under(null).map((r) => node(r, 0))}</ul>
        </div>
      )}
    </Card>
  )
}
