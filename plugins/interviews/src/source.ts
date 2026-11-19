// The source tool (the onboarding plan, calls 8 and 28): one source put to the person on its own
// card, Allow or Skip, one waiting at a time; once allowed it is read and what was found is said;
// a skipped one is never read.
import { type PluginHost, Refusal, tool } from '@alpha/plugin-sdk'
import { z } from 'zod'
import { config } from './config.ts'
import { SOURCES, sourceOf } from './sources.ts'
import { ofPerson, sync } from './state.ts'

export const sourceTool = (host: PluginHost) =>
  tool({
    name: 'source',
    description: [
      `Put one source to the person on its own card, Allow or Skip, and once they allow it, read it: call again after their answer comes. Sources: ${SOURCES.map((s) => `${s.key} (${s.name})`).join(', ')}.`,
      'What it found comes back with what you may cite from it: row <id>, file <hash>, line <id>. A source they skip is never read.',
    ].join('\n'),
    input: { source: z.enum(SOURCES.map((s) => s.key) as [string, ...string[]]) },
    run: async ({ source }, turn) => {
      sync(host, turn)
      const s = sourceOf(source)
      if (!s) throw new Refusal(`There is no source called ${source}.`)
      const mine = ofPerson(host, 'Interview sources', turn)
      const row = mine.find((r) => r.values.Source === s.name)
      if (!row) {
        const waiting = mine.find((r) => r.values.State === 'Asked')
        if (waiting)
          throw new Refusal(
            `The card about ${waiting.values.Source} waits on their answer: one source at a time.`,
          )
        const card = host.question(turn, {
          words: `${s.name}: ${s.asks}`,
          detail: s.reads,
          options: ['Allow', 'Skip'],
        })
        host.own.add('Interview sources', [
          {
            values: { Source: s.name, Person: turn.name, State: 'Asked', Card: card },
            basis: `put to them on card ${card}`,
          },
        ])
        return `Asked on a card (${card}); their answer comes as a message. Wait for it before the next source.`
      }
      if (row.values.State === 'Asked') return 'Their answer on its card has not come yet.'
      if (row.values.State === 'Skipped') return `They skipped ${s.name}: it is never read.`
      const found = s.read(host, turn.person, config.lookback_days)
      host.own.change('Interview sources', row.id, { Found: found.words }, `read on their Allow`)
      return found.words
    },
  })
