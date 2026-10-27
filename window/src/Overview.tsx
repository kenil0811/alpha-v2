// A module's Overview (Vikas, 27 Oct; proposal P13): what waits on the person, its main table as a
// chart, its tables, agents, notes and what Alpha may do, each a card. Cards sit in rows that
// stretch, so cards in a row end level; a width is a weight, not a fixed slot, and a slot may hold
// two smaller cards. Each card's head is two lines: its name, which opens its page on one click,
// and a sentence that says what the numbers are. A card with nothing to show is not drawn.
import type {
  AgentView,
  CardView,
  ModuleView,
  RunView,
  TableView as TableData,
} from '@alpha/core/api'
import { ChevronDown, ChevronRight, Maximize2, Minimize2, Pin, RefreshCw } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Undo } from './Activity.tsx'
import { api } from './api.ts'
import { when } from './ModulesAndAgents.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Switch } from './ui/switch.tsx'

// The tables pinned to the bar's switch, per module. ponytail: kept in this browser; the core's
// layout keeps it per person once Kenil adds it (core item 75).
const PINS = (id: string) => `alpha.pins.${id}`
export function pinsOf(m: Pick<ModuleView, 'id' | 'tables'>): string[] {
  try {
    const kept = localStorage.getItem(PINS(m.id))
    if (kept) return JSON.parse(kept) as string[]
  } catch {}
  // ponytail: the first four main tables; the rest are a pin away in the Tables card
  return m.tables
    .filter((t) => t.place === 'main')
    .slice(0, 4)
    .map((t) => t.id)
}
function setPins(id: string, pins: string[]) {
  try {
    localStorage.setItem(PINS(id), JSON.stringify(pins))
  } catch {}
  window.dispatchEvent(new Event('alpha-pins'))
}
export function usePins(m: Pick<ModuleView, 'id' | 'tables'> | null): string[] {
  const [, redraw] = useState(0)
  useEffect(() => {
    const on = () => redraw((n) => n + 1)
    window.addEventListener('alpha-pins', on)
    return () => window.removeEventListener('alpha-pins', on)
  }, [])
  return m ? pinsOf(m) : []
}

// A main table lower on the spine relates to another main table (a deal to its source): it goes
// first in the switch. ponytail: by a relation field named as the other table, since the window
// is not told a relation's table; the core sending relatesTo replaces it.
export function lowerFirst(main: TableData[]): TableData[] {
  const names = new Set(main.map((t) => t.name.toLowerCase()))
  const relates = (t: TableData) =>
    t.fields.some(
      (f) =>
        f.kind === 'relation' &&
        (names.has(f.name.toLowerCase()) || names.has(`${f.name.toLowerCase()}s`)),
    )
  return [...main].sort((a, b) => Number(relates(b)) - Number(relates(a)))
}

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
  const [rules, setRules] = useState<number | null>(null)
  useEffect(() => {
    if (version < 0) return
    api.get<RunView[]>('/api/activity').then(
      (all) => setRuns(all.filter((r) => r.moduleId === m.id)),
      () => setRuns([]),
    )
    api.get<{ revokedAt: string | null }[]>(`/api/rules?module=${encodeURIComponent(m.id)}`).then(
      (all) => setRules(all.filter((r) => !r.revokedAt).length),
      () => setRules(0),
    )
  }, [m.id, version])
  const waiting = cards.filter((c) => c.module === m.name)
  const chart = chartOf(main)

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-3 px-7 py-4">
        {(waiting.length > 0 || chart) && (
          <Slots>
            {waiting.length > 0 && <NeedsYou w={6} cards={waiting} />}
            {chart && <Chart w={6} {...chart} />}
          </Slots>
        )}
        <Slots>
          <Tables w={3} m={m} />
          <Agents w={3} m={m} main={main} onChange={onChange} />
          <Notes w={3} m={m} />
          <MayDo w={3} m={m} runs={runs} rules={rules} onChange={onChange} />
        </Slots>
      </div>
    </div>
  )
}

