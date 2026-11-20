// The source tool (the onboarding plan, calls 8 and 28): one source put to the person on its own
// card, Allow or Skip, one waiting at a time; once allowed it is read and what was found is said;
// a skipped one is never read.
import { type PluginHost, Refusal, tool } from '@alpha/plugin-sdk'
import { z } from 'zod'
import { config } from './config.ts'
import { connected, SOURCES, sourceOf } from './sources.ts'
import { ofPerson, sync } from './state.ts'

const NOT_CONNECTED =
  'Nothing that fills it is connected yet: Allow takes you to Connections to connect it, then come back and press Carry on.'

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
        // what was found is said before the next card (call 8)
        const unread = mine.find((r) => r.values.State === 'Allowed' && !r.values.Found)
        if (unread)
          throw new Refusal(
            `They allowed ${unread.values.Source}: read it and say what you found before the next source.`,
          )
        // nothing connected that fills it: Allow also opens Connections to connect it (calls 11, 12)
        const ready = connected(host, s)
        const card = host.question(turn, {
          words: `${s.name}: ${s.asks}`,
          help: ready ? s.reads : `${s.reads} ${NOT_CONNECTED}`,
          options: ['Allow', 'Skip'],
          ...(ready ? {} : { connect: '' }),
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
      // a reader that reads at the interview, never on a clock, reads now (call 20)
      const why: string[] = []
      if (s.atInterview)
        for (const c of s.connectors) {
          const not = await host.read(c)
          if (not) why.push(not)
        }
      const found = s.read(host, turn.person, config.lookback_days)
      const words = [...why, found.words].join('\n')
      host.own.change('Interview sources', row.id, { Found: words }, `read on their Allow`)
      return words
    },
  })
