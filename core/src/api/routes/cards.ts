import { chromePath } from '@alpha/connector-sdk'
import { z } from 'zod'
import {
  applyShape,
  describeShape,
  MAINTAINED_SHAPE,
  type ShapeAction,
} from '../../engine/tools/index.ts'
import { agents } from '../../modules/agents.ts'
import { DRAFT } from '../../modules/drafts.ts'
import { keep } from '../../modules/keep.ts'
import { installedKits, recordChange } from '../../modules/kits/index.ts'
import { RUN_AGAIN } from '../../modules/runs/index.ts'
import { Refused } from '../../world/kinds.ts'
import { type Redo, redo } from '../../world/shape/index.ts'
import type { Ctx } from '../ctx.ts'
import type { CardView } from '../types.ts'

export function registerCards(ctx: Ctx): void {
  const { app, world, engine, user, person, live, asPerson } = ctx
  const { cardOut } = ctx.views

  // A card on its own page (Batch B, pick 13): the card the stream shows, answered there by the
  // routes below; one not there, or another person's, is not there.
  app.get('/api/cards/:id', async (req, reply): Promise<CardView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const c = world.cards.get(id)
    if (!c || (c.user && c.user !== user.id))
      return reply.code(404).send({ problem: 'That card is not there.' })
    return cardOut(c)
  })

  // An agent's rows on a card: the person's choice on some, or on every one not yet decided.
  app.post('/api/cards/:id/rows', async (req): Promise<CardView | null> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { rows, value } = z
      .object({ rows: z.union([z.array(z.string()).min(1), z.literal('rest')]), value: z.string() })
      .parse(req.body)
    const reviews = engine.hands?.runner?.reviews
    if (!reviews) throw new Refused('Agents are not set up in this core.')
    reviews.choose(id, rows, value, asPerson)
    live()
    const c = world.cards.get(id)
    return c ? cardOut(c) : null
  })
  // An agent's draft: sent as it is or as the person changed it (with Always when offered), or
  // held with a reason.
  app.post('/api/cards/:id/send', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const body = z
      .object({
        message: z
          .object({
            to: z.string(),
            cc: z.string().optional(),
            subject: z.string(),
            body: z.string(),
          })
          .nullable()
          .optional(),
        always: z.boolean().optional(),
      })
      .parse(req.body ?? {})
    const drafts = engine.hands?.drafts
    if (!drafts) throw new Refused('Drafts are not set up in this core.')
    const m = body.message
    const message = m
      ? { to: m.to, subject: m.subject, body: m.body, ...(m.cc ? { cc: m.cc } : {}) }
      : null
    const out = await drafts.send(id, message, user, body.always ?? false)
    live()
    return cardOut(out)
  })
  app.post('/api/cards/:id/hold', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { reason, words } = z
      .object({ reason: z.string(), words: z.string().max(400).default('') })
      .parse(req.body ?? {})
    const drafts = engine.hands?.drafts
    if (!drafts) throw new Refused('Drafts are not set up in this core.')
    const out = drafts.hold(id, reason, words, user)
    live()
    return cardOut(out)
  })
  // A file from the mail: filed on the row the person settled on, as its kind (Replace takes the
  // row's other file of that kind off), or declined with their reason.
  app.post('/api/cards/:id/file', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const body = z
      .object({
        row: z.string().nullable(),
        kind: z.string().nullable(),
        replace: z.boolean().optional(),
        always: z.boolean().optional(),
      })
      .parse(req.body)
    const intake = engine.hands?.intake
    if (!intake) throw new Refused('Files from the mail are not on here.')
    const out = intake.file(id, body, user)
    live()
    return cardOut(out)
  })
  app.post('/api/cards/:id/decline', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { reason } = z.object({ reason: z.string().max(400).default('') }).parse(req.body ?? {})
    const intake = engine.hands?.intake
    if (!intake) throw new Refused('Files from the mail are not on here.')
    const out = intake.decline(id, reason.trim(), user)
    live()
    return cardOut(out)
  })

  app.post('/api/cards/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { answer } = z.object({ answer: z.string().min(1) }).parse(req.body)
    try {
      const c = world.cards.get(id)
      if (c?.call?.tool === DRAFT) return cardOut(await engine.answerDraft(user, id, answer))
      // an agent that did not finish three times: one more run now, or left as if it had run
      if (c?.call?.tool === RUN_AGAIN && engine.hands?.runner) {
        const runner = engine.hands.runner
        const input = c.call.input as { agent: string; cursor: string | null }
        if (answer === c.options[0])
          void runner.retry(input.agent, { user: user.id, turn: null }).catch(() => undefined)
        else runner.leave(input.agent, input.cursor)
        const out = world.cards.answer(id, answer, person)
        live()
        return cardOut(out)
      }
      // a maintained kit's shape change (decision 3b): asked of the maintainer as a drafted
      // email, or done now and counted as a change of the person's they have not seen. Asked by
      // any door since rules step 2 (M4), as the change to make again; by Alpha's tool before it
      if (c?.call?.tool === MAINTAINED_SHAPE && c.module) {
        const input = (c.call.input ?? {}) as Record<string, unknown>
        const r = 'method' in input ? (input as unknown as Redo) : null
        const a = input as unknown as ShapeAction
        const kit = installedKits(world).find((k) => k.module === c.module)
        const m = world.shape.module(c.module)
        if (!kit?.maintainer || !m) throw new Refused('That kit is not maintained any more.')
        const change = r ? r.words : describeShape(a)
        const words = `${change[0]?.toUpperCase() ?? ''}${change.slice(1)}`
        if (answer === c.options[1]) {
          const anyway = { actor: person, user: user.id, anyway: true }
          const said = !r
            ? applyShape(world, a, anyway)
            : r.method === 'keep'
              ? await keep(world, m, r.args[1], r.args[2], anyway)
              : redo(world.shape, r, anyway)
          recordChange(world, m.id, words, a, user.id)
          const out = world.cards.answer(id, answer, person, `Done now: ${said}`)
          live()
          return cardOut(out)
        }
        const drafts = engine.hands?.drafts
        if (drafts)
          await drafts.propose(
            {
              agent: 'Alpha',
              module: m.id,
              kind: 'request to the maintainer',
              key: null,
              connector: null,
              message: {
                to: kit.maintainer.address,
                subject: `A change to ${kit.kit} asked from Alpha`,
                body: `${words}.\n\nAsked in ${m.name} (${kit.kit} ${kit.version}) on ${new Date().toDateString()}.`,
              },
              about: null,
              note: `For ${kit.maintainer.name} to put in the kit's next version.`,
            },
            null,
          )
        else
          world.line({
            actor: person,
            kind: 'noted',
            words: `To ask ${kit.maintainer.name} (${kit.maintainer.address}): ${words}.`,
            user: user.id,
            module: m.id,
          })
        const out = world.cards.answer(
          id,
          answer,
          person,
          `Asked ${kit.maintainer.name}: ${words}.`,
        )
        live()
        return cardOut(out)
      }
      return cardOut(engine.answer(user, id, answer))
    } catch (err) {
      if (err instanceof Refused) return reply.code(409).send({ problem: err.message })
      throw err
    }
  })

  app.post('/api/cards/:id/merge-same', async (req): Promise<CardView | null> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    world.people.mergeSamePlace(id, asPerson)
    live()
    const c = world.cards.get(id)
    return c ? cardOut(c) : null
  })

  // A site's sign-in: it opens in the person's own Google Chrome on this Mac, they sign in there
  // themselves, and when they quit that Chrome the card is answered and the agent that met the
  // sign-in runs again.
  app.post('/api/cards/:id/sign-in', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const card = world.cards.get(id)
    const input = (card?.call?.input ?? {}) as { url?: string; agent?: string | null }
    if (card?.state !== 'waiting' || card.call?.tool !== 'site_sign_in' || !input.url)
      throw new Refused('That sign-in is not waiting.')
    const hands = engine.hands
    if (!hands) throw new Refused('Alpha has no browser here.')
    if (!chromePath()) throw new Refused('Signing in to a site needs Google Chrome on this Mac.')
    const url = input.url
    void (async () => {
      await hands.browser().signIn(url)
      world.cards.answer(id, 'Sign in', { kind: 'person', id: user.id })
      const agent = agents(world).find((a) => a.id === input.agent)
      if (agent) await hands.runner.runAgent(agent, { user: user.id, turn: null })
      engine.events.emit('event', { type: 'lines', user: user.id })
    })().catch(() => undefined)
    return { opened: true }
  })
}
