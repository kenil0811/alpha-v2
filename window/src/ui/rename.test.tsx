// A page's title changed where it shows: a double-click edits it, and it is plain words where
// nothing renames it.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PageTitle, RENAME_TIP } from './rename.tsx'

describe('a page’s title', () => {
  it('says a double-click renames it where it can be renamed, and is reached by keyboard', () => {
    const html = renderToString(<PageTitle name="Purchases" rename={async () => {}} />)
    expect(html).toContain('Purchases')
    expect(html).toContain(`data-tip="${RENAME_TIP}"`)
    expect(html).toContain('<button type="button"')
  })

  it('is only words where nothing renames it', () => {
    const html = renderToString(<PageTitle name="Settings" rename={null} />)
    expect(html).toContain('Settings')
    expect(html).not.toContain(RENAME_TIP)
    expect(html).not.toContain('<button')
  })
})
