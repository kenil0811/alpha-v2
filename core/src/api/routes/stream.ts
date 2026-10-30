import { z } from 'zod'
import { config } from '../../config.ts'
import { agents } from '../../modules/agents.ts'
import {
  alphaModule,
  askLine,
  INTERVIEWER,
  loadPool,
  markSkipped,
  pending,
  rankedToday,
  readReply,
  refresh,
  worthAsking,
} from '../../modules/interview.ts'
import { foldTold, TOLD_AGAIN } from '../../modules/runs/told.ts'
import { all } from '../../world/db.ts'
import type { Line } from '../../world/journal.ts'
import { Refused } from '../../world/kinds.ts'
import type { Ctx } from '../ctx.ts'
import type { CardAbout, InterviewView, Stream, StreamLine } from '../types.ts'

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
  TOLD_AGAIN,
  'reminder',
]

export function registerStream(ctx: Ctx): void {
  const { app, world, engine, user, options } = ctx
  const { cardOut, moduleOf, aboutRows, shown } = ctx.views

  // Whose thread a line is in (Vikas, 30 Oct: each agent its own thread): the agent of the run
  // that wrote it, an agent's line by its name in its module, or the agent the person spoke to.
  const agentOfLines = (lines: Line[]) => {
    const list = agents(world)
    // the Interviewer's thread: its questions and closings (turns "iv…"), what the person said in
    // it (or, before it had a thread, in answer to it), and Alpha's replies to that
    const said = (l: Line) =>
      l.kind === 'said' &&
      (l.data.agent === INTERVIEWER.id || !!l.data.answers || !!l.data.ends || !!l.data.skips)
    const iv = new Set(lines.filter(said).map((l) => String(l.id)))
    const runs = [...new Set(lines.map((l) => l.run).filter((r): r is string => !!r))]
    const byRun = new Map(
      runs.length
        ? all<{ id: string; agent_id: string | null }>(
            world.db,
            `SELECT id, agent_id FROM runs WHERE id IN (${runs.map(() => '?').join(', ')})`,
            ...runs,
          ).map((r) => [r.id, r.agent_id])
        : [],
    )
    return (l: Line): StreamLine['agent'] => {
      if (said(l) || (l.turn && (l.turn.startsWith('iv') || iv.has(l.turn)))) return INTERVIEWER
      const a =
        (l.run && list.find((x) => x.id === byRun.get(l.run as string))) ||
        (l.kind === 'said' && list.find((x) => x.id === l.data.agent)) ||
        (l.actor.kind === 'agent' &&
          list.find((x) => x.name === l.actor.id && x.module === l.module)) ||
        null
      return a ? { id: a.id, name: a.name } : null
    }
  }

  app.get('/api/stream', async (req): Promise<Stream> => {
    const q = z
      .object({
        after: z.coerce.number().optional(),
        before: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      })
      .parse(req.query)
    // an agent's unchanged repeats fold into its one post, at the time last said (Vikas, 30 Oct)
    const raw = foldTold(
      world.lines({
        user: user.id,
        kinds: STREAM_KINDS,
        ...(q.after !== undefined ? { after: q.after } : {}),
        ...(q.before !== undefined ? { before: q.before } : {}),
        limit: q.limit ?? 400,
      }),
    )
    const agentOf = agentOfLines(raw)
    const lines = raw.map(
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
            ? { about: aboutRows(l.data.about), agent: l.data.agent ?? null }
            : shown(l.kind, l.data),
        agent: agentOf(l),
        run: l.run,
      }),
    )
    return {
      lines,
      cards: world.cards.waiting(user.id).map(cardOut),
      busy: engine.busy(user),
      running: (engine.hands?.runner.runs(50) ?? [])
        .filter((r) => r.state === 'running')
        .map((r) => ({
          id: r.id,
          name: (r.agent && agents(world).find((a) => a.id === r.agent)?.name) || 'A try',
          module: r.module,
        })),
      attention: world.connections
        .list()
        .filter((k) => k.state === 'needs_sign_in')
        .map((k) => ({
          connector: k.connector,
          title: engine.connectors?.find(k.connector)?.manifest.title ?? k.connector,
          connection: k.id,
          inBrowser: engine.connectors?.find(k.connector)?.manifest.auth === 'browser',
        })),
      tasks: world.tasks.counts(),
      reading: engine.connectors?.reading() ?? [],
      settingUp: options.kits?.now ?? null,
      lastId: world.lastLineId(),
    }
  })

  // Said to Alpha, from a module, or to one agent in its thread: the line keeps the agent, and
  // the model reads it as "@<agent>", as the composer's @ has always said it.
  app.post('/api/say', async (req) => {
    const { words, from, agent } = z
      .object({
        words: z.string().trim().min(1),
        from: z.string().optional(),
        agent: z.string().optional(),
      })
      .parse(req.body)
    const toInterviewer = agent === INTERVIEWER.id
    const to = agent && !toInterviewer ? agents(world).find((a) => a.id === agent) : undefined
    if (agent && !toInterviewer && !to) throw new Refused('That agent is not there any more.')
    const m = world.shape.module(to?.module ?? from ?? '')
    // the person's words after an interview question: they are done, they pass on it, or it is
    // their answer, kept against it (so no later pool asks it until it is stale); a brief answer
    // ends the sitting once kept, any other has Alpha decide whether one more is worth asking
    const p = toInterviewer ? pending(world, user.id) : null
    const reply = p ? readReply(words) : null
    if (p && (reply === 'done' || reply === 'skip')) {
      const line = world.line({
        actor: { kind: 'person', id: user.id },
        kind: 'said',
        words,
        data: { agent: INTERVIEWER.id, [reply === 'done' ? 'ends' : 'skips']: p.key },
        user: user.id,
        module: m?.id ?? null,
      })
      if (reply === 'skip') {
        markSkipped(world, p.key)
        askNext(p.module, false)
      } else close(p.module, 'Thank you. That is enough for today; what you said is kept.')
      engine.events.emit('event', { type: 'lines', user: user.id })
      return { turn: String(line.id) }
    }
    const where = p && (world.shape.module(p.module ?? '')?.name ?? m?.name)
    return {
      turn: engine.say(
        user,
        words,
        m ? { id: m.id, name: m.name } : null,
        to ? { id: to.id, name: to.name } : null,
        p
          ? {
              data: { agent: INTERVIEWER.id, answers: p.key },
              note: config
                .interviewAnswer()
                .replaceAll('{ask}', p.ask)
                .replaceAll('{where}', where ?? 'the module it concerns'),
              after: () =>
                reply === 'brief'
                  ? close(p.module, 'Kept. I will leave the rest for another day.')
                  : askNext(p.module, false),
            }
          : toInterviewer
            ? { data: { agent: INTERVIEWER.id } }
            : {},
      ),
    }
  })

  // Interview me (Vikas, 30 Oct): Alpha asks from its pool, the most useful first, for as long as
  // the next question is worth asking; never a fixed count. The pool is re-ranked each morning
  // (Morning runs the Interviewer skill); when it was not today, it is re-ranked first.
  let preparing = false
  const close = (module: string | null, words: string): void => {
    world.line({
      actor: { kind: 'alpha' },
      kind: 'replied',
      words,
      user: user.id,
      module,
      turn: `iv${Date.now()}`,
    })
  }
  const askNext = (module: string | null, first: boolean): void => {
    const q = worthAsking(world, module)[0]
    if (q) askLine(world, user.id, module, q, first)
    else
      close(
        module,
        first
          ? 'Nothing is worth asking today. Tomorrow Alpha looks again at what is unresolved.'
          : 'That is all worth asking today. Thank you; what you said is kept, and the next questions start from it.',
      )
  }
  const prepare = (): void => {
    const runner = engine.hands?.runner
    if (preparing || !runner) return
    preparing = true
    void refresh(world, runner.interviewAsk, alphaModule(world))
      .catch(() => undefined)
      .finally(() => {
        preparing = false
        engine.events.emit('event', { type: 'lines', user: user.id })
      })
  }

  app.get('/api/interview', async (req): Promise<InterviewView> => {
    const { module } = z.object({ module: z.string().optional() }).parse(req.query)
    const pool = loadPool(world)
    const left = worthAsking(world, module ?? null)
    return {
      at: pool.at,
      today: rankedToday(pool),
      preparing,
      questions: left.length,
      left: left.length,
      first: left[0]?.ask ?? null,
    }
  })

  // Start: Alpha asks the most useful question in the conversation; with the pool not ranked
  // today, it is ranked first and the window says it is preparing.
  app.post('/api/interview', async (req) => {
    const { module } = z.object({ module: z.string().optional() }).parse(req.body ?? {})
    if (!rankedToday(loadPool(world))) {
      if (!engine.hands?.runner) throw new Refused('Interview me is not set up in this core.')
      prepare()
      return { preparing: true }
    }
    askNext(module ?? null, true)
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { preparing: false }
  })

  // Stop while preparing: the window stops waiting and the thread says so; no question follows.
  // ponytail: the pool's ranking is one model call with no abort; it finishes in the background
  // (it is the day's pool, Morning's anyway). Thread a signal through Ask if it ever runs long.
  app.post('/api/interview/stop', async (req) => {
    const { module } = z.object({ module: z.string().optional() }).parse(req.body ?? {})
    close(module ?? null, 'Stopped.')
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  // One card in full for the side panel: where it came from, the runs it rests on (its own run,
  // or its agent's latest when it names no run) and its lines in the journal.
  app.get('/api/cards/:id/about', async (req): Promise<CardAbout> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const c = world.cards.get(id)
    if (!c) throw new Refused('That card is not there any more.')
    const card = cardOut(c)
    const runs = all<{ id: string; state: string; words: string | null; started_at: string }>(
      world.db,
      c.run
        ? 'SELECT id, state, words, started_at FROM runs WHERE id = ?'
        : 'SELECT id, state, words, started_at FROM runs WHERE agent_id = ? ORDER BY started_at DESC LIMIT 5',
      c.run ?? card.agent?.id ?? '',
    ).map((r) => ({ id: r.id, state: r.state, words: r.words, startedAt: r.started_at }))
    const history = all<{ id: number; at: string; words: string }>(
      world.db,
      'SELECT id, at, words FROM journal WHERE card_id = ? ORDER BY id',
      id,
    )
    return { card, agent: card.agent ?? null, runs, history }
  })

  app.post('/api/stop', async () => {
    await engine.stop(user)
    return { ok: true }
  })
}
