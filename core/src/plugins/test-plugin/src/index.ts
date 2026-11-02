// A made-up plugin for the plugin seam's tests (onboarding 4a): it uses every part of its host.
import type { Plugin } from '@alpha/plugin-sdk'

export const plugin: Plugin = {
  name: 'test',
  title: 'A test plugin',
  kit: 'kit',
  register(host) {
    host.route('GET', '/hello', async () => ({ hello: host.person().name }))
    host.route('POST', '/note', async ({ body }) => {
      const line = String((body as { line?: unknown }).line ?? '')
      if (!line) throw new Error('a line is needed')
      const [id] = host.own.add('Notes', [
        { values: { Line: line, State: 'Proposed' }, basis: 'the test' },
      ])
      host.journal('Proposed 1 note.', { notes: 1 })
      return { id }
    })
    host.route('POST', '/keep/:id', async ({ params }) => {
      host.own.set('Notes', params.id ?? '', { State: 'Kept' })
      return { notes: host.own.rows('Notes').map((r) => r.values) }
    })
    host.route('GET', '/mail', async () => ({ rows: host.rows('Mail', 'Mail').length }))
    host.route('POST', '/ask', async () => ({
      answer: await host.ask('Answer in the schema.', 'Say yes.', { type: 'object' }),
    }))
    host.startBlock(() => {
      const kept = host.own.rows('Notes').filter((r) => r.values.State === 'Kept')
      return kept.length
        ? `## What the test plugin keeps\n${kept.map((r) => `- ${r.values.Line}`).join('\n')}`
        : null
    })
  },
}