// A row of slots: each card's width a weight, wrapping when the window is narrow.
function Slots({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-stretch gap-3">{children}</div>
}

// A card: its name (one click opens its page) over a smaller sentence; Show more takes the whole
// row. Its actions sit at the right of each line, the primary last.
function Card({
  w,
  title,
  href,
  sub,
  count,
  grows,
  children,
}: {
  w: number
  title: string
  href: string
  sub: string
  count?: number
  grows?: boolean
  children: (big: boolean) => ReactNode
}) {
  const [big, setBig] = useState(false)
  return (
    <section
      style={{ flex: big ? '1 1 100%' : `${w} 1 ${w * 60}px` }}
      className="flex min-w-0 flex-col rounded-lg border border-line bg-surface transition-shadow hover:shadow-pop"
    >
      <div className="flex items-start gap-2 px-3 pt-2.5 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <a
              href={href}
              className="font-semibold text-base text-ink hover:text-accent hover:underline"
            >
              {title}
            </a>
            {!!count && (
              <span className="rounded-full bg-warn-soft px-1.75 font-medium text-sm text-warn">
                {count}
              </span>
            )}
          </div>
          <div className="text-ink-3 text-sm">{sub}</div>
        </div>
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

// One line of a card: what it is on the left, its actions on the right, the primary last.
function Line({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-2 border-hair border-t py-1.5 text-md">
      <div className="min-w-0 flex-1">{children}</div>
      {actions}
    </div>
  )
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`

function NeedsYou({ w, cards }: { w: number; cards: CardView[] }) {
  return (
    <Card
      w={w}
      title="Needs you"
      href="#/"
      count={cards.length}
      sub={`${plural(cards.length, 'thing waits', 'things wait')} on you here; each opens on Home`}
      grows={cards.length > 4}
    >
      {(big) =>
        (big ? cards : cards.slice(0, 4)).map((c) => (
          <Line
            key={c.id}
            actions={
              <Button size="sm" variant="primary" onClick={() => (window.location.hash = '#/')}>
                {c.gate === 'sign_in' ? 'Sign in' : 'Answer'}
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

// The main table with the most rows, counted by its single choice that spreads its rows the most:
// Deals by stage, or by fit while every deal is still New.
function chartOf(main: TableData[]) {
  const t = [...main].sort((a, b) => b.rows.length - a.rows.length)[0]
  if (!t?.rows.length) return null
  const count = (f: TableData['fields'][number]) =>
    f.choices.map((c) => ({
      label: c,
      n: t.rows.filter((r) => r.values[f.name] === c || r.values[f.slug] === c).length,
    }))
  const best = t.fields
    .filter((f) => f.kind === 'choice' && !f.many && f.choices.length >= 3)
    .map((f) => ({ f, bars: count(f) }))
    .sort((a, b) => b.bars.filter((x) => x.n).length - a.bars.filter((x) => x.n).length)[0]
  if (!best || best.bars.filter((x) => x.n).length < 2) return null
  return { table: t, field: best.f.name, bars: best.bars }
}

function Chart({
  w,
  table: t,
  field,
  bars,
}: {
  w: number
  table: TableData
  field: string
  bars: { label: string; n: number }[]
}) {
  const most = Math.max(1, ...bars.map((b) => b.n))
  const shown = bars.filter((b) => b.n > 0)
  return (
    <Card
      w={w}
      title={`${t.name} by ${field.toLowerCase()}`}
      href={`#/table/${t.id}`}
      sub={`${plural(t.rows.length, t.name.replace(/s$/, '').toLowerCase())}; ${shown.length} of the ${bars.length} values of ${field} in use`}
      grows={shown.length !== bars.length}
    >
      {(big) => (
        <div className="flex flex-col gap-1 pt-1">
          {(big ? bars : shown).map((b) => (
            <a
              key={b.label}
              href={`#/table/${t.id}`}
              className="group grid grid-cols-[9rem_1fr_3rem] items-center gap-2 text-md"
            >
              <span className="truncate text-ink-2 group-hover:text-accent">{b.label}</span>
              <span
                className="h-2.5 rounded-sm bg-accent/85"
                style={{ width: `${Math.max(1, (b.n / most) * 100)}%` }}
              />
              <span className="text-right font-medium tabular-nums">{b.n.toLocaleString()}</span>
            </a>
          ))}
        </div>
      )}
    </Card>
  )
}

// Every table of the module as a tree: main tables, the parts of a row under it, the setup tables
// last. The pin puts a table in the bar's switch, or takes it out.
function Tables({ w, m }: { w: number; m: ModuleView }) {
  const pins = usePins(m)
  const [open, setOpen] = useState<string[]>([])
  const main = m.tables.filter((t) => t.place === 'main')
  const setup = m.tables.filter((t) => t.place === 'setup')
  const partsOf = (name: string) => m.tables.filter((t) => t.place === 'part' && t.of === name)
  const pin = (id: string) =>
    setPins(m.id, pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id])
  const row = (t: ModuleView['tables'][number], depth: number, lead?: ReactNode) => (
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
        onClick={() => pin(t.id)}
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
    <Card
      w={w}
      title="Tables"
      href={`#/module/${m.id}/agents`}
      sub={`${plural(m.tables.length, 'table')}; pin one to put it in the bar`}
    >
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

// Agents named after the rows of one of the module's tables are one line, one switch for all: the
// 20 source readers of DealPilot read as "Source readers · 15 of 20 on".
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

function Agents({
  w,
  m,
  main,
  onChange,
}: {
  w: number
  m: ModuleView
  main: TableData[]
  onChange: () => void
}) {
  const { busy, problem, act } = useAct(onChange)
  if (!m.agents.length) return null
  const { groups, rest } = groupsOf(m.agents, main)
  const on = m.agents.filter((a) => a.state === 'on').length
  const last =
    m.agents
      .map((a) => a.lastRunAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null
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
  return (
    <Card
      w={w}
      title="Agents"
      href={`#/module/${m.id}/agents`}
      sub={`${on} of ${m.agents.length} on; last ran ${when(last)}`}
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
                    · {gon.length} of {g.agents.length} on
                  </span>
                </Line>
                {big &&
                  g.agents.map((a) => (
                    <Line
                      key={a.id}
                      actions={
                        <Switch
                          checked={a.state === 'on'}
                          disabled={busy}
                          label={a.state === 'on' ? `Pause ${a.name}` : `Turn on ${a.name}`}
                          onChange={(v) => turn([a], v)}
                        />
                      }
                    >
                      <a
                        href={`#/agent/${a.id}`}
                        className="pl-4 hover:text-accent hover:underline"
                      >
                        {a.name}
                      </a>{' '}
                      <span className="text-ink-3 text-sm">
                        · {a.state === 'on' ? `ran ${when(a.lastRunAt)}` : 'off'}
                      </span>
                    </Line>
                  ))}
              </div>
            )
          })}
          {rest.map((a) => (
            <Line
              key={a.id}
              actions={
                <Switch
                  checked={a.state === 'on'}
                  disabled={busy}
                  label={a.state === 'on' ? `Pause ${a.name}` : `Turn on ${a.name}`}
                  onChange={(v) => turn([a], v)}
                />
              }
            >
              <a href={`#/agent/${a.id}`} className="hover:text-accent hover:underline">
                {a.name}
              </a>{' '}
              <span className="text-ink-3 text-sm">· {a.when}</span>
            </Line>
          ))}
        </div>
      )}
    </Card>
  )
}

