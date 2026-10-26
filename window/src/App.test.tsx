import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NO_LAYOUT } from './layout.ts'
import { Rail } from './Shell.tsx'
import { ancestors, flat, inside } from './tree.ts'
import { MenuItem } from './ui/popover.tsx'

const modules = [
  { id: 'm_1', name: 'Shops', parent: null, people: false, pages: [], tables: [] },
  {
    id: 'm_2',
    name: 'Bakery',
    parent: 'm_1',
    people: false,
    pages: [],
    tables: [{ id: 't_1', name: 'Orders', rows: 1 }],
  },
  {
    id: 'm_3',
    name: 'Food',
    parent: null,
    people: false,
    pages: [],
    tables: [{ id: 't_2', name: 'Meals', rows: 1 }],
  },
]
const open = NO_LAYOUT

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
    expect(html).toContain('href="#/conversation"') // the conversation keeps its own screen
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

  it('gives a menu line a ★ of its own beside it, filled on the default, so starring never picks it', () => {
    const line = (on: boolean) =>
      renderToString(
        <MenuItem onClick={() => undefined} star={{ on, onClick: () => undefined }}>
          Won
        </MenuItem>,
      )
    expect(line(true)).toContain('aria-pressed="true"')
    expect(line(true)).toContain('fill-current')
    expect(line(false)).toContain('aria-label="Make it the default"')
    expect(line(false)).not.toContain('fill-current')
    // two buttons side by side, not one inside the other
    expect(line(false).match(/<button/g)).toHaveLength(2)
    expect(line(false)).toMatch(/<\/button><button/)
  })
})
