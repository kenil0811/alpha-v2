import type { TaskLineView } from '@alpha/core/api'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NO_LAYOUT } from './layout.ts'
import { askFor, NewModule, underWay } from './NewModule.tsx'
import { forward, placeOf } from './place.ts'
import { Rail } from './Shell.tsx'
import { ancestors, flat, inside } from './tree.ts'
import { More } from './ui/more.tsx'
import { MenuItem } from './ui/popover.tsx'
import { Question } from './ui/question.tsx'
import { NO_WORKSPACE, WorkspaceContext, type WorkspaceHere } from './Workspace.tsx'

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
  {
    id: 'm_1',
    name: 'Shops',
    parent: null,
    number: null,
    people: false,
    hidden: false,
    pages: [],
    tables: [],
  },
  {
    id: 'm_2',
    name: 'Bakery',
    parent: 'm_1',
    number: null,
    people: false,
    hidden: false,
    pages: [],
    tables: [
      {
        id: 't_1',
        name: 'Orders',
        rows: 1,
        place: 'main' as const,
        of: null,
        tab: false,
        number: null,
        view: 'table' as const,
      },
    ],
  },
  {
    id: 'm_3',
    name: 'Food',
    parent: null,
    number: null,
    people: false,
    hidden: false,
    pages: [],
    tables: [
      {
        id: 't_2',
        name: 'Meals',
        rows: 1,
        place: 'main' as const,
        of: null,
        tab: false,
        number: null,
        view: 'table' as const,
      },
    ],
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
    expect(placeOf('#/intelligence')).toEqual({ at: 'settings', section: null, open: null })
    expect(forward('#/intelligence/files?module=m1')).toBe('#/settings/files?module=m1')
    expect(placeOf('#/intelligence/connections?connect=gmail')).toEqual({
      at: 'settings',
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
    // Settings at the foot, Intelligence gone
    expect(html).not.toContain('Intelligence')
    expect(html).toContain('href="#/settings"')
    expect(html).not.toContain('Alpha is running')
    expect(html).toContain('href="#/conversation"') // the conversation keeps its own screen
  })

  it('names the workspace once for the Alpha, and counts on its tile what is new in Activity', () => {
    const rail = (here: Partial<WorkspaceHere>) =>
      renderToString(
        <WorkspaceContext.Provider value={{ ...NO_WORKSPACE, ...here }}>
          <Rail
            modules={modules}
            place={{ at: 'home' }}
            here={null}
            name="Kenil"
            waiting={0}
            onNew={() => undefined}
            tasksDue={0}
            layout={open}
            onLayout={() => undefined}
          />
        </WorkspaceContext.Provider>,
      )
    expect(rail({ news: 7 })).toContain('aria-label="Kenil&#x27;s workspace, 7 new in Activity"')
    const named = rail({ workspace: { name: 'Bakery HQ', picture: null } })
    expect(named).toContain('aria-label="Bakery HQ"')
    expect(named).not.toContain('Kenil&#x27;s workspace')
  })

  it('lights New module in the rail on its page, and the page asks what it should do', () => {
    const html = renderToString(
      <Rail
        modules={modules}
        place={{ at: 'new', setup: false, task: null }}
        here={null}
        name="Kenil"
        waiting={0}
        onNew={() => undefined}
        tasksDue={0}
        layout={open}
        onLayout={() => undefined}
      />,
    )
    expect(html).toContain('aria-current="page"') // no other row is current on #/new
    expect(placeOf('#/new/setup')).toEqual({ at: 'new', setup: true, task: null })
    // the build it started is in the address, so leaving and coming back finds it
    expect(placeOf('#/new')).toEqual({ at: 'new', setup: false, task: null })
    expect(placeOf('#/new/k_5ptz')).toEqual({ at: 'new', setup: false, task: 'k_5ptz' })
    // the files brought in go to the builder by their ids, not only their names
    expect(
      askFor('A deal tracker', [
        { name: 'invoice.pdf', hash: 'ab12' },
        { name: 'invoice.pdf', hash: 'cd34' },
      ]),
    ).toBe(
      'A deal tracker\n\nFiles I brought in (open each by its id): invoice.pdf, id ab12; invoice.pdf, id cd34',
    )
    // the builds still under way, each one click from its work
    const line = (id: string, title: string, state: TaskLineView['state']) =>
      ({ id, title, state, ownerKind: 'alpha' }) as TaskLineView
    expect(
      underWay([
        line('k_1', 'Build a module: A deal tracker', 'doing'),
        line('k_2', 'Call Priya', 'todo'),
        line('k_3', 'Build a module: Payroll', 'done'),
        line('k_4', 'Build a module: Bakery orders', 'waiting'),
      ]),
    ).toEqual([
      { id: 'k_1', what: 'A deal tracker', state: 'doing' },
      { id: 'k_4', what: 'Bakery orders', state: 'waiting' },
    ])
    const page = renderToString(
      <NewModule setup={false} task={null} version={0} onBuild={async () => ''} />,
    )
    expect(page).toContain('What are you planning to build today?')
    expect(page).toContain('Send')
    expect(page).toContain('Import')
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
        layout={{ ...open, railFolded: true }}
        onLayout={() => undefined}
      />,
    )
    expect(strip).toContain('Show the sidebar')
    expect(strip).toContain('aria-label="Shops"')
    expect(strip).not.toContain('aria-label="Bakery"')
  })

  it('sits what the person pinned as tiles above Home, Home, Agents and Tasks included, out of the list below', () => {
    const html = renderToString(
      <Rail
        modules={modules}
        place={{ at: 'home' }}
        here={null}
        name="Kenil"
        waiting={0}
        onNew={() => undefined}
        tasksDue={0}
        layout={{ ...open, pinned: ['tasks', 'm_1', 'm_gone'] }}
        onLayout={() => undefined}
      />,
    )
    const at = (s: string) => html.indexOf(s)
    // tiles in the order pinned, then Home; a pin of something not there does no harm
    expect(at('aria-label="Tasks"')).toBeGreaterThan(-1)
    expect(at('aria-label="Tasks"')).toBeLessThan(at('aria-label="Shops"'))
    expect(at('aria-label="Shops"')).toBeLessThan(at('>Home<'))
    // and they leave the list: no Tasks or Shops row
    expect(html).not.toContain('>Tasks<')
    expect(html).not.toContain('>Shops<')
    expect(html).toContain('>Food<')
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
