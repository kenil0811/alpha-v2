import type { TaskLineView } from '@alpha/core/api'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { firstWithSome, listTiles, TaskLine } from './Tasks.tsx'
import { AddFilter } from './table/Toolbar.tsx'

const task = (over: Partial<TaskLineView> = {}): TaskLineView => ({
  id: 't1',
  title: 'Call the insurer',
  state: 'todo',
  due: null,
  overdue: false,
  remindAt: null,
  repeat: null,
  priority: 'normal',
  owner: 'You',
  ownerKind: 'person',
  place: { words: 'nowhere yet', path: [], href: null },
  parent: null,
  children: 0,
  childrenDone: 0,
  waitingForYou: false,
  working: false,
  ...over,
})

describe('Tasks (Vikas, 1 Nov)', () => {
  it('a row shows its state and never changes it; Review only where an agent waits', () => {
    const plain = renderToString(<TaskLine t={task({ state: 'doing' })} />)
    expect(plain).not.toMatch(/>(Start|Done)</)
    expect(plain).not.toContain('aria-haspopup')
    expect(renderToString(<TaskLine t={task({ waitingForYou: true })} />)).toContain('Review')
  })

  it('opens on a list that holds tasks, never on approvals', () => {
    expect(firstWithSome({ today: 0, waiting: 4, week: 0 })).toBe('open')
    expect(firstWithSome({ today: 2 })).toBe('today')
  })

  it('the Overview has a tile per list, with no Needs you', () => {
    const tiles = listTiles({ today: 1, week: 2, overdue: 1, agents: 0, open: 5 }, [task()])
    expect(tiles.map((t) => t.label)).toEqual(['Today', 'This week', 'Overdue', 'All open', 'Done'])
    expect(tiles.find((t) => t.key === 'overdue')?.signal).toBe('now')
    expect(tiles[0]?.lines[0]?.words).toBe('Call the insurer')
  })

  it('Filter names the quick filter in use', () => {
    const html = renderToString(
      <AddFilter
        fields={[]}
        config={{ filters: { rules: [] } } as never}
        rows={[]}
        names={{}}
        onConfig={() => undefined}
        quick={[{ label: 'Today', on: true, href: '#/tasks?list=today' }]}
      />,
    )
    expect(html).toContain('Filter: Today')
  })
})
