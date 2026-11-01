// A name changed where it shows (Batch B, picks 7 and 14a): the bar's name is a double-click away
// from a box on a table's screen, and plain words where nothing renames it.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BarName, RENAME_TIP } from './rename.tsx'

describe('the bar’s name', () => {
  it('says a double-click renames it where it can be renamed, and is reached by keyboard', () => {
    const html = renderToString(<BarName name="Purchases" rename={async () => {}} />)
    expect(html).toContain('Purchases')
    expect(html).toContain(`data-tip="${RENAME_TIP}"`)
    expect(html).toContain('<button type="button"')
  })

  it('is only words where nothing renames it', () => {
    const html = renderToString(<BarName name="Settings" rename={null} />)
    expect(html).toContain('Settings')
    expect(html).not.toContain(RENAME_TIP)
    expect(html).not.toContain('<button')
  })
})
