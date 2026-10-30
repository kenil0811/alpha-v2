// What Alpha's model use costs (Vikas, 23 Oct: "monitor module wise and llm wise AI usage"): each
// chat reply's own cost and tokens per model, as the model said them when it answered, and each
// run's tokens, counted at the desk model's list price (prices.yaml) since a run's reads do not
// say their split. Summed by day, model, module and agent; the costliest replies and runs listed.
import { z } from 'zod'
import { config } from '../../config.ts'
import { all } from '../../world/db.ts'
import type { Ctx } from '../ctx.ts'
import type { UsageView } from '../types.ts'

interface Said {
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
  costUSD?: number
}

export function registerUsage(ctx: Ctx): void {
  const { app, world } = ctx

  app.get('/api/usage', async (req): Promise<UsageView> => {
    // `agent`: only that agent's runs, for its page and the Agents list's Cost (one sum, here)
    const { days, agent: only } = z
      .object({
        days: z.coerce.number().int().min(1).max(366).default(30),
        agent: z.string().optional(),
      })
      .parse(req.query)
    const since = new Date(Date.now() - days * 864e5).toISOString()
    const prices = config.prices()
    const desk = config.models().desk
    const moduleName = new Map(world.shape.modules().map((m) => [m.id, m.name]))
    const agentName = new Map(
      all<{ id: string; name: string }>(world.db, 'SELECT id, name FROM agents').map((a) => [
        a.id,
        a.name,
      ]),
    )

    const day = new Map<string, { chat: number; runs: number }>()
    const model = new Map<string, UsageView['models'][number]>()
    const mod = new Map<string, UsageView['modules'][number]>()
    const agent = new Map<string, UsageView['agents'][number]>()
    const costly: UsageView['costly'] = []
    const add = (d: string, part: 'chat' | 'runs', usd: number) => {
      const was = day.get(d) ?? { chat: 0, runs: 0 }
      was[part] += usd
      day.set(d, was)
    }
    const inModule = (id: string | null, usd: number, tokens: number, part: 'turns' | 'runs') => {
      const key = id ?? ''
      const was = mod.get(key) ?? {
        id: id,
        name: id ? (moduleName.get(id) ?? 'A module no longer there') : 'Conversation',
        usd: 0,
        tokens: 0,
        turns: 0,
        runs: 0,
      }
      was.usd += usd
      was.tokens += tokens
      was[part] += 1
      mod.set(key, was)
    }
    const inModel = (name: string, s: Said, usd: number) => {
      const was = model.get(name) ?? {
        model: name,
        usd: 0,
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        estimated: false,
      }
      was.usd += usd
      was.input += s.inputTokens ?? 0
      was.output += s.outputTokens ?? 0
      was.cacheRead += s.cacheReadInputTokens ?? 0
      was.cacheWrite += s.cacheCreationInputTokens ?? 0
      model.set(name, was)
      return was
    }

    // chat replies: their own cost, per model
    for (const l of all<{
      id: number
      at: string
      data: string
      module_id: string | null
      turn_id: string | null
    }>(
      world.db,
      "SELECT id, at, data, module_id, turn_id FROM journal WHERE kind IN ('replied', 'error') AND at >= ? ORDER BY id",
      since,
    )) {
      if (only) break
      const data = JSON.parse(l.data) as { cost?: number; usage?: Record<string, Said> }
      if (typeof data.cost !== 'number') continue
      let tokens = 0
      for (const [name, s] of Object.entries(data.usage ?? {})) {
        inModel(name, s, s.costUSD ?? 0)
        tokens +=
          (s.inputTokens ?? 0) +
          (s.outputTokens ?? 0) +
          (s.cacheReadInputTokens ?? 0) +
          (s.cacheCreationInputTokens ?? 0)
      }
      add(l.at.slice(0, 10), 'chat', data.cost)
      inModule(l.module_id, data.cost, tokens, 'turns')
      const asked = l.turn_id
        ? all<{ words: string }>(
            world.db,
            "SELECT words FROM journal WHERE turn_id = ? AND actor_kind = 'person' ORDER BY id LIMIT 1",
            l.turn_id,
          )[0]?.words
        : null
      costly.push({
        kind: 'reply',
        id: String(l.id),
        at: l.at,
        words: asked ?? 'A reply',
        usd: data.cost,
        tokens,
        module: moduleName.get(l.module_id ?? '') ?? null,
      })
    }

    // runs: their tokens at the desk model's input price, said as estimated
    const rate = prices[desk]?.input ?? 0
    for (const r of all<{
      id: string
      agent_id: string | null
      module_id: string | null
      started_at: string
      words: string | null
      data: string
    }>(
      world.db,
      `SELECT id, agent_id, module_id, started_at, words, data FROM runs WHERE started_at >= ?${only ? ' AND agent_id = ?' : ''}`,
      since,
      ...(only ? [only] : []),
    )) {
      const tokens = (JSON.parse(r.data) as { tokens?: number | null }).tokens ?? 0
      if (!tokens) continue
      const usd = (tokens / 1e6) * rate
      add(r.started_at.slice(0, 10), 'runs', usd)
      inModule(r.module_id, usd, tokens, 'runs')
      const m = inModel(desk, { inputTokens: tokens }, usd)
      m.estimated = true
      const key = r.agent_id ?? ''
      const was = agent.get(key) ?? {
        id: r.agent_id,
        name: agentName.get(key) ?? 'An agent no longer there',
        module: moduleName.get(r.module_id ?? '') ?? null,
        usd: 0,
        tokens: 0,
        runs: 0,
      }
      was.usd += usd
      was.tokens += tokens
      was.runs += 1
      agent.set(key, was)
      costly.push({
        kind: 'run',
        id: r.id,
        at: r.started_at,
        words: `${was.name}: ${r.words ?? 'a run'}`,
        usd,
        tokens,
        module: was.module,
      })
    }

    const days_: UsageView['days'] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)
      days_.push({ day: d, ...(day.get(d) ?? { chat: 0, runs: 0 }) })
    }
    const byUsd = <T extends { usd: number }>(xs: Iterable<T>) =>
      [...xs].sort((a, b) => b.usd - a.usd)
    const models = byUsd(model.values())
    const read = models.reduce((a, m) => a + m.cacheRead, 0)
    const fresh = models.reduce((a, m) => a + m.input + m.cacheWrite, 0)
    return {
      days: days_,
      total: days_.reduce((a, d) => a + d.chat + d.runs, 0),
      models,
      modules: byUsd(mod.values()),
      agents: byUsd(agent.values()),
      costly: byUsd(costly).slice(0, 12),
      cacheShare: read + fresh ? read / (read + fresh) : null,
      prices: Object.entries(prices).map(([m, p]) => ({ model: m, ...p })),
      desk,
    }
  })
}
