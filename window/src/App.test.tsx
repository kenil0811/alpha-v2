import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NO_LAYOUT } from './layout.ts'
import { placeOf } from './place.ts'
import { Rail } from './Shell.tsx'
import { ancestors, flat, inside } from './tree.ts'
import { More } from './ui/more.tsx'
import { MenuItem } from './ui/popover.tsx'
import { Question } from './ui/question.tsx'

describe('delete', () => {
  it('sits behind ⋮, hidden until the row is hovered, and is not on the screen until ⋮ opens', () => {
    const html = renderToString(
      <More label="More">{() => <MenuItem onClick={() => {}}>Delete</MenuItem>}</More>,
    )
    expect(html).toContain('aria-label="More"')
    expect(html).toContain('group-hover/row:opacity-100')
    expect(html).not.toContain('Delete')
    expect(
      renderToString(
        <More label="More" shown>
          {() => null}
        </More>,
      ),
    ).not.toContain('opacity-0')
  })
})

const modules = [
  { id: 'm_1', name: 'Shops', parent: null, people: false, pages: [], tables: [] },
  {
    id: 'm_2',
    name: 'Bakery',
    parent: 'm_1',
    people: false,
    pages: [],
    tables: [{ id: 't_1', name: 'Orders', rows: 1, place: 'main' as const, of: null, tab: false }],
  },
  {
    id: 'm_3',
    name: 'Food',
    parent: null,
    people: false,
    pages: [],
    tables: [{ id: 't_2', name: 'Meals', rows: 1, place: 'main' as const, of: null, tab: false }],
  },
]
const open = NO_LAYOUT

describe('a menu line', () => {
  it('gives the default a filled ★ of its own beside it, so starring never picks the line', () => {
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
    expect(line(false)).toMatch(/<\/button><button/)
  })
})

describe('the window', () => {
  it('reads Intelligence and Settings from the address', () => {
    expect(placeOf('#/settings/permissions')).toEqual({
      at: 'settings',
      section: 'permissions',
      open: null,
    })
    expect(placeOf('#/intelligence')).toEqual({ at: 'intelligence', section: null, open: null })
    expect(placeOf('#/intelligence/connections?connect=gmail')).toEqual({
      at: 'intelligence',
      section: 'connections',
      open: 'gmail',
    })
  })

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
    // each module opens straight where it lands: one with modules inside on its Overview, one with
    // a table on that table (L18)
    expect(html).toContain('href="#/module/m_1/overview"')
    expect(html).toContain('href="#/table/t_1"')
    expect(html).toContain('Fold Shops')
    expect(html).not.toContain('Orders')
    expect(html).not.toContain('Meals')
    expect(html).toContain('>2<')
    expect(html).toContain('Kenil&#x27;s workspace')
    expect(html).toContain('New module')
    // Intelligence and Settings at the foot, each its own place (Kenil's call 1, 7 Nov)
    expect(html).toContain('href="#/intelligence"')
    expect(html).toContain('href="#/settings"')
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
})

describe('a question card', () => {
  it('takes an answer in your own words besides the ones it offers (A9)', () => {
    const html = renderToString(
      <Question
        words="Do you have daily targets?"
        options={["Yes, I'll give them", 'No targets for now']}
        busy={false}
        problem={null}
        onAnswer={() => undefined}
      />,
    )
    expect(html).toContain('No targets for now')
    expect(html).toContain('placeholder="Or answer in your own words"')
  })
})
