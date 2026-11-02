// The look is the tokens' (app.css): no screen names a colour of its own or invents a text size.
// Tailwind's palette is switched off, so a raw colour would draw nothing; an arbitrary size or
// colour would still draw, which is why this fails both.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { IconButton } from './ui/button.tsx'
import { NEVER_SAY } from './vocabulary.ts'

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
  // one layering scale (Batch A, pick 8): past a box's own order (z-0 to z-3), a layer is named
  [
    'a numbered layer: name it (z-(--z-raised), --z-panel, --z-overlay, --z-pop, --z-tip)',
    /(?<![\w-])-?z-(?:[4-9]|\d{2,}|\[[^\]]*\])(?![\w-])/g,
  ],
]

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return files(p)
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : []
  })
}

// The window's own screens and every plugin's (onboarding in Alpha, 2 Nov): one look for all.
const PLUGINS = join(SRC, '..', '..', 'plugins')
function sources(dir: string): string[] {
  const screens = existsSync(PLUGINS)
    ? readdirSync(PLUGINS)
        .map((p) => join(PLUGINS, p, 'window'))
        .filter((w) => existsSync(w))
        .flatMap(files)
    : []
  return [...files(dir), ...screens]
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

  // Serif only for the hero heading, a page's or a record's title, a section's title and big
  // numbers (Vikas, 25 Oct; section titles Kenil, 26 Oct): on an h1, an h2 at xl, at 2xl, on
  // tabular figures, or a reply's own top heading.
  it('keeps serif to titles and big numbers', () => {
    const MARK = { 'Conversation.tsx': 'Alpha’s mark, one serif letter' }
    const found: string[] = []
    for (const file of sources(SRC)) {
      const at = relative(SRC, file)
      if (at in MARK) continue
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (!/font-serif/.test(line) || /^\s*\/\//.test(line)) return
          const ok =
            /<h1\b/.test(line) ||
            (/<h2\b/.test(line) && /\btext-xl\b/.test(line)) ||
            /\btext-2xl\b/.test(line) ||
            /\btabular-nums\b/.test(line) ||
            line.match(/\S*font-serif/g)?.every((t) => t.includes('[&_h1]:'))
          if (!ok) found.push(`${at}:${i + 1}`)
        })
    }
    expect(found).toEqual([])
  })

  it('says only the agreed words', () => {
    const found: string[] = []
    for (const file of sources(SRC)) {
      if (!file.endsWith('.tsx')) continue // words a person reads are in the screens
      const text = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
      // what a person can read: quoted words and the text between tags, never an import or an address
      const said = [
        ...text.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g),
        ...text.matchAll(/>([^<>{}=]*[A-Za-z][^<>{}=]*)</g),
      ]
      for (const m of said) {
        // what a template works out (${…}) is code; only its words around it are said
        const words = (m[2] ?? m[1] ?? '').replace(/\$\{[^}]*\}/g, ' ').trim()
        if (!words || /^(?:\.{0,2}\/|#\/|@|[\w-]+\.(?:tsx?|css)$)/.test(words)) continue
        if (/^[a-z][\w-]*$/.test(words)) continue // a key or an id, one word in code's case
        for (const [word, instead] of NEVER_SAY)
          if (word.test(words)) {
            const line = text.slice(0, m.index).split('\n').length
            found.push(`${relative(SRC, file)}:${line}: “${words.slice(0, 60)}” (say ${instead})`)
          }
      }
    }
    expect(found).toEqual([])
  })

  // an icon says nothing on its own: its label is what a screen reader and the tooltip say
  it('names every icon button', () => {
    const found: string[] = []
    for (const file of sources(SRC)) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/<IconButton\b((?:[^>{]|\{[^}]*\})*)>/g))
        if (!/\slabel=(?:\{(?!\s*['"`]{2}\s*\})|"[^"\s])/.test(m[1] ?? ''))
          found.push(`${relative(SRC, file)}:${text.slice(0, m.index).split('\n').length}`)
    }
    expect(found).toEqual([])
  })
})

// The rules in docs/ui-rules.md that code can check, by their numbers there. A skipped one waits
// on its fix: turn it on in the same change.
const read = (file: string) => readFileSync(join(SRC, file), 'utf8')
const lines = (re: RegExp, keep: (file: string) => boolean = () => true) =>
  sources(SRC)
    .filter(keep)
    .flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          !/^\s*\/\//.test(line) && re.test(line) ? [`${relative(SRC, file)}:${i + 1}`] : [],
        ),
    )

describe('the window’s rules (docs/ui-rules.md)', () => {
  it('R4: never the browser’s confirm, alert or prompt', () => {
    expect(lines(/(?<![\w.])(?:window\.)?(?:confirm|alert|prompt)\(/)).toEqual([])
  })

  it('A4: an icon button is labelled, read aloud and shown on hover in our one tooltip', () => {
    const html = renderToString(createElement(IconButton, { label: 'Close' }))
    expect(html).toContain('aria-label="Close"')
    expect(html).toContain('data-tip="Close"')
    expect(html).not.toContain('title=')
  })

  it('T7: the overflow glyph is the vertical ⋮', () => {
    expect(lines(/\b(?:MoreHorizontal|Ellipsis)\b/)).toEqual([])
  })

  it('T11: no bare <select> but the cell editor', () => {
    // the cell editor, out of Grid.tsx since Batch B, keeps the native one
    expect(lines(/<select\b/)).toEqual([])
  })

  it('W4: labels are in sentence case', () => {
    // a capital after the first word is a name (Alpha, Second Brain…) or starts an example after a comma
    const NAMES = /^(?:Alpha|Mac|Second|Brain|Monday|Georgia|CSV|Excel|PDF)\b/
    const found: string[] = []
    for (const file of sources(SRC)) {
      if (!file.endsWith('.tsx')) continue
      for (const m of readFileSync(file, 'utf8').matchAll(
        /\b(?:label|aria-label|title|placeholder)=(['"])([^'"]+)\1/g,
      )) {
        const words = (m[2] ?? '').split(' ')
        words.slice(1).forEach((w, i) => {
          if (!/^[A-Z][a-z]/.test(w) || NAMES.test(w) || w.includes('/')) return
          if (/[,:]$/.test(words[i] ?? '')) return
          found.push(`${relative(SRC, file)}: “${m[2]}”`)
        })
      }
    }
    expect(found).toEqual([])
  })

  it.skip('S8: heights in dvh, never vh', () => {
    expect(lines(/\d+vh\b|(?<![\w-])(?:min-|max-)?h-screen\b/)).toEqual([])
  })

  it('H3: no Find box in the header; ⌘K still finds', () => {
    expect(read('Shell.tsx')).not.toContain('aria-label="Find anything"')
  })

  it('A1: the assistant’s header has no Expand and no Open whole conversation', () => {
    expect(read('Assistant.tsx')).not.toMatch(/Expand to half|Open the whole conversation/)
  })

  it('T2: no cards of counts on a table', () => {
    expect(existsSync(join(SRC, 'table', 'Metrics.tsx'))).toBe(false)
  })
})
