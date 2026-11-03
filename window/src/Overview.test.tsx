import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Paged } from './Overview.tsx'

describe('a card’s rows', () => {
  it('shows five a page with the pager under them, never the whole list (Vikas, 1 Nov)', () => {
    const items = Array.from({ length: 12 }, (_, i) => `row${i}`)
    const html = renderToString(
      <Paged items={items}>{(page) => page.map((r) => <p key={r}>{r}</p>)}</Paged>,
    )
    expect(html).toContain('row4')
    expect(html).not.toContain('row5')
    expect(html).toContain('aria-label="Pages"')
    const one = renderToString(
      <Paged items={items.slice(0, 5)}>{(page) => page.map((r) => <p key={r}>{r}</p>)}</Paged>,
    )
    expect(one).not.toContain('aria-label="Pages"')
  })
})
