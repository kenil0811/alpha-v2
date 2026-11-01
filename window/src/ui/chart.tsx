// One chart for every card that counts (proposal S2, 27 Oct): the same numbers drawn as the kinds
// that fit them, picked from the card's own dropdown. One colour, the accent, in steps; green only
// for a target met. Each mark opens what it counts.
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { cn } from './cn.ts'
import { Select } from './field.tsx'

// A drawing's box (Vikas, 29 and 30 Oct): nothing drawn to resize it, only the cursor. Over the
// x-axis (the strip it and its labels are drawn in, below) it shows ↔ and a drag stretches the
// drawing wider or compresses it; over the y-axis (the strip at the left) ↕ and a drag heightens or
// shortens the drawing while the box keeps its height (Vikas, 30 Oct: "I want the section size to
// be fixed"); at the box's bottom-right corner ↘↖ and a drag changes the box, the drawing with it.
// Redrawn at its new size, never below its least; wider or taller than its box, it scrolls inside
// it, never the page. A double-click on an axis or the corner fits it back to the box; a focused
// axis takes the arrows. A drawing with no axes drawn (bars, donut, rings, heat) has only the corner.
type Axis = 'x' | 'y' | 'xy'
const CORNER = 14
const CURSOR: Record<Axis, string> = { x: 'ew-resize', y: 'ns-resize', xy: 'nwse-resize' }
const NUDGE: Record<string, [number, number]> = {
  ArrowRight: [20, 0],
  ArrowLeft: [-20, 0],
  ArrowDown: [0, 20],
  ArrowUp: [0, -20],
}

