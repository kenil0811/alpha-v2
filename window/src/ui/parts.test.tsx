import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Avatar } from './avatar.tsx'
import { CodeLine } from './code-line.tsx'
import { Confirm } from './dialog.tsx'
import { Section } from './section.tsx'
import { isYesNo, YesNo } from './yes-no.tsx'

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
      <Confirm
        open
        title="Delete this row?"
        done={{ words: 'Done.' }}
        yes="Delete it"
        onYes={() => {}}
        onClose={() => {}}
      >
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

  it('answers yes or no with a tick and a cross, each named in the tip and acting on a click', () => {
    const html = renderToString(
      <YesNo value={null} yes="Merge" no="Keep apart" onChange={() => {}} />,
    )
    expect(html).toContain('data-tip="Merge"')
    expect(html).toContain('aria-label="Keep apart"')
    expect(html).toMatch(/lucide-check/)
    expect(html).toMatch(/lucide-x/)
    const said: string[] = []
    const out = YesNo({ value: 'yes', onChange: (a) => said.push(a) }) as ReactElement<{
      children: ReactElement<{ onClick: () => void; 'aria-pressed': boolean }>[]
    }>
    const [yes, no] = out.props.children
    yes?.props.onClick()
    no?.props.onClick()
    expect(said).toEqual(['yes', 'no'])
    expect(yes?.props['aria-pressed']).toBe(true)
    expect(isYesNo(['Yes', 'No'])).toBe(true)
    expect(isYesNo(['Yes, that’s it', 'Yes, and also', 'Not this'])).toBe(false)
  })

  it('puts what to paste in a monospace line with its copy button, copying those words', () => {
    const html = renderToString(<CodeLine text="claude setup-token" />)
    expect(html).toContain('font-mono')
    expect(html).toContain('claude setup-token')
    expect(html).toContain('aria-label="Copy"')
    const out = CodeLine({ text: 'claude setup-token' }) as ReactElement<{
      children: ReactElement<{ text?: () => string }>[]
    }>
    expect(out.props.children[1]?.props.text?.()).toBe('claude setup-token')
  })
})
