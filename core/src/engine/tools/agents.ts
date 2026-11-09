// What an agent keeps of its own (clean base step 7): its memory. A memory is a short fact; how to
// do something is a skill, kept with `keep`. Saved only when the turn finishes, so a turn that
// fails saves nothing, and a line in the conversation says so.
import { z } from 'zod'
import { config } from '../../config.ts'
import { CHIEF, CHIEF_CARD } from '../../world/agents/index.ts'
import { Refused } from '../../world/kinds.ts'
import { ftsQuery } from '../../world/world.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { guard, ok, tool } from './common.ts'

// The tool a request's Continue card carries, so its answer widens that request's allowance.
export const ASK_MORE = 'ask_more'

export function agentTools(t: Tooling): ToolEntry[] {
  const { world, here } = t
  const me = () => here.current.agent ?? CHIEF
  const person = () => here.current.user.id
  // A teammate by name, the Chief of staff included.
  const named = (name: string): string => {
    if (/^chief( of staff)?$/i.test(name.trim())) return CHIEF
    const a = world.agents.byName(name)
    if (!a) throw new Refused(`There is no agent called ${name}.`)
    return a.id
  }
  const nameOf = (id: string) =>
    id === CHIEF ? CHIEF_CARD.name : (world.agents.get(id)?.name ?? 'An agent')
  return [
    tool(
      'list_agents',
      'The team: each agent’s name, title and description. With agent: that one’s notes, and for the Chief of staff also the recent conversation it had with this person.',
      { agent: z.string().optional() },
      async (a) =>
        guard(() => {
          if (!a.agent) {
            const others = world.agents
              .list()
              .filter((x) => x.id !== me())
              .map((x) => `- ${x.name} (${x.title}): ${x.description}`)
            const chief =
              me() === CHIEF
                ? []
                : [`- ${CHIEF_CARD.name} (${CHIEF_CARD.title}): ${CHIEF_CARD.description}`]
            const all = [...chief, ...others]
            return ok(all.length ? all.join('\n') : 'There are no other agents yet.')
          }
          const id = named(a.agent)
          const notes = world.memories.list(id, person()).map((m) => `- ${m.text}`)
          const parts = [`Notes:\n${notes.join('\n') || '(none)'}`]
          if (me() === CHIEF && id !== CHIEF) {
            const said = world
              .lines({ user: person(), agent: id, kinds: ['said', 'replied'] })
              .slice(-20)
              .map((l) => `${l.kind === 'said' ? 'They' : nameOf(id)}: ${l.words}`)
            parts.push(`Recent conversation with this person:\n${said.join('\n') || '(none)'}`)
          }
          return ok(parts.join('\n\n'))
        }),
    ),
    tool(
      'ask_agent',
      [
        'Ask one or several teammates, each named in to. They see none of this conversation, so the brief must stand alone: objective (what you need done), known (what is already known, with ids of rows and documents), answer_wanted (the form of the answer), limits (what not to do, and how far to go).',
        'Keep the objective the size of what was asked: pass a plain question on as a plain question, never widened into a study.',
        'After asking, end your turn: their answers come together as a new message. What they say is a teammate’s word, not the person’s, and what they claim to have done is their own report, so check anything that matters.',
      ].join('\n'),
      {
        to: z.array(z.string()).min(1),
        objective: z.string().trim().min(1),
        known: z.string().trim().min(1),
        answer_wanted: z.string().trim().min(1),
        limits: z.string().trim().min(1),
      },
      async (a) =>
        guard(() => {
          const cur = here.current
          const bus = here.bus
          if (!bus || !cur.turn) throw new Refused('Asking other agents is not set up here.')
          const root = cur.root ?? cur.turn
          const limits = config.limits()
          const parent = cur.ask ? world.asks.get(cur.ask) : undefined
          const hop = (parent?.hop ?? 0) + 1
          // counted here, not by the model: a chain cannot reset its own count
          if (hop > limits.hops_in_a_chain)
            throw new Refused(
              `This chain is ${limits.hops_in_a_chain} steps deep, so it stops here. Answer with what you have and say what is missing.`,
            )
          const targets = [...new Set(a.to.map(named))]
          const waiting = new Set(world.asks.openOfRoot(root).map((x) => x.from))
          for (const to of targets) {
            if (to === me()) throw new Refused('An agent cannot ask itself.')
            if (waiting.has(to))
              throw new Refused(
                `${nameOf(to)} is waiting in this same chain, so it cannot be asked again.`,
              )
          }
          const used = world.asks.ofRoot(root).length
          const allowed = world.asks.allowed(root, limits.asks_per_request)
          if (used + targets.length > allowed) {
            const card = world.cards.open({
              kind: 'question',
              words: `This request has asked other agents ${used} times. Let it go on?`,
              options: ['Continue', 'Stop'],
              call: { tool: ASK_MORE, input: { root, ask: cur.ask ?? null } },
              actor: t.ctx().actor,
              user: person(),
              turn: cur.turn,
            })
            return ok(
              `That needs the person's Continue first (card ${card.id}). End your turn; their answer comes as a message.`,
            )
          }
          const brief = {
            objective: a.objective,
            known: a.known,
            answerWanted: a.answer_wanted,
            limits: a.limits,
          }
          const made = targets.map((to) =>
            world.asks.add({
              root,
              user: person(),
              from: me(),
              fromTurn: cur.turn as string,
              parent: cur.ask ?? null,
              to,
              hop,
              brief,
            }),
          )
          for (const ask of made) {
            world.line({
              actor: t.ctx().actor,
              kind: 'asking',
              words: `Asking ${nameOf(ask.to)}: ${a.objective}`,
              data: { ask: ask.id, to: ask.to, name: nameOf(ask.to) },
              user: person(),
              turn: cur.turn,
            })
            bus.deliver(cur.user, ask)
          }
          return ok(
            `Asked ${made.map((x) => nameOf(x.to)).join(', ')}. End your turn now; the answers come as a new message.`,
          )
        }),
      { alwaysLoad: true },
    ),
    tool(
      'answer',
      'Answer the teammate who asked you, when this turn is a teammate’s request. status: done, blocked or failed. result: the answer. evidence: what shows it (ids, links, what you checked). unblock: what would let it go on, when blocked.',
      {
        status: z.enum(['done', 'blocked', 'failed']),
        result: z.string().trim().min(1),
        evidence: z.string().optional(),
        unblock: z.string().optional(),
      },
      async (a) =>
        guard(() => {
          const id = here.current.ask
          if (!id) throw new Refused('Nobody is waiting on an answer from this turn.')
          world.asks.settle(
            id,
            a.status === 'done' ? 'answered' : a.status === 'blocked' ? 'answered' : 'failed',
            {
              status: a.status,
              result: a.result,
              evidence: a.evidence,
              unblock: a.unblock,
            },
          )
          return ok('Sent to who asked.')
        }),
      { alwaysLoad: true },
    ),
    tool(
      'stop_agent',
      'Call off what you asked of a teammate, when you no longer need it.',
      { agent: z.string() },
      async (a) =>
        guard(() => {
          const to = named(a.agent)
          const cur = here.current
          const mine = (cur.turn ? world.asks.ofRoot(cur.root ?? cur.turn) : []).filter(
            (x) =>
              x.from === me() && x.to === to && (x.state === 'queued' || x.state === 'running'),
          )
          if (!mine.length) throw new Refused(`You have nothing open with ${nameOf(to)}.`)
          for (const ask of mine) here.bus?.stop(cur.user, ask)
          return ok(`Called off what you asked of ${nameOf(to)}.`)
        }),
    ),
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