export function Stretch({
  height,
  least,
  axes,
  className,
  children,
}: {
  height?: number // to start; none, the drawing's own height
  least: [number, number] // the smallest the drawing is drawn: width, height
  axes?: { y: number; x: number } // the strips the axes are drawn in: y's width at the left, x's height below; none, the corner alone
  className?: string
  children: (width: number, height: number) => ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const drawing = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(640) // the box's width
  const [wide, setWide] = useState<number | null>(null) // the person's width, once stretched
  const [tall, setTall] = useState<number | undefined>(height)
  const [frame, setFrame] = useState<number | undefined>() // the box's height, held once the y-axis moves
  const [zone, setZone] = useState<Axis | null>(null) // what the pointer is over
  useLayoutEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const seen = new ResizeObserver(() => setFit(el.clientWidth))
    seen.observe(el)
    return () => seen.disconnect()
  }, [])
  const W = Math.floor(Math.max(least[0], wide ?? fit))
  const H = tall === undefined ? undefined : Math.floor(Math.max(least[1], tall))
  const zoneOf = (e: { clientX: number; clientY: number }): Axis | null => {
    const b = box.current?.getBoundingClientRect()
    const d = drawing.current?.getBoundingClientRect()
    if (!b || !d) return null
    if (b.right - e.clientX < CORNER && b.bottom - e.clientY < CORNER) return 'xy'
    if (!axes) return null
    if (d.bottom - e.clientY < axes.x) return 'x'
    if (e.clientX - d.left < axes.y) return 'y'
    return null
  }
  // the origin is the anchor (Vikas, 30 Oct): the y-axis grows upward, up to stretch, and the
  // drawing keeps its foot where it was in the box, so what scrolls away is the top
  const gap = useRef<number | null>(null) // the drawing's foot below the box's, while the y-axis moves
  useLayoutEffect(() => {
    const el = box.current
    if (el && gap.current !== null) el.scrollTop = el.scrollHeight - el.clientHeight - gap.current
  }, [H])
  const grow = (axis: Axis, r: DOMRect, dx: number, dy: number) => {
    if (axis !== 'y') setWide(Math.max(least[0], r.width + dx))
    if (axis === 'y') {
      const el = box.current
      if (el) gap.current = el.scrollHeight - el.scrollTop - el.clientHeight
      setFrame((f) => f ?? el?.offsetHeight)
      setTall(Math.max(least[1], r.height - dy))
      return
    }
    gap.current = null
    if (axis === 'xy') setFrame(undefined) // the corner is the box's: it follows the drawing again
    if (axis !== 'x') setTall(Math.max(least[1], r.height + dy))
  }
  const fitBack = (axis: Axis) => {
    if (axis !== 'y') setWide(null)
    if (axis === 'xy' || frame === undefined) {
      if (axis !== 'x') setTall(height)
      setFrame(undefined)
    } else if (axis === 'y' && box.current) {
      gap.current = 0 // back with its origin in view
      // the drawing back to the box it is held in (less a sideways scrollbar, if any)
      setTall(box.current.clientHeight)
    }
  }
  // a focused axis: invisible, the arrows stretch it, the app's focus ring the only mark
  const keys = (axis: 'x' | 'y', at: { width?: number; height?: number }) => (
    // biome-ignore lint/a11y/useSemanticElements: a resize handle for the keyboard
    <div
      role="separator"
      tabIndex={0}
      aria-label={axis === 'x' ? 'Stretch the x-axis' : 'Stretch the y-axis'}
      aria-valuenow={axis === 'x' ? W : (H ?? 0)}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      onKeyDown={(e) => {
        const d = NUDGE[e.key]
        const r = drawing.current?.getBoundingClientRect()
        if (!d || !r) return
        e.preventDefault()
        grow(axis, r, axis === 'x' ? d[0] : 0, axis === 'y' ? d[1] : 0)
      }}
      style={at}
      className={cn(
        'pointer-events-none absolute bottom-0 left-0 outline-none focus-visible:ring-2 focus-visible:ring-accent-line',
        axis === 'x' ? 'right-0' : 'top-0',
      )}
    />
  )
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the axes are held by the pointer; the separators take the keys
    <div
      ref={box}
      data-zone={zone ?? undefined}
      style={{ height: frame, cursor: zone ? CURSOR[zone] : undefined }}
      className={cn(
        'max-w-full data-zone:**:cursor-[inherit]!',
        frame === undefined ? 'overflow-x-auto overflow-y-hidden' : 'overflow-auto',
        className,
      )}
      onPointerMove={(e) => {
        if (e.buttons) return
        const z = zoneOf(e)
        if (z !== zone) setZone(z)
      }}
      onPointerLeave={() => setZone(null)}
      onDoubleClick={(e) => {
        const z = zoneOf(e)
        if (z) fitBack(z)
      }}
      // a click on an axis strip belongs to the strip, so its double-click fits back, never opens
      // the bar or label beneath it
      onClickCapture={(e) => {
        if (axes && zoneOf(e)) {
          e.stopPropagation()
          e.preventDefault()
        }
      }}
      onPointerDown={(e) => {
        const axis = zoneOf(e)
        const r = drawing.current?.getBoundingClientRect()
        if (!axis || !r || e.button !== 0) return
        e.preventDefault() // no text selected while dragging
        const [x0, y0] = [e.clientX, e.clientY]
        let held = false
        const move = (m: PointerEvent) => {
          const [dx, dy] = [m.clientX - x0, m.clientY - y0]
          if (!held && Math.hypot(dx, dy) < 3) return
          held = true
          document.documentElement.style.cursor = CURSOR[axis]
          grow(axis, r, dx, dy)
        }
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          document.documentElement.style.cursor = ''
          // a drag is not a click on the label it began over
          if (held)
            window.addEventListener('click', (c) => c.stopPropagation(), {
              capture: true,
              once: true,
            })
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
    >
      <div
        ref={drawing}
        className="relative"
        style={{ width: W, height: H === undefined ? undefined : H }}
      >
        {children(W, H ?? least[1])}
        {axes && keys('x', { height: axes.x })}
        {axes && keys('y', { width: axes.y })}
      </div>
    </div>
  )
}

// what the pointer is on, drawn last: SVG has no z-index, so the one hovered comes to the front
function useFront() {
  const [hot, setHot] = useState<number | null>(null)
  const order = (n: number) => {
    const all = [...Array(n).keys()]
    return hot === null || hot >= n ? all : [...all.filter((i) => i !== hot), hot]
  }
  return { hot, setHot, order }
}

export type ChartKind = 'bar' | 'donut' | 'funnel' | 'bullet' | 'rings'
export interface Mark {
  label: string
  n: number
  target?: number // bullet and rings: what it is measured against
  href?: string
  onOpen?: () => void // in place of href, where the rows open on the same screen
}

