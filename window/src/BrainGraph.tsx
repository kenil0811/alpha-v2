// Second Brain as a graph, shaped like an egg: the few weightiest things at the narrow top (how to
// work, the rules kept), decisions still proposed in the middle, the many noticed facts across the
// broad bottom. Drawn in SVG; a node opens its row, a line joins facts about the same one.
import type { InstructionView, TableView as TableData } from '@alpha/core/api'
import { useState } from 'react'
import { cn } from './ui/cn.ts'

export type Kind = 'work' | 'rule' | 'decision' | 'noticed'

export interface BrainNode {
  id: string
  kind: Kind
  words: string
  href: string | null // its row; how to work has none, it opens its own list
  about?: string | undefined // a noticed fact's who or what, to join facts about the same one
}

const KINDS: Record<Kind, { label: string; colour: string; band: [number, number] }> = {
  work: { label: 'How to work', colour: 'var(--accent)', band: [-0.92, -0.38] },
  rule: { label: 'Rules', colour: 'var(--good)', band: [-0.92, -0.38] },
  decision: { label: 'Decisions', colour: 'var(--warn)', band: [-0.3, 0.22] },
  noticed: { label: 'Noticed', colour: 'var(--face-busy)', band: [0.3, 0.94] },
}

// What the Second Brain holds, as nodes: dropped decisions and facts are left out.
export function nodesOf(
  lines: InstructionView[],
  decisions: TableData | null,
  noticed: TableData | null,
): BrainNode[] {
  const text = (v: unknown) => (typeof v === 'string' ? v : '')
  const rows = (t: TableData | null) =>
    (t?.rows ?? [])
      .filter((r) => r.values.state !== 'Dropped')
      .map((r) => ({ t: t as TableData, r }))
  return [
    ...lines.map((l) => ({
      id: `w${l.for}${l.words}`,
      kind: 'work' as const,
      words: l.words,
      href: null,
    })),
    ...rows(decisions).map(({ t, r }) => ({
      id: r.id,
      kind: r.values.state === 'Kept' ? ('rule' as const) : ('decision' as const),
      words: text(r.values.decision),
      href: `#/table/${t.id}/${r.id}`,
    })),
    ...rows(noticed)
      .map(({ t, r }) => ({
        id: r.id,
        kind: 'noticed' as const,
        words: [text(r.values.about), text(r.values.fact)].filter(Boolean).join(': '),
        href: `#/table/${t.id}/${r.id}`,
        about: text(r.values.about).trim().toLowerCase() || undefined,
      }))
      // facts about the same one side by side, so their lines stay short
      .sort((a, b) => (a.about ?? '').localeCompare(b.about ?? '')),
  ]
}

// The egg, in the SVG's own units: t runs from -1 at the narrow top to 1 at the broad bottom.
const W = 360
const H = 460
const CX = W / 2
const CY = H / 2
const RX = 150
const RY = H / 2 - 16
const halfWidth = (t: number) => RX * Math.sqrt(Math.max(0, 1 - t * t)) * (1 + 0.25 * t)

export const EGG = `${Array.from({ length: 81 }, (_, i) => {
  const t = -1 + i / 40
  return `${CX + halfWidth(t)},${CY + t * RY}`
}).join(' ')} ${Array.from({ length: 79 }, (_, i) => {
  const t = 1 - (i + 1) / 40
  return `${CX - halfWidth(t)},${CY + t * RY}`
}).join(' ')}`

export interface Placed {
  node: BrainNode
  x: number
  y: number
  r: number
}

