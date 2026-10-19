import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Rail } from './App.tsx'

describe('the window', () => {
  it('lists the modules and their tables in the rail', () => {
    const html = renderToString(
      <Rail
        modules={[{ id: 'm_1', name: 'Food', tables: [{ id: 't_1', name: 'Meals', rows: 1 }] }]}
        place={{ at: 'home' }}
        name="Kenil"
      />,
    )
    expect(html).toContain('Food')
    expect(html).toContain('href="#/table/t_1"')
    expect(html).toContain('Meals')
  })
})
