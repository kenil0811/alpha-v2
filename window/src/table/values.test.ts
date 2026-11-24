// Where a value goes outside Alpha: links and web addresses to the browser, emails and phones.
import type { FieldView } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { hrefOf } from './values.ts'

const f = (kind: string) => ({ kind }) as FieldView

describe('a value’s address', () => {
  it('opens a link, with or without its https', () => {
    expect(hrefOf(f('link'), 'https://a.com/x')).toBe('https://a.com/x')
    expect(hrefOf(f('link'), 'a.com')).toBe('https://a.com')
  })
  it('opens a web address written in a text field, and nothing else there', () => {
    expect(hrefOf(f('text'), 'http://b.org')).toBe('http://b.org')
    expect(hrefOf(f('text'), 'b.org')).toBeNull()
  })
  it('writes to an email and calls a phone', () => {
    expect(hrefOf(f('email'), 'ann@a.com')).toBe('mailto:ann@a.com')
    expect(hrefOf(f('phone'), '+1 (314) 555-0100')).toBe('tel:+13145550100')
  })
  it('goes nowhere when empty', () => {
    expect(hrefOf(f('link'), '  ')).toBeNull()
    expect(hrefOf(f('link'), null)).toBeNull()
  })
})