const KIND_WORDS: Record<ChartKind, string> = {
  bar: 'Bars',
  donut: 'Donut',
  funnel: 'Funnel',
  bullet: 'Against target',
  rings: 'Rings',
}
const STEPS = [1, 0.78, 0.6, 0.45, 0.33, 0.24, 0.17, 0.12]
const open = (m: Mark) => {
  if (m.onOpen) m.onOpen()
  else if (m.href) window.location.hash = m.href
}

export function KindPicker({
  kinds,
  kind,
  onKind,
}: {
  kinds: ChartKind[]
  kind: ChartKind
  onKind: (k: ChartKind) => void
}) {
  if (kinds.length < 2) return null
  return (
    <Select
      aria-label="Chart type"
      value={kind}
      onChange={(e) => onKind(e.target.value as ChartKind)}
      className="h-6.5 w-auto shrink-0 text-sm"
    >
      {kinds.map((k) => (
        <option key={k} value={k}>
          {KIND_WORDS[k]}
        </option>
      ))}
    </Select>
  )
}

// how a mark's number reads: a count by default, or dollars
export type Fmt = (n: number) => string
const count: Fmt = (n) => n.toLocaleString()

export function Chart({ kind, marks, fmt = count }: { kind: ChartKind; marks: Mark[]; fmt?: Fmt }) {
  if (kind === 'donut') return <Donut marks={marks} fmt={fmt} />
  if (kind === 'rings') return <Rings marks={marks} fmt={fmt} />
  const most = Math.max(1, ...marks.map((m) => m.target ?? m.n), ...marks.map((m) => m.n))
  return (
    // the y-axis is the labels' column (at least 6rem), the x-axis a band below the bars
    <Stretch least={[280, 64]} axes={{ y: 96, x: 12 }}>
      {() => (
        <div className="flex h-full min-h-16 flex-col gap-1 pt-1 pb-3">
          {marks.map((m, i) => {
            const met = m.target !== undefined && m.n >= m.target
            const share =
              kind === 'bullet'
                ? Math.min(1, m.n / Math.max(1e-9, m.target ?? most))
                : kind === 'funnel'
                  ? Math.sqrt(m.n / most)
                  : m.n / most
            return (
              <button
                key={m.label}
                type="button"
                onClick={() => open(m)}
                data-tip={`${m.label}: ${fmt(m.n)}${m.target !== undefined ? ` of ${fmt(m.target)}` : ''}`}
                className="group grid min-h-5 flex-1 grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-2 text-left text-md"
              >
                <span className="truncate text-ink-2 group-hover:text-accent">{m.label}</span>
                <span
                  className={kind === 'bullet' ? 'h-2.5 rounded-full bg-sunk' : 'flex h-2.5'}
                  style={kind === 'funnel' ? { justifyContent: 'center' } : undefined}
                >
                  <span
                    className={
                      met
                        ? 'block h-full rounded-full bg-good'
                        : 'block h-full rounded-sm bg-accent'
                    }
                    style={{
                      width: `${Math.max(1.5, share * 100)}%`,
                      opacity: kind === 'funnel' ? STEPS[Math.min(i, 4)] : 0.85,
                    }}
                  />
                </span>
                <span className="text-right font-medium tabular-nums">
                  {fmt(m.n)}
                  {m.target !== undefined && (
                    <span className="font-normal text-ink-3"> / {fmt(m.target)}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Stretch>
  )
}

function Donut({ marks, fmt }: { marks: Mark[]; fmt: Fmt }) {
  const shown = marks.filter((m) => m.n > 0)
  const total = shown.reduce((a, m) => a + m.n, 0) || 1
  const R = 52
  const r = 32
  let a0 = -Math.PI / 2
  const at = (a: number, rad: number) => `${60 + rad * Math.cos(a)} ${60 + rad * Math.sin(a)}`
  return (
    <Stretch least={[280, 120]}>
      {() => (
        <div className="flex h-full items-center gap-4 pt-1">
          <svg
            viewBox="0 0 120 120"
            className="aspect-square h-full min-h-30 shrink-0"
            role="img"
            aria-label="Donut chart"
          >
            {shown.map((m, i) => {
              const a1 = a0 + (m.n / total) * Math.PI * 2 - (shown.length > 1 ? 0.0001 : 0.001)
              const big = a1 - a0 > Math.PI ? 1 : 0
              const d = `M${at(a0, R)}A${R} ${R} 0 ${big} 1 ${at(a1, R)}L${at(a1, r)}A${r} ${r} 0 ${big} 0 ${at(a0, r)}Z`
              a0 = a1
              return (
                <a key={m.label} href={m.href} aria-label={`${m.label}: ${fmt(m.n)}`}>
                  <path
                    d={d}
                    className="fill-accent hover:opacity-70"
                    style={{ fillOpacity: STEPS[i % STEPS.length] }}
                  >
                    <title>{`${m.label}: ${fmt(m.n)}`}</title>
                  </path>
                </a>
              )
            })}
            <text
              x="60"
              y="66"
              textAnchor="middle"
              className="fill-ink font-serif text-md tabular-nums"
            >
              {fmt(total)}
            </text>
          </svg>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {shown.slice(0, 8).map((m, i) => (
              <button
                key={m.label}
                type="button"
                onClick={() => open(m)}
                data-tip={`${m.label}: ${fmt(m.n)}`}
                className="flex min-w-0 items-center gap-2 text-left text-md hover:text-accent"
              >
                <span
                  className="size-2.5 shrink-0 rounded-xs bg-accent"
                  style={{ opacity: STEPS[i % STEPS.length] }}
                />
                <span className="truncate text-ink-2">{m.label}</span>
                <span className="font-medium tabular-nums">{fmt(m.n)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Stretch>
  )
}

function Rings({ marks, fmt }: { marks: Mark[]; fmt: Fmt }) {
  const c = 2 * Math.PI * 22
  return (
    <Stretch least={[200, 80]}>
      {() => (
        <div className="flex h-full flex-wrap gap-3 pt-1">
          {marks.map((m) => {
            const f = Math.min(1, m.n / Math.max(1e-9, m.target ?? m.n))
            const met = m.target !== undefined && m.n >= m.target
            return (
              <button
                key={m.label}
                type="button"
                onClick={() => open(m)}
                className="flex w-18 flex-col items-center gap-1 text-center hover:text-accent"
              >
                <svg viewBox="0 0 56 56" className="size-14" role="img" aria-label={m.label}>
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    strokeWidth="6"
                    className="stroke-sunk"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${c * f} ${c}`}
                    transform="rotate(-90 28 28)"
                    className={met ? 'stroke-good' : 'stroke-accent'}
                  />
                  <text x="28" y="32" textAnchor="middle" className="fill-ink text-xs">
                    {fmt(m.n)}
                  </text>
                </svg>
                <span className="line-clamp-2 text-ink-2 text-xs">{m.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </Stretch>
  )
}

// Bubbles (Vikas, 27 Oct: three things in two dimensions): each row a dot, when it falls along
// the bottom, its lane (a stage) up the side, an amount as its size and a state as its colour,
// with a legend for both and the row's own words on a hover. A click opens the row.
export interface Bubble {
  at: number // a day, as a time
  lane: string
  size: number
  tone?: 'good' | 'warn' | 'bad' | 'accent' | undefined
  label: string // what the hover says
  href?: string
  count?: number // how many rows it stands for, when several fall together
}
const FILL = { good: 'fill-good', warn: 'fill-warn', bad: 'fill-bad', accent: 'fill-accent' }
const SWATCH = { good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad', accent: 'bg-accent' }

export function Bubbles({
  points,
  lanes,
  size,
  tones,
}: {
  points: Bubble[]
  lanes: string[]
  size: string // the amount's name, for the legend
  tones: { label: string; tone: keyof typeof FILL }[] // the colour's legend
}) {
  const { hot, setHot, order } = useFront()
  // rows on the same day in the same lane are one bubble with their count on it, never a bubble
  // drawn over another (Vikas, 30 Oct: "circles inside circles" read as nothing)
  points = together(points)
  const from = Math.min(...points.map((p) => p.at))
  const to = Math.max(...points.map((p) => p.at))
  const span = Math.max(to - from, 864e5)
  const most = Math.max(1, ...points.map((p) => p.size))
  // area, not radius, follows the amount; a bubble holding several is big enough for its number
  const r = (n: number, k = 1) => Math.max(k > 1 ? 9 : 0, 4 + 10 * Math.sqrt(Math.max(n, 0) / most))
  const ticks = Array.from({ length: 5 }, (_, i) => from + (span * i) / 4)
  const day = (t: number) =>
    new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const today = Date.now()
  // the big ones first, so a small one is never hidden under them
  const drawn = [...points].sort((a, b) => b.size - a.size)
  const LEFT = 112
  const draw = (W: number, H: number) => {
    const LANE = (H - 26) / Math.max(lanes.length, 1)
    const x = (t: number) => LEFT + 12 + ((t - from) / span) * (W - LEFT - 28)
    return (
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block"
        role="img"
        aria-label="Bubble chart"
      >
        {lanes.map((l, i) => (
          <g key={l}>
            <line
              x1={LEFT}
              x2={W}
              y1={(i + 0.5) * LANE}
              y2={(i + 0.5) * LANE}
              className="stroke-line"
              strokeWidth={1}
            />
            <text
              x={LEFT - 8}
              y={(i + 0.5) * LANE + 4}
              textAnchor="end"
              className="fill-ink-2 text-xs"
            >
              {l}
            </text>
          </g>
        ))}
        {ticks.map((t, i) =>
          i > 0 && day(t) === day(ticks[i - 1] as number) ? null : (
            <text
              key={t}
              x={x(t)}
              y={H - 6}
              textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
              className="fill-ink-3 text-xs tabular-nums"
            >
              {day(t)}
            </text>
          ),
        )}
        {today > from && today < to && (
          <line
            x1={x(today)}
            x2={x(today)}
            y1={0}
            y2={H - 20}
            className="stroke-ink-3"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
        )}
        {order(drawn.length).map((i) => {
          const p = drawn[i]
          if (!p) return null
          const lane = lanes.indexOf(p.lane)
          return (
            <a
              key={`${p.label}${i}`}
              href={p.href}
              onPointerEnter={() => setHot(i)}
              onPointerLeave={() => setHot(null)}
              onClick={(e) => {
                if (!p.href) e.preventDefault()
              }}
            >
              <circle
                cx={x(p.at)}
                cy={(lane + 0.5) * LANE}
                r={r(p.size, p.count)}
                className={cn(
                  FILL[p.tone ?? 'accent'],
                  hot === i ? 'stroke-ink' : 'stroke-surface',
                )}
                strokeWidth={hot === i ? 2.5 : 2}
                fillOpacity={hot === i ? 1 : 0.85}
              >
                <title>{p.label}</title>
              </circle>
              {(p.count ?? 1) > 1 && (
                <text
                  x={x(p.at)}
                  y={(lane + 0.5) * LANE + 4}
                  textAnchor="middle"
                  className="pointer-events-none fill-surface font-medium text-xs tabular-nums"
                >
                  {p.count}
                </text>
              )}
            </a>
          )
        })}
      </svg>
    )
  }
  return (
    <div className="flex flex-col gap-2 pt-1">
      <Stretch
        height={lanes.length * 34 + 26}
        least={[360, lanes.length * 20 + 26]}
        axes={{ y: LEFT, x: 26 }}
      >
        {draw}
      </Stretch>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-2 text-sm">
        {tones.map((t) => (
          <span key={t.label} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-full', SWATCH[t.tone])} />
            {t.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-ink-3">
          <span className="size-1.5 rounded-full bg-ink-3" />
          <span className="size-3 rounded-full bg-ink-3" />
          bigger is more {size.toLowerCase()}
        </span>
        {points.some((p) => (p.count ?? 1) > 1) && (
          <span className="text-ink-3">a number is how many on that day</span>
        )}
        {today > from && today < to && <span className="text-ink-3">dashed line is today</span>}
      </div>
    </div>
  )
}

const short = (n: number) =>
  n.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })
// round steps (1, 2, 2.5 or 5 of a power of ten) from below the least to above the most
export function ticksOf(least: number, most: number) {
  const raw = Math.max(most - least, 1) / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * p >= raw) ?? 10) * p
  const lo = Math.floor(least / step) * step
  return Array.from({ length: Math.ceil((most - lo) / step) + 1 }, (_, i) => lo + i * step)
}

// Scatter (Vikas, 28 Oct): each row a dot at two of its amounts, sized by a third and coloured by
// a state when the table has them. Read for the corner that matters: many and slow, big and late.
export interface Dot {
  x: number
  y: number
  size?: number | undefined
  tone?: keyof typeof FILL | undefined
  label: string
  href?: string | undefined
}

// Bubbles on the same day in the same lane, as one: amounts added, the most common colour, every
// row named on the hover, and opening the row when there is only one.
export function together(points: Bubble[]): Bubble[] {
  const groups = new Map<string, Bubble[]>()
  for (const p of points) {
    const k = `${p.lane}|${new Date(p.at).toDateString()}`
    groups.set(k, [...(groups.get(k) ?? []), p])
  }
  return [...groups.values()].map((g) => {
    const first = g[0] as Bubble
    if (g.length === 1) return first
    const tones = new Map<Bubble['tone'], number>()
    for (const p of g) tones.set(p.tone, (tones.get(p.tone) ?? 0) + 1)
    const tone = [...tones].sort((a, b) => b[1] - a[1])[0]?.[0]
    const named = g.slice(0, 6).map((p) => p.label)
    const more = g.length > 6 ? `\nand ${g.length - 6} more` : ''
    return {
      at: first.at,
      lane: first.lane,
      size: g.reduce((n, p) => n + p.size, 0),
      tone,
      count: g.length,
      label: `${g.length} on this day:\n${named.join('\n')}${more}`,
    }
  })
}

export function Scatter({
  points,
  x: xName,
  y: yName,
  size,
  tones,
}: {
  points: Dot[]
  x: string
  y: string
  size?: string | undefined
  tones: { label: string; tone: keyof typeof FILL }[]
}) {
  const { hot, setHot, order } = useFront()
  const LEFT = 44
  const BOTTOM = 34
  // a scatter need not start at nought: the axes fit the dots
  const tx = ticksOf(Math.min(...points.map((p) => p.x)), Math.max(...points.map((p) => p.x)))
  const ty = ticksOf(Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y)))
  const [x0, x1, y0, y1] = [tx[0] ?? 0, tx.at(-1) ?? 1, ty[0] ?? 0, ty.at(-1) ?? 1]
  const ms = Math.max(1, ...points.map((p) => p.size ?? 0))
  const r = (n?: number) => (size ? 4 + 10 * Math.sqrt(Math.max(n ?? 0, 0) / ms) : 5)
  const drawn = [...points].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
  const draw = (W: number, H: number) => {
    const x = (n: number) => LEFT + 14 + ((n - x0) / (x1 - x0 || 1)) * (W - LEFT - 28)
    const y = (n: number) => H - BOTTOM - 16 - ((n - y0) / (y1 - y0 || 1)) * (H - BOTTOM - 30)
    return (
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block"
        role="img"
        aria-label="Scatter chart"
      >
        {ty.map((t) => (
          <g key={`y${t}`}>
            <line x1={LEFT} x2={W} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
            <text
              x={LEFT - 6}
              y={y(t) + 4}
              textAnchor="end"
              className="fill-ink-3 text-xs tabular-nums"
            >
              {short(t)}
            </text>
          </g>
        ))}
        {tx.map((t, i) => (
          <text
            key={`x${t}`}
            x={x(t)}
            y={H - BOTTOM + 12}
            textAnchor={i === 0 ? 'start' : i === tx.length - 1 ? 'end' : 'middle'}
            className="fill-ink-3 text-xs tabular-nums"
          >
            {short(t)}
          </text>
        ))}
        <text x={W} y={H - 4} textAnchor="end" className="fill-ink-2 text-xs">
          {xName} →
        </text>
        <text x={LEFT} y={10} className="fill-ink-2 text-xs">
          ↑ {yName}
        </text>
        {order(drawn.length).map((i) => {
          const p = drawn[i]
          if (!p) return null
          return (
            <a
              key={`${p.label}${i}`}
              href={p.href}
              onPointerEnter={() => setHot(i)}
              onPointerLeave={() => setHot(null)}
              onClick={(e) => {
                if (!p.href) e.preventDefault()
              }}
            >
              <circle
                cx={x(p.x)}
                cy={y(p.y)}
                r={r(p.size)}
                className={cn(
                  FILL[p.tone ?? 'accent'],
                  hot === i ? 'stroke-ink' : 'stroke-surface',
                )}
                strokeWidth={hot === i ? 2.5 : 2}
                fillOpacity={hot === i ? 1 : 0.85}
              >
                <title>{p.label}</title>
              </circle>
            </a>
          )
        })}
      </svg>
    )
  }
  return (
    <div className="flex flex-col gap-2 pt-1">
      <Stretch height={260} least={[320, 180]} axes={{ y: LEFT, x: BOTTOM }}>
        {draw}
      </Stretch>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-2 text-sm">
        {tones.map((t) => (
          <span key={t.label} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-full', SWATCH[t.tone])} />
            {t.label}
          </span>
        ))}
        {size && (
          <span className="flex items-center gap-1.5 text-ink-3">
            <span className="size-1.5 rounded-full bg-ink-3" />
            <span className="size-3 rounded-full bg-ink-3" />
            bigger is more {size.toLowerCase()}
          </span>
        )}
      </div>
    </div>
  )
}

// Lines (Vikas, 28 Oct): counts over time, one line per kind, in the series colours in their order;
// past four the rest are one grey Other. Each line's name sits at its end, so colour is never the
// only way to tell them; a hover on a period gives every line's count there, and a click its rows.
export interface Series {
  label: string
  n: number[] // one per period
}
const STROKE = ['stroke-series-1', 'stroke-series-2', 'stroke-series-3', 'stroke-series-4']

export function Lines({
  series,
  periods,
}: {
  series: Series[]
  periods: { label: string; href?: string | undefined }[]
}) {
  const [hot, setHot] = useState<number | null>(null) // a line under the pointer, drawn last
  return (
    <Stretch
      height={220}
      least={[320, 140]}
      axes={{ y: 36, x: 22 }} // drawLines' LEFT and BOTTOM
      className="pt-1"
    >
      {(W, H) => drawLines(series, periods, W, H, hot, setHot)}
    </Stretch>
  )
}

function drawLines(
  series: Series[],
  periods: { label: string; href?: string | undefined }[],
  W: number,
  H: number,
  hot: number | null,
  setHot: (i: number | null) => void,
) {
  const LEFT = 36
  const RIGHT = 120
  const BOTTOM = 22
  const ticks = ticksOf(0, Math.max(1, ...series.flatMap((s) => s.n)))
  const most = ticks.at(-1) ?? 1
  const step = (W - LEFT - RIGHT) / Math.max(periods.length - 1, 1)
  const x = (i: number) => LEFT + i * step
  const y = (n: number) => H - BOTTOM - 6 - (n / most) * (H - BOTTOM - 16)
  // the names at the lines' ends, pushed apart where they would sit on each other
  const ends = series.map((s, i) => ({ i, at: y(s.n.at(-1) ?? 0) })).sort((a, b) => a.at - b.at)
  ends.forEach((e, k) => {
    const above = ends[k - 1]
    if (above) e.at = Math.max(e.at, above.at + 14)
  })
  // and back up from the bottom where the pushing ran past it
  for (const [k, e] of [...ends.entries()].reverse())
    e.at = Math.min(e.at, (ends[k + 1]?.at ?? H - BOTTOM + 2) - 14)
  const stroke = (i: number) => STROKE[i] ?? 'stroke-ink-3'
  const every = Math.ceil(periods.length / 6)
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="block"
      role="img"
      aria-label="Line chart"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={LEFT}
            x2={W - RIGHT}
            y1={y(t)}
            y2={y(t)}
            className="stroke-line"
            strokeWidth={1}
          />
          <text
            x={LEFT - 6}
            y={y(t) + 4}
            textAnchor="end"
            className="fill-ink-3 text-xs tabular-nums"
          >
            {Number.isInteger(t) ? t : ''}
          </text>
        </g>
      ))}
      {periods.map((p, i) =>
        (i % every === 0 && periods.length - 1 - i >= every) || i === periods.length - 1 ? (
          <text
            key={p.label}
            x={x(i)}
            y={H - 4}
            textAnchor={i === 0 ? 'start' : i === periods.length - 1 ? 'end' : 'middle'}
            className="fill-ink-3 text-xs"
          >
            {p.label}
          </text>
        ) : null,
      )}
      {/* the line whose name is under the pointer comes to the front, the others fade */}
      {[...series.keys()]
        .sort((p, q) => Number(p === hot) - Number(q === hot))
        .map((i) => (
          <polyline
            key={series[i]?.label}
            points={(series[i]?.n ?? []).map((n, j) => `${x(j)},${y(n)}`).join(' ')}
            fill="none"
            strokeWidth={hot === i ? 3 : 2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className={cn(
              stroke(i),
              'transition-opacity',
              hot !== null && hot !== i && 'opacity-30',
            )}
          />
        ))}
      {periods.map((p, i) => (
        <a
          key={`hit${p.label}`}
          href={p.href}
          className="group"
          onClick={(e) => {
            if (!p.href) e.preventDefault()
          }}
        >
          <rect
            x={x(i) - step / 2}
            y={0}
            width={Math.max(step, 12)}
            height={H - BOTTOM}
            fill="transparent"
          >
            <title>
              {[p.label, ...series.map((s) => `${s.label} ${s.n[i] ?? 0}`)].join(' · ')}
            </title>
          </rect>
          <line
            x1={x(i)}
            x2={x(i)}
            y1={4}
            y2={H - BOTTOM - 6}
            className="stroke-ink-3 opacity-0 group-hover:opacity-100"
            strokeWidth={1}
            pointerEvents="none"
          />
        </a>
      ))}
      {ends.map((e) => (
        <g
          key={series[e.i]?.label}
          onPointerEnter={() => setHot(e.i)}
          onPointerLeave={() => setHot(null)}
        >
          <line
            x1={W - RIGHT + 6}
            x2={W - RIGHT + 16}
            y1={e.at}
            y2={e.at}
            strokeWidth={2}
            className={stroke(e.i)}
          />
          <text x={W - RIGHT + 20} y={e.at + 4} className="fill-ink-2 text-xs">
            {series[e.i]?.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

// Heat (Vikas, 28 Oct): rows counted on two things at once, one down the side and one along the
// top (insurer by stage). One colour, the accent, darker for more; an empty cell stays blank. Each
// cell says its count and opens its rows.
export function Heat({
  rows,
  cols,
  cells,
}: {
  rows: string[]
  cols: string[]
  cells: { n: number; href?: string | undefined }[][] // [row][col]
}) {
  const most = Math.max(1, ...cells.flat().map((c) => c.n))
  return (
    // the y-axis is the rows' names (at least 6rem), the x-axis the key's line at the foot
    <Stretch least={[320, 80]} axes={{ y: 96, x: 20 }}>
      {() => (
        <div className="flex h-full flex-col gap-2 pt-1">
          <div
            className="grid gap-0.5 text-sm"
            style={{
              gridTemplateColumns: `minmax(6rem, max-content) repeat(${cols.length}, minmax(3rem, 1fr))`,
            }}
          >
            <span />
            {cols.map((c) => (
              <span
                key={c}
                className="line-clamp-2 self-end px-1 pb-1 text-center text-ink-3 text-xs"
              >
                {c}
              </span>
            ))}
            {rows.map((r, i) => (
              <div key={r} className="contents">
                <span className="truncate py-1.5 pr-2 text-ink-2" title={r}>
                  {r}
                </span>
                {cols.map((c, j) => {
                  const cell = cells[i]?.[j] ?? { n: 0 }
                  const f = cell.n / most
                  return (
                    <a
                      key={c}
                      href={cell.href}
                      title={`${r} · ${c}: ${cell.n}`}
                      onClick={(e) => {
                        if (!cell.href) e.preventDefault()
                      }}
                      className={cn(
                        'relative grid place-items-center rounded-sm tabular-nums hover:ring-2 hover:ring-accent-line',
                        cell.n ? (f > 0.55 ? 'text-accent-ink' : 'text-ink') : 'bg-sunk text-ink-3',
                      )}
                    >
                      {cell.n > 0 && (
                        <span
                          className="absolute inset-0 rounded-sm bg-accent"
                          style={{ opacity: 0.12 + 0.88 * f }}
                        />
                      )}
                      <span className="relative">{cell.n || ''}</span>
                    </a>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-ink-3 text-sm">
            {[0.15, 0.4, 0.7, 1].map((o) => (
              <span key={o} className="size-2.5 rounded-sm bg-accent" style={{ opacity: o }} />
            ))}
            darker is more
          </div>
        </div>
      )}
    </Stretch>
  )
}
