import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildWords, NewModule } from './NewModule.tsx'
import { Rail } from './Shell.tsx'
import { ancestors, flat, inside } from './tree.ts'

const modules = [
  { id: 'm_1', name: 'Shops', parent: null, pages: [], tables: [] },
  {
    id: 'm_2',
    name: 'Bakery',
    parent: 'm_1',
    pages: [],
    tables: [{ id: 't_1', name: 'Orders', rows: 1 }],
  },
  {
    id: 'm_3',
    name: 'Food',
    parent: null,
    pages: [],
    tables: [{ id: 't_2', name: 'Meals', rows: 1 }],
  },
]
const open = { railFolded: false, folded: [], panel: null }

describe('the window', () => {
  it('lists the modules by name in the rail, inside one another, with what waits, the workspace and New module last', () => {
    const html = renderToString(
      <Rail
        modules={modules}
        place={{ at: 'home' }}
        here={null}
        name="Kenil"
        waiting={2}
        onNew={() => undefined}
        tasksDue={0}
        online
        layout={open}
        onLayout={() => undefined}
      />,
    )
    expect(html).toContain('href="#/module/m_1"')
    expect(html).toContain('href="#/module/m_2"')
    expect(html).toContain('Fold Shops')
    expect(html).not.toContain('Orders')
    expect(html).not.toContain('Meals')
    expect(html).toContain('>2<')
    expect(html).toContain('Kenil&#x27;s workspace')
    expect(html).toContain('New module')
    expect(html).toContain('href="#/intelligence"')
    expect(html).not.toContain('Alpha is running')
    expect(html).not.toContain('href="#/conversation"')
  })

  it('folds a module’s modules away, and the rail to a strip of icons', () => {
    const folded = renderToString(
      <Rail
        modules={modules}
        place={{ at: 'home' }}
        here={null}
        name="Kenil"
        waiting={0}
        onNew={() => undefined}
        tasksDue={0}
        online
        layout={{ ...open, folded: ['m_1'] }}
        onLayout={() => undefined}
      />,
    )
    expect(folded).toContain('Unfold Shops')
    expect(folded).not.toContain('href="#/module/m_2"')
    const strip = renderToString(
      <Rail
        modules={modules}
        place={{ at: 'home' }}
        here="m_2"
        name="Kenil"
        waiting={0}
        onNew={() => undefined}
        tasksDue={0}
        online
        layout={{ ...open, railFolded: true }}
        onLayout={() => undefined}
      />,
    )
    expect(strip).toContain('Open the rail')
    expect(strip).toContain('aria-label="Shops"')
    expect(strip).not.toContain('aria-label="Bakery"')
  })

  it('reads the tree from each module’s parent', () => {
    expect(flat(modules).map((x) => [x.module.name, x.depth])).toEqual([
      ['Shops', 0],
      ['Bakery', 1],
      ['Food', 0],
    ])
    expect(inside(modules, 'm_1')).toEqual(['m_1', 'm_2'])
    expect(ancestors(modules, 'm_2').map((m) => m.name)).toEqual(['Shops'])
  })

  it('opens New module blank: a name, what to keep, Build it waiting on the words, an empty table', () => {
    const html = renderToString(<NewModule modules={modules} onAsked={() => undefined} />)
    expect(html).toContain('placeholder="What should it keep track of?"')
    expect(html).toMatch(/<button type="submit"[^>]*disabled=""[^>]*>Build it/)
    expect(html).toContain('Cancel')
    expect(html.match(/<td/g)).toHaveLength(3)
    expect(buildWords(' Orders ', 'what each shop orders')).toBe(
      'Make a module called Orders: what each shop orders',
    )
    expect(buildWords('', 'invoices')).toBe('Make a module: invoices')
  })
})
