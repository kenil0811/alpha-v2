// One chart for every card that counts (proposal S2, 27 Oct): the same numbers drawn as the kinds
// that fit them, picked from the card's own dropdown. One colour, the accent, in steps; green only
// for a target met. Each mark opens what it counts.
import { Select } from './field.tsx'

export type ChartKind = 'bar' | 'donut' | 'funnel' | 'bullet' | 'rings'
export interface Mark {
  label: string
  n: number
  target?: number // bullet and rings: what it is measured against
  href?: string
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
  if (m.href) window.location.hash = m.href
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
    <div className="flex flex-col gap-1 pt-1">
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
            className="group grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-2 text-left text-md"
          >
            <span className="truncate text-ink-2 group-hover:text-accent">{m.label}</span>
            <span
              className={kind === 'bullet' ? 'h-2.5 rounded-full bg-sunk' : 'flex h-2.5'}
              style={kind === 'funnel' ? { justifyContent: 'center' } : undefined}
            >
              <span
                className={
                  met ? 'block h-full rounded-full bg-good' : 'block h-full rounded-sm bg-accent'
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
    <div className="flex items-center gap-4 pt-1">
      <svg viewBox="0 0 120 120" className="size-30 shrink-0" role="img" aria-label="Donut chart">
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
  )
}

function Rings({ marks, fmt }: { marks: Mark[]; fmt: Fmt }) {
  const c = 2 * Math.PI * 22
  return (
    <div className="flex flex-wrap gap-3 pt-1">
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
              <circle cx="28" cy="28" r="22" fill="none" strokeWidth="6" className="stroke-sunk" />
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
  )
}
