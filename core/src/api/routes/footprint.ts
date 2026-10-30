// Onboarding from the footprint (30 Oct): the Interviewer's first sitting. Count, tick, read what
// was ticked, paste back what an AI remembered, draft the business for the owner's yes, then the
// questions that are left. Governance's ledger reads the same view and forgets a source.
import { z } from 'zod'
import { config } from '../../config.ts'
import {
  count,
  draft,
  draftCard,
  envHere,
  finish,
  forget,
  load,
  read,
  remember,
  setSite,
  sources,
  tick,
} from '../../modules/footprint.ts'
import { PlainPlatform } from '../../platform/index.ts'
import { Refused } from '../../world/kinds.ts'
import type { Ctx } from '../ctx.ts'
import type { FootprintView } from '../types.ts'

export function registerFootprint(ctx: Ctx): void {
  const { app, world, engine, user, asPerson } = ctx
  const env =
    ctx.options.footprintEnv ?? (() => envHere(ctx.options.platform ?? new PlainPlatform()))
  const view = (): FootprintView => {
    const s = load(world)
    return {
      sources: sources(world),
      countedAt: s.countedAt,
      site: s.site,
      denied: s.denied,
      memoryPrompt: config.footprint().memory_prompt.trim(),
      memory: s.ledger.memory ?? null,
      card: draftCard(world),
      done: s.done,
    }
  }
  const changed = () => engine.events.emit('event', { type: 'lines', user: user.id })

  app.get('/api/footprint', async (): Promise<FootprintView> => view())

  // Update now: count again; numbers only are kept
  app.post('/api/footprint/count', async (): Promise<FootprintView> => {
    count(world, env())
    return view()
  })

  app.post('/api/footprint/tick', async (req): Promise<FootprintView> => {
    const { source, on } = z.object({ source: z.string(), on: z.boolean() }).parse(req.body)
    tick(world, source, on, asPerson)
    return view()
  })

  app.post('/api/footprint/site', async (req): Promise<FootprintView> => {
    const { site } = z.object({ site: z.string().trim() }).parse(req.body)
    setSite(world, site)
    return view()
  })

  app.post('/api/footprint/read', async (): Promise<FootprintView> => {
    await read(world, env(), asPerson)
    changed()
    return view()
  })

  app.post('/api/footprint/memory', async (req): Promise<FootprintView> => {
    const { words } = z.object({ words: z.string().trim().min(1) }).parse(req.body)
    remember(world, words, asPerson)
    changed()
    return view()
  })

  app.post('/api/footprint/draft', async (): Promise<FootprintView> => {
    const runner = engine.hands?.runner
    if (!runner) throw new Refused('Drafting is not set up in this core.')
    await draft(world, runner.footprintAsk, asPerson)
    changed()
    return view()
  })

  app.post('/api/footprint/forget', async (req): Promise<FootprintView> => {
    const { source } = z.object({ source: z.string() }).parse(req.body)
    forget(world, source, asPerson)
    changed()
    return view()
  })

  app.post('/api/footprint/done', async (): Promise<FootprintView> => {
    finish(world)
    return view()
  })
}
