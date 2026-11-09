import { z } from 'zod'
import { schedules } from '../../modules/schedules.ts'
import { CHIEF } from '../../world/agents/index.ts'
import { Refused } from '../../world/kinds.ts'
import type { Ctx } from '../ctx.ts'
import type { Stream, StreamLine } from '../types.ts'

// What the stream shows: the person's sentences, Alpha's replies, the steps and what they made.
const STREAM_KINDS = [
  'said',
  'replied',
  'error',
  'limit',
  'noticed',
  'card_opened',
  'card_closed',
  'card_used',
  'call',
  'called',
  'made',
  'shaped',
  'wrote',
  'changed',
  'removed',
  'refused',
  'rule_saved',
  'rule_noticed',
  'filed',
  'remembered',
  'kept',
  'told',
  'reminder',
  'noted',
  'asking',
  'asked',
  'answered',
  'agent_made',
  'agent_changed',
]

export function registerStream(ctx: Ctx): void {
  const { app, world, engine, user, options } = ctx
  const { cardOut, moduleOf, aboutRows, shown } = ctx.views

  app.get('/api/stream', async (req): Promise<Stream> => {
    const q = z
      .object({
        after: z.coerce.number().optional(),
        before: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
        agent: z.string().optional(),
      })
      .parse(req.query)
    const agent = q.agent ?? CHIEF
    const lines = world
      .lines({
        user: user.id,
        agent: agent === CHIEF ? null : agent,
        kinds: STREAM_KINDS,
        ...(q.after !== undefined ? { after: q.after } : {}),
        ...(q.before !== undefined ? { before: q.before } : {}),
        limit: q.limit ?? 400,
      })
      .map(
        (l): StreamLine => ({
          id: l.id,
          at: l.at,
          actor: l.actor.kind,
          kind: l.kind,
          words: l.words,
          turn: l.turn,
          card: l.card,
          module: moduleOf(l.module),
          data:
            l.kind === 'told'
              ? { about: aboutRows(l.data.about), schedule: l.data.schedule ?? null }
              : shown(l.kind, l.data),
        }),
      )
    return {
      lines,
      cards: world.cards.waiting(user.id).map(cardOut),
      asked: world.cards
        .waiting(user.id)
        .filter((c) => c.turn?.startsWith('a') && world.asks.get(c.turn.slice(1))?.from === agent)
        .map((c) => c.id),
      busy: engine.busy(user, agent),
      running: (engine.hands?.runner.runs(50) ?? [])
        .filter((r) => r.state === 'running')
        .map((r) => ({
          id: r.id,
          name: (r.schedule && schedules(world).find((a) => a.id === r.schedule)?.name) || 'A try',
          module: r.module,
        })),
      attention: world.connections
        .list()
        .filter((k) => k.state === 'needs_sign_in' || k.state === 'waiting')
        .map((k) => ({
          connector: k.connector,
          title: engine.connectors?.find(k.connector)?.manifest.title ?? k.connector,
          connection: k.id,
          inBrowser: engine.connectors?.find(k.connector)?.manifest.auth === 'browser',
          signsInWith: (() => {
            const o = engine.connectors?.find(k.connector)?.manifest.oauth
            const s = engine.connectors?.signIn
            return o && s ? s.provider(o.provider).title : null
          })(),
          waiting: k.state === 'waiting' ? k.health : null,
        })),
      tasks: world.tasks.counts(),
      reading: engine.connectors?.reading() ?? [],
      settingUp: options.kits?.now ?? null,
      lastId: world.lastLineId(),
    }
  })

  app.post('/api/say', async (req) => {
    const { words, from, agent, named } = z
      .object({
        words: z.string().trim().min(1),
        from: z.string().optional(),
        agent: z.string().optional(),
        named: z.array(z.string()).max(32).default([]),
      })
      .parse(req.body)
    const m = from ? world.shape.module(from) : undefined
    if (agent && agent !== CHIEF && !world.agents.get(agent))
      throw new Refused('That agent is not there.')
    return {
      turn: engine.say(
        user,
        words,
        m ? { id: m.id, name: m.name } : null,
        agent ?? CHIEF,
        named.filter((n) => n === CHIEF || !!world.agents.get(n)),
      ),
    }
  })

  app.post('/api/stop', async (req) => {
    const { agent } = z.object({ agent: z.string().optional() }).parse(req.body ?? {})
    await engine.stop(user, agent ?? CHIEF)
    return { ok: true }
  })
}