// The notes Alpha reads first about the module, its first lines; the whole on the module's page.
// ponytail: skills and facts learned are counted here once the core counts them (core item 77).
function Notes({ w, m }: { w: number; m: ModuleView }) {
  // its paragraphs, as plain sentences: no headings, no marks
  const lines = m.notes
    .split(/\n\s*\n/)
    .filter((p) => !p.startsWith('#'))
    .map((p) =>
      p
        .replace(/\*\*[^*]+\.\*\*\s*/g, '')
        .replace(/[*_`]/g, '')
        .replace(/^[-•]\s*/, '')
        .replace(/\s*\n[-*]?\s*/g, ' ')
        .trim(),
    )
    .filter(Boolean)
  if (!lines.length) return null
  return (
    <Card
      w={w}
      title="What Alpha knows"
      href={`#/module/${m.id}/agents`}
      sub={`The notes Alpha reads before it works on ${m.name}`}
      grows={lines.length > 4}
    >
      {(big) => (
        <div className="flex flex-col gap-1.5 border-hair border-t pt-2 text-md text-ink-2">
          {(big ? lines : lines.slice(0, 4)).map((l, i) => (
            <p key={i} className={big ? '' : 'line-clamp-2'}>
              {l}
            </p>
          ))}
        </div>
      )}
    </Card>
  )
}

// What Alpha may do here: how many rules hold, and what it did lately, each with Revert.
function MayDo({
  w,
  m,
  runs,
  rules,
  onChange,
}: {
  w: number
  m: ModuleView
  runs: RunView[] | null
  rules: number | null
  onChange: () => void
}) {
  const changed = (runs ?? []).filter((r) => !r.quiet)
  const week = changed.filter((r) => Date.now() - Date.parse(r.startedAt) < 7 * 864e5).length
  return (
    <Card
      w={w}
      title="What Alpha may do"
      href={`#/module/${m.id}/agents`}
      sub={`${plural((rules ?? 0) + 1, 'rule')}; Alpha changed things ${plural(week, 'time')} this week`}
      grows={changed.length > 3}
    >
      {(big) => (
        <div>
          {(big ? changed.slice(0, 12) : changed.slice(0, 3)).map((r) => (
            <Line key={r.id} actions={<Undo run={r} onDone={onChange} />}>
              <a href={`#/run/${r.id}`} className="line-clamp-2 hover:text-accent hover:underline">
                {r.words ?? r.name}
              </a>
              <span className="text-ink-3 text-sm">{when(r.startedAt)}</span>
            </Line>
          ))}
          {!changed.length && (
            <Line>
              <span className="text-ink-2">
                Its readers may read {plural(m.sites, 'site')}; anything else that changes your
                data, Alpha asks first.
              </span>
            </Line>
          )}
        </div>
      )}
    </Card>
  )
}
