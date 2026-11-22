// A short interview (the onboarding plan, calls 35 and 36; the redesign of 22 Nov, call 21): when
// the Interviewer's regular check woke it with what changed, it opens the person's What I learned
// again in Set up Alpha with that, and the few new questions are drafted from it. The person sees
// one row on Home; nothing waits in Needs you and no chat starts.
import { type PluginHost, tool } from '@alpha/plugin-sdk'
import { z } from 'zod'
import { think } from './draft.ts'
import { keepStory } from './know.ts'

export const shortTool = (host: PluginHost) =>
  tool({
    name: 'short_interview',
    description:
      'After your regular check woke you: open a short interview for the person in Set up Alpha’s What I learned, with what changed in a few plain lines, naming only what the check found. The new questions are drafted from it; ask nothing in a chat.',
    input: { changed: z.string().trim().min(1).max(2000) },
    run: async ({ changed }, turn) => {
      const who = { id: turn.person, name: turn.name, owner: turn.owner }
      keepStory(host, who.id, { since: changed, rounds: 0, problem: null })
      host.reopen(who.id, 'learned')
      void think(host, who)
      host.journal('Opened a short interview in Set up Alpha.', { person: who.id })
      return 'Their interview is open again in Set up Alpha’s What I learned, and its questions are being drafted. Mark your task done.'
    },
  })
