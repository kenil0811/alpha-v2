import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Avatar } from './avatar.tsx'
import { Confirm } from './dialog.tsx'
import { optionClass } from './pill.tsx'
import { Section } from './section.tsx'

describe('the shared parts', () => {
  it('gives each choice its own colour, the same every time (Vikas, 30 Oct)', () => {
    const lists = { choices: ['Clients', 'Insurers', 'Leads', 'My team'], tones: { Lost: 'bad' } }
    const shown = lists.choices.map((c) => optionClass(lists, c))
    expect(new Set(shown).size).toBe(4)
    expect(optionClass(lists, 'Leads')).toBe(shown[2])
    expect(optionClass(lists, 'Lost')).toContain('text-bad')
    expect(optionClass(undefined, 'Brokers')).toBe(optionClass(undefined, 'Brokers'))
  })
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
})
