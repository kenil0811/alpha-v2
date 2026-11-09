// The firm's agents as the window reads them (clean base step 7). Making and changing one happens
// in a conversation with the Chief of staff; here a person reads one, edits its memories, undoes a
// change to its instructions, and deletes it.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { skillsOf } from '../../engine/context.ts'
import { instructionsOf, removeAgent, undoAgentChange } from '../../modules/agents.ts'
import { CHIEF, CHIEF_CARD } from '../../world/agents/index.ts'
import { Refused } from '../../world/kinds.ts'
import type { Ctx } from '../ctx.ts'
import type { AgentDetail, AgentView, MemoryView } from '../types.ts'

export function registerAgents(ctx: Ctx): void {
  const { app, world, engine, user } = ctx
  const person = () => ({ actor: { kind: 'person' as const, id: user.id }, user: user.id })
  const live = () => engine.events.emit('event', { type: 'lines', user: user.id })

  const chief = (): AgentView => ({ ...CHIEF_CARD, model: null, chief: true })
  const known = (id: string) => {
    if (id !== CHIEF && !world.agents.get(id)) throw new Refused('That agent is not there.')
  }
  const memoriesOf = (id: string): MemoryView[] =>
    world.memories.list(id, user.id).map((m) => ({
      id: m.id,
      text: m.text,
      essential: m.essential,
      yours: m.origin === 'person',
      firm: m.user === null,
      at: m.updatedAt,
    }))

  app.get(
    '/api/agents',
    async (): Promise<AgentView[]> => [
      chief(),
      ...world.agents.list().map((a) => ({
        id: a.id,
        name: a.name,
        title: a.title,
        description: a.description,
        model: a.model,
        chief: false,
      })),
    ],
  )

  app.get('/api/agents/:id', async (req): Promise<AgentDetail> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    known(id)
    if (id === CHIEF)
      return { ...chief(), instructions: '', skills: [], files: [], memories: memoriesOf(id) }
    const a = world.agents.get(id)
    if (!a) throw new Refused('That agent is not there.')
    const dir = world.agents.dirOf(id)
    const filesDir = join(dir, 'files')
    return {
      id,
      name: a.name,
      title: a.title,
      description: a.description,
      model: a.model,
      chief: false,
      instructions: instructionsOf(world, id),
      skills: skillsOf(dir),
      files: existsSync(filesDir) ? readdirSync(filesDir) : [],
      memories: memoriesOf(id),
    }
  })

  // A memory a person writes is theirs: the agent reads it and cannot change it.
  app.post('/api/agents/:id/memories', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    known(id)
    const b = z
      .object({
        text: z.string().trim().min(1),
        essential: z.boolean().default(false),
        firm: z.boolean().default(false),
      })
      .parse(req.body)
    const m = world.memories.save({
      agent: id,
      user: b.firm ? null : user.id,
      text: b.text,
      essential: b.essential,
      origin: 'person',
      saidBy: user.id,
      turn: null,
    })
    live()
    return { id: m.id }
  })

  app.post('/api/memories/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const b = z
      .object({ text: z.string().trim().min(1).optional(), essential: z.boolean().optional() })
      .parse(req.body)
    world.memories.edit(id, {
      ...(b.text !== undefined ? { text: b.text } : {}),
      ...(b.essential !== undefined ? { essential: b.essential } : {}),
    })
    live()
    return { ok: true }
  })

  app.post('/api/memories/:id/remove', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    world.memories.forget(id, 'person')
    live()
    return { ok: true }
  })

  app.post('/api/agents/:id/undo', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { commit, path } = z.object({ commit: z.string(), path: z.string() }).parse(req.body)
    const words = await undoAgentChange(world, id, commit, path, person())
    live()
    return { words }
  })

  app.post('/api/agents/:id/remove', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    removeAgent(world, id, person())
    engine.closeAgent(id)
    live()
    return { ok: true }
  })
}
