// The spend card on Settings › LLM draws with the window's one set of chart pieces: the month's
// figures with no cost per task, and a card split by a choice, shown as columns, bars, a donut or
// a table.
import type { UsageView } from '@alpha/core/usage'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Figures, SpendChart } from './SpendChart.tsx'
import { Bars } from './ui/chart.tsx'

const row = (name: string, usd: number) => ({ name, turns: 1, runs: 0, tokens: 100, usd })
const u = {
  month: '2026-11',
  months: ['2026-11'],
  atApiPrices: true,
  total: row('All', 0.3),
  by: {
    day: [row('2026-11-21', 0.1), row('2026-11-22', 0.2)],
    model: [row('claude-opus-5-5', 0.3)],
    module: [row('Alpha', 0.3)],
    agent: [row('Chief of staff', 0.3)],
    schedule: [row('Not a schedule', 0.3)],
    use: [row('Chat turns', 0.3)],
    person: [row('Kenil', 0.3)],
  },
  days: [
    { day: '2026-11-21', usd: 0.1, split: { model: { 'claude-opus-5-5': 0.1 } } },
    { day: '2026-11-22', usd: 0.2, split: { model: { 'claude-opus-5-5': 0.2 } } },
  ],
} as unknown as UsageView

describe('the spend card', () => {
  it('says the month in figures, with no cost per task, and one card split by a choice', () => {
    const figures = renderToString(<Figures u={u} />)
    expect(figures).toContain('Spent')
    expect(figures).toContain('Forecast')
    expect(figures).not.toContain('Per task')
    const card = renderToString(
      <SpendChart u={u} names={{ 'claude-opus-5-5': 'Claude Opus 5.5' }} />,
    )
    expect(card).toContain('Spend')
    expect(card).toContain('aria-label="Show as"')
    expect(card).toContain('By model')
  })

  it('draws bars a table’s chart can pick, from the same pieces', () => {
    const html = renderToString(
      <Bars
        parts={[
          { label: 'New', value: 3 },
          { label: 'Won', value: 1 },
        ]}
        fmt={String}
        onPick={() => undefined}
        pickTip="Show these rows in the table"
      />,
    )
    expect(html).toContain('<button')
    expect(html).toContain('var(--opt-1)')
    expect(html).toContain('>New<')
  })
})
