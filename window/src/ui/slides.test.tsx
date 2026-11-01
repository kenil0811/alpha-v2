import { renderToString } from 'react-dom/server'
import { expect, it } from 'vitest'
import { pagesOf, Slides } from './slides.tsx'

const list = (items: string[], per = 5) =>
  renderToString(
    <Slides items={items} per={per} label="Rows">
      {(shown) => shown.map((r) => <p key={r}>{r}</p>)}
    </Slides>,
  )
const rows = (n: number) => Array.from({ length: n }, (_, i) => `row ${i + 1}`)

it('counts the pages a card needs', () => {
  expect(pagesOf(0, 5)).toBe(1)
  expect(pagesOf(5, 5)).toBe(1)
  expect(pagesOf(6, 5)).toBe(2)
  expect(pagesOf(10, 1)).toBe(10)
})

it('shows the first page with a dot per page and ‹ 1 of n ›', () => {
  const html = list(rows(12))
  expect(html).toContain('row 5')
  expect(html).not.toContain('row 6')
  expect(html).toContain('1 of 3')
  expect(html.match(/aria-label="Page \d+"/g)).toHaveLength(3)
  expect(html).toContain('aria-label="Next"')
})

it('shows no controls when everything fits, and no dots past twelve pages', () => {
  expect(list(rows(4))).not.toContain('aria-label="Next"')
  const many = list(rows(20), 1)
  expect(many).toContain('1 of 20')
  expect(many).not.toContain('aria-label="Page 1"')
})

it('says what it counts when given a noun', () => {
  const html = renderToString(
    <Slides items={rows(4)} per={1} label="Agent approvals" noun="Approval">
      {(shown) => shown.map((r) => <p key={r}>{r}</p>)}
    </Slides>,
  )
  expect(html).toContain('Approval 1 of 4')
})
