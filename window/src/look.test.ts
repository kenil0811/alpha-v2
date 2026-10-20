// The look is the tokens' (app.css): no screen names a colour of its own or invents a text size.
// Tailwind's palette is switched off, so a raw colour would draw nothing; an arbitrary size or
// colour would still draw, which is why this fails both.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = import.meta.dirname

const PALETTE =
  'neutral|gray|slate|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black'
const UTILITY =
  'bg|text|border|ring|ring-offset|divide|decoration|fill|stroke|outline|placeholder|from|via|to|shadow|accent|caret'
const RULES: [string, RegExp][] = [
  [
    'a colour of Tailwind’s own palette',
    new RegExp(`(?<![\\w-])(?:${UTILITY})-(?:${PALETTE})(?:-\\d{2,3})?(?:/\\d+)?(?![\\w-])`, 'g'),
  ],
  ['an invented text size or spacing of type', /(?<![\w-])(?:text|leading|tracking)-\[[^\]]*\]/g],
  // the seven sizes are xs, sm, md, base, lg, xl and 2xl; any other draws no size at all
  ['a text size that is not one of the seven', /(?<![\w-])text-(?:[3-9]xl|xxs)(?![\w-])/g],
  ['an invented colour', /(?<![\w-])(?:bg|border|ring|fill|stroke|decoration|outline)-\[[^\]]*\]/g],
  ['a colour written out', /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g],
]

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return sources(p)
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : []
  })
}

describe('the window’s look', () => {
  it('uses only the tokens’ colours and sizes', () => {
    const found: string[] = []
    for (const file of sources(SRC)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/^\s*\/\//.test(line)) return
          for (const [what, re] of RULES)
            for (const m of line.matchAll(re))
              found.push(`${relative(SRC, file)}:${i + 1}: ${m[0]} (${what})`)
        })
    }
    expect(found).toEqual([])
  })
})
