// What an agent keeps of its own (clean base step 7): its memory. A memory is a short fact; how to
// do something is a skill, kept with `keep`. Saved only when the turn finishes, so a turn that
// fails saves nothing, and a line in the conversation says so.
import { z } from 'zod'
import { config } from '../../config.ts'
import { CHIEF } from '../../world/agents/index.ts'
import { Refused } from '../../world/kinds.ts'
import { ftsQuery } from '../../world/world.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { guard, ok, tool } from './common.ts'

export function agentTools(t: Tooling): ToolEntry[] {
  const { world, here } = t
  const me = () => here.current.agent ?? CHIEF
  const person = () => here.current.user.id
  return [
    tool(
      'memory',
      [
        'What you remember across conversations. save: one short fact that will still be true next time, written as a plain fact, never an order, and only from something actually said or seen; no guessed traits, no one-off requests, no progress on the task at hand. How to do a kind of task is a skill (keep), not a memory.',
        'essential: true for the few facts every conversation needs; the rest are found with search. for: me (this person, the default) or firm (everyone here, only when the person says so or it is plainly about the firm).',
        'forget: by id, one you wrote; what a person wrote stays. search: words to look for.',
      ].join('\n'),
      {
        action: z.enum(['save', 'forget', 'search']),
        text: z.string().optional(),
        essential: z.boolean().optional(),
        for: z.enum(['me', 'firm']).optional(),
        id: z.string().optional(),
        query: z.string().optional(),
      },
      async (a) =>
        guard(() => {
          if (a.action === 'search') {
            const found = world.memories.search(
              me(),
              person(),
              ftsQuery(a.query ?? a.text ?? ''),
              config.limits().search_hits,
            )
            return ok(
              found.length
                ? found.map((m) => `${m.id}: ${m.text}`).join('\n')
                : 'Nothing remembered about that.',
            )
          }
          const ctx = t.ctx()
          if (a.action === 'forget') {
            const was = a.id ? world.memories.get(a.id) : undefined
            if (!was || was.agent !== me()) throw new Refused('That memory is not yours.')
            if (was.origin === 'person')
              throw new Refused('A person wrote that memory, so it stays until they change it.')
            here.afterTurn.push(() => {
              world.memories.forget(was.id, 'agent')
              world.line({
                actor: ctx.actor,
                kind: 'noted',
                words: `Forgot: ${was.text}`,
                data: { memory: was.id },
                user: ctx.user,
                turn: ctx.turn,
              })
            })
            return ok('It will be forgotten when this turn finishes.')
          }
          const text = world.memories.check(a.text ?? '')
          const user = a.for === 'firm' ? null : person()
          const turn = ctx.turn
          here.afterTurn.push(() => {
            const m = world.memories.save({
              agent: me(),
              user,
              text,
              essential: !!a.essential,
              origin: 'agent',
              saidBy: person(),
              turn,
            })
            world.line({
              actor: ctx.actor,
              kind: 'noted',
              words: `Noted: ${text}`,
              data: { memory: m.id, for: user ? 'me' : 'firm' },
              user: ctx.user,
              turn,
            })
          })
          return ok('Noted, when this turn finishes.')
        }),
      { alwaysLoad: true },
    ),
  ]
}
