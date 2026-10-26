import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UsageBody, type UsageView } from './Settings.tsx'

const none = () => undefined

describe('Settings › Model usage', () => {
  it('shows dashes while the core keeps no costs', () => {
    const html = renderToString(<UsageBody usage={null} range="7d" onRange={none} subscription />)
    expect(html).toContain('Covered by your plan')
    expect(html.match(/—/g)?.length).toBeGreaterThanOrEqual(6)
  })

  it('shows what was spent, what the key was charged, today against yesterday and the ranking', () => {
    const usage: UsageView = {
      range: '7d',
      spent: 12.5,
      charged: 4,
      today: 3,
      yesterday: 2,
      limit: null,
      by: {
        module: [
          { id: 'm_1', name: 'Bakery', spent: 8 },
          { id: 'm_2', name: 'Shops', spent: 4.5 },
        ],
        conversation: [],
        agent: [{ id: 'a_1', name: 'Morning brief', spent: 1 }],
      },
    }
    const html = renderToString(
      <UsageBody usage={usage} range="7d" onRange={none} subscription={false} />,
    )
    expect(html).toContain('$12.50')
    expect(html).toContain('Charged to your API key')
    expect(html).toContain('Yesterday $2.00 · +50%')
    expect(html.indexOf('Bakery')).toBeLessThan(html.indexOf('Shops'))
    expect(html).toContain('width:56.25%')
  })
})
