import { describe, expect, it } from 'vitest'
import { toBlocks, toMarkdown } from './Blocks.tsx'

describe('a row’s document as blocks', () => {
  it('reads Markdown a line a block and writes it back the same', () => {
    const md = [
      '# Why we like it',
      '',
      'Owner retiring; [Ann](person:p1) knows the broker.',
      '',
      '- [ ] Ask for the CIM',
      '- [x] Read the teaser',
      '- Staff of 4',
      '',
      '1. Call',
      '2. LOI',
      '',
      '> Seller wants to stay a year',
      '',
      '---',
    ].join('\n')
    const blocks = toBlocks(md)
    expect(blocks.map((b) => b.kind)).toEqual([
      'h1',
      'p',
      'todo',
      'done',
      'bullet',
      'number',
      'number',
      'quote',
      'hr',
    ])
    expect(toMarkdown(blocks)).toBe(md.replace('- Staff of 4\n\n1. Call', '- Staff of 4\n1. Call'))
  })

  it('starts empty with one block', () => {
    expect(toBlocks('')).toHaveLength(1)
    expect(toMarkdown(toBlocks(''))).toBe('')
  })
})
