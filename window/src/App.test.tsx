import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Rail } from './Shell.tsx'

describe('the window', () => {
  it('lists the modules and their tables in the rail, with what waits and Alpha’s state', () => {
    const html = renderToString(
      <Rail
        modules={[
          { id: 'm_1', name: 'Food', pages: [], tables: [{ id: 't_1', name: 'Meals', rows: 1 }] },
        ]}
        place={{ at: 'home' }}
        name="Kenil"
        waiting={2}
        running={0}
        online
      />,
    )
    expect(html).toContain('Food')
    expect(html).toContain('href="#/table/t_1"')
    expect(html).toContain('Meals')
    expect(html).toContain('>2<')
    expect(html).toContain('Alpha is running')
  })
})
