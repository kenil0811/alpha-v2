import { describe, expect, it } from 'vitest'
import { type BrainNode, eggLayout } from './BrainGraph.tsx'

const many = (kind: BrainNode['kind'], n: number): BrainNode[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${kind}${i}`, kind, words: '', href: null }))

describe('the Second Brain egg', () => {
  const placed = eggLayout([...many('rule', 6), ...many('decision', 12), ...many('noticed', 300)])
  const ys = (kind: BrainNode['kind']) => placed.filter((p) => p.node.kind === kind).map((p) => p.y)
  const span = (kind: BrainNode['kind']) => {
    const xs = placed.filter((p) => p.node.kind === kind).map((p) => p.x)
    return Math.max(...xs) - Math.min(...xs)
  }
  it('places every node', () => {
    expect(placed).toHaveLength(318)
  })
  it('keeps rules at the top, decisions in the middle, noticed at the bottom', () => {
    expect(Math.max(...ys('rule'))).toBeLessThan(Math.min(...ys('decision')))
    expect(Math.max(...ys('decision'))).toBeLessThan(Math.min(...ys('noticed')))
  })
  it('is narrow at the top and broad at the bottom', () => {
    expect(span('rule')).toBeLessThan(span('noticed'))
  })
  it('never puts two nodes on one spot', () => {
    expect(new Set(placed.map((p) => `${p.x},${p.y}`)).size).toBe(placed.length)
  })
})
