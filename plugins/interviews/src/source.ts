// The source tool (the onboarding plan, calls 8 and 28; the redesign of 22 Nov, call 15): reads
// one source the person allowed in Set up Alpha's Get to know you and says what was found. Sources
// are switched on there, on one screen, never on a card in a chat; one they switched off is never
// read (rules I3).
import { type PluginHost, Refusal, tool } from '@alpha/plugin-sdk'
import { z } from 'zod'
import { config } from './config.ts'
import { SOURCES, sourceOf } from './sources.ts'
import { ofPerson } from './state.ts'

export const sourceTool = (host: PluginHost) =>
  tool({
    name: 'source',
    description: [
      `Read one source the person allowed in Set up Alpha's Get to know you, and say what was found. Sources: ${SOURCES.map((s) => `${s.key} (${s.name})`).join(', ')}.`,
      'What it found comes back with what you may cite from it: row <id>, file <hash>, line <id>. One they switched off, or have not been asked about there, is not read: send them to Set up Alpha (the workspace tile’s menu).',
    ].join('\n'),
    input: { source: z.enum(SOURCES.map((s) => s.key) as [string, ...string[]]) },
    run: async ({ source }, turn) => {
      const s = sourceOf(source)
      if (!s) throw new Refusal(`There is no source called ${source}.`)
      const row = ofPerson(host, 'Interview sources', turn).find((r) => r.values.Source === s.name)
      if (!row || row.values.State === 'Asked')
        throw new Refusal(
          `${s.name} has not been allowed: sources are switched on in Set up Alpha’s Get to know you, never on a card here. Send them there.`,
        )
      if (row.values.State === 'Skipped') return `They switched off ${s.name}: it is never read.`
      // a reader that reads at the interview, never on a clock, reads now (call 20)
      const why: string[] = []
      if (s.atInterview)
        for (const c of s.connectors) {
          const not = await host.read(c)
          if (not) why.push(not)
        }
      const found = s.read(host, turn.person, config.lookback_days)
      const words = [...why, found.words].join('\n')
      host.own.change('Interview sources', row.id, { Found: words }, 'read on their allow')
      return words
    },
  })
