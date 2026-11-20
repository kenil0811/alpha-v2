// A made-up plugin for the plugin seam's tests: it uses every part of its host.
import { type Plugin, Refusal, tool } from '@alpha/plugin-sdk'
import { z } from 'zod'

export const plugin: Plugin = {
  name: 'test',
  title: 'A test plugin',
  kit: 'kit',
  register(host) {
    host.route('GET', '/hello', async () => ({ hello: host.person().name }))
    host.route('POST', '/note', async ({ body }) => {
      const line = String((body as { line?: unknown }).line ?? '')
      if (!line) throw new Refusal('A line is needed.')
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
    host.route('GET', '/files', async () => ({ names: host.files('folder').map((f) => f.name) }))
    host.route('POST', '/read/:connector', async ({ params }) => ({
      not: await host.read(String(params.connector)),
    }))
    host.route('POST', '/connect', async () => host.connect('browsing'))
    host.route('POST', '/ask', async () => ({
      answer: await host.ask('Answer in the schema.', 'Say yes.', { type: 'object' }),
    }))
    // its agent's own tool: lines it proposes, put to the person for How to work
    host.tools('helper', [
      tool({
        name: 'propose_lines',
        description: 'Put lines to the person for How to work, For you.',
        input: { lines: z.array(z.string()).min(1) },
        run: async ({ lines }, turn) => {
          const rows = host.own.add(
            'Notes',
            lines.map((l) => ({ values: { Line: l, State: 'Proposed' }, basis: 'the test' })),
          )
          const card = host.howToWork(turn, {
            words: 'Keep these in How to work?',
            table: 'Notes',
            rows,
            line: 'Line',
            choice: 'State',
            keep: 'Kept',
            drop: 'Dropped',
            for: 'me',
            heading: 'About you',
          })
          return `Put ${rows.length} line(s) to the person on card ${card}.`
        },
      }),
    ])
    // Start on its screen: a conversation with its agent, for whoever pressed it
    host.route('POST', '/start', async ({ person }) => {
      host.converse(person.id, 'helper', 'Started from the test plugin', 'Look at the notes.')
      return { ok: true }
    })
    host.startBlock(() => {
      const kept = host.own.rows('Notes').filter((r) => r.values.State === 'Kept')
      return kept.length
        ? `## What the test plugin keeps\n${kept.map((r) => `- ${r.values.Line}`).join('\n')}`
        : null
    })
  },
}
