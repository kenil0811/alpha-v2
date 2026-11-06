import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Avatar } from './avatar.tsx'
import { Confirm } from './dialog.tsx'
import { once } from './groups.tsx'
import { Pager } from './pager.tsx'
import { Section } from './section.tsx'

describe('the shared parts', () => {
  it('puts a section’s explanation behind an ⓘ, never as a line under its title', () => {
    const html = renderToString(
      <Section title="Connections" about="Your accounts, read by Alpha.">
        <div />
      </Section>,
    )
    expect(html).toContain('aria-label="More about this"')
    expect(html).not.toContain('Your accounts, read by Alpha.')
  })

  it('asks before a delete in the one pop-up, Cancel first and the button naming what happens', () => {
    const html = renderToString(
      <Confirm open title="Delete this row?" yes="Delete it" onYes={() => {}} onClose={() => {}}>
        It can’t be brought back.
      </Confirm>,
    )
    expect(html).toContain('<dialog')
    expect(html.indexOf('Cancel')).toBeLessThan(html.indexOf('Delete it'))
    expect(html).toContain('It can’t be brought back.')
  })

  it('shows a person round and an organization square, with their initials', () => {
    expect(renderToString(<Avatar name="Ada Lovelace" />)).toMatch(/rounded-full.*>AL</)
    expect(renderToString(<Avatar name="Dawn Lumber" organization />)).toMatch(/rounded-md.*>DL</)
  })

  it('pages by number up to seven, then says “3 of 12”, and shows nothing for one page', () => {
    const few = renderToString(<Pager at={1} count={3} onAt={() => {}} />)
    expect(few).toMatch(/aria-current="page"[^>]*>2</)
    expect(renderToString(<Pager at={2} count={12} onAt={() => {}} />)).toContain(
      '3<!-- --> of <!-- -->12',
    )
    expect(renderToString(<Pager at={0} count={1} onAt={() => {}} />)).toBe('')
  })

  it('says a repeated sentence once, with how many times', () => {
    const said = once(['a', 'b', 'a', 'a'], (w) => w)
    expect(said).toEqual([
      { item: 'a', times: 3 },
      { item: 'b', times: 1 },
    ])
  })
})