// Each band's nodes on rows whose width follows the egg, at the widest spacing at which they all fit.
export function eggLayout(nodes: BrainNode[]): Placed[] {
  const placed: Placed[] = []
  const bands = new Map<string, BrainNode[]>()
  for (const n of nodes) {
    const key = KINDS[n.kind].band.join()
    bands.set(key, [...(bands.get(key) ?? []), n])
  }
  for (const [key, list] of bands) {
    const [t0, t1] = key.split(',').map(Number) as [number, number]
    const h = (t1 - t0) * RY
    let rows: { t: number; cap: number }[] = []
    // ponytail: at spacing 4 a band holds a few thousand; past that the rest are not drawn
    for (let s = 44; s >= 4; s--) {
      const count = Math.max(1, Math.floor(h / s))
      rows = Array.from({ length: count }, (_, i) => {
        const t = t0 + ((i + 0.5) * (t1 - t0)) / count
        const room = 2 * (halfWidth(t) - s * 0.6)
        return { t, cap: room < 0 ? 0 : Math.floor(room / s) + 1 }
      })
      const room = rows.reduce((a, r) => a + r.cap, 0)
      if (room >= list.length || s === 4) {
        // each row takes its share of the band's nodes, so they spread over the whole band
        const share = Math.min(1, list.length / room)
        let at = 0
        let held = 0
        for (const row of rows) {
          held += row.cap
          const here = list.slice(at, Math.round(held * share))
          at += here.length
          here.forEach((node, j) => {
            placed.push({
              node,
              x: CX + (j - (here.length - 1) / 2) * s,
              y: CY + row.t * RY,
              r: Math.min(7, s * 0.32),
            })
          })
        }
        break
      }
    }
  }
  return placed
}

export function BrainGraph({
  nodes,
  onOpen,
}: {
  nodes: BrainNode[]
  onOpen: (n: BrainNode) => void
}) {
  const [hidden, setHidden] = useState<Set<Kind>>(new Set())
  const [shown, setShown] = useState<BrainNode | null>(null)
  const placed = eggLayout(nodes)
  const visible = placed.filter((p) => !hidden.has(p.node.kind))
  // a line between consecutive facts about the same one
  const lines = visible.flatMap((p, i) => {
    const q = visible[i + 1]
    return q && p.node.about && p.node.about === q.node.about ? [[p, q] as const] : []
  })
  const toggle = (k: Kind) =>
    setHidden((h) => {
      const next = new Set(h)
      if (!next.delete(k)) next.add(k)
      return next
    })
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-1.5">
        {(Object.keys(KINDS) as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={!hidden.has(k)}
            onClick={() => toggle(k)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-ink-2 text-sm hover:bg-hover',
              hidden.has(k) && 'opacity-50',
            )}
          >
            <span className="size-2.5 rounded-full" style={{ background: KINDS[k].colour }} />
            {KINDS[k].label}
            <span className="text-ink-3">{nodes.filter((n) => n.kind === k).length}</span>
          </button>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full max-w-[420px]"
        role="img"
        aria-label="Second Brain graph"
      >
        <polygon points={EGG} fill="var(--sunk)" stroke="var(--line)" strokeWidth={1.5} />
        {lines.map(([p, q]) => (
          <line
            key={`${p.node.id}-${q.node.id}`}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke="var(--ink-3)"
            strokeOpacity={0.5}
          />
        ))}
        {visible.map((p) => (
          // biome-ignore lint/a11y/useSemanticElements: a button cannot sit inside an SVG
          <g
            key={p.node.id}
            role="button"
            tabIndex={0}
            aria-label={p.node.words}
            className="cursor-pointer outline-none"
            onClick={() => onOpen(p.node)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(p.node)
              }
            }}
            onPointerEnter={() => setShown(p.node)}
            onPointerLeave={() => setShown(null)}
            onFocus={() => setShown(p.node)}
            onBlur={() => setShown(null)}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={shown === p.node ? p.r + 2 : p.r}
              fill={KINDS[p.node.kind].colour}
              stroke="var(--surface)"
              strokeWidth={1.5}
            />
          </g>
        ))}
      </svg>
      <p className="min-h-[2.75em] max-w-[480px] text-center text-ink-2 text-md">{shown?.words}</p>
    </div>
  )
}
