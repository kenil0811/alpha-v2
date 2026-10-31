import { expect, test } from 'vitest'
import { pageName } from './link-status.tsx'

test('a link inside Alpha is named by its page', () => {
  expect(pageName('#/settings/usage')).toBe('Settings › Usage')
  expect(pageName('#/people')).toBe('People')
  expect(pageName('#/')).toBe('Home')
  expect(pageName('#/row/t1/r42', 'Open Acme Corp')).toBe('Row: Acme Corp')
  expect(pageName('#/table/tbl_9x2')).toBe('Table')
})
