// Who may change an agent (docs/rules.md G1, G2): a shipped agent, a kit's (the made-up kit in
// journeys/fixtures/kits/sourcing) or Alpha's own, tried through every way an agent is changed:
// the Chief of staff or a person, another agent, the agent itself, a schedule kept for it, Undo in
// the window, and its source's update. The ways are listed here; doors.ts lists ways into rows.
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { config } from '../config.ts'
import { makeSchedule } from '../modules/agent-schedules.ts'
import { instructionsOf, keepAgent, keepAgentFile, removeAgent } from '../modules/agents.ts'
import { install, update } from '../modules/kits/index.ts'
import { ScheduleRunner } from '../modules/runs/runner.ts'
import { ALPHA, BUILDER_KEY, keepAlphaAgents } from '../modules/shipped.ts'
import { Refused } from '../world/kinds.ts'
import { rule } from './rule.ts'
import type { RuleWorld } from './world.ts'

const KITS = join(import.meta.dirname, '..', '..', '..', 'journeys', 'fixtures', 'kits')

const person = (w: RuleWorld) => ({
  actor: { kind: 'person' as const, id: w.user.id },
  user: w.user.id,
})

async function sourcing(w: RuleWorld): Promise<string> {
  await install(w.world, join(KITS, 'sourcing'), person(w))
  return w.world.agents.byName('Sourcer')?.id as string
}

// refused in words that name where it comes from
async function refused(go: () => Promise<unknown>, source: RegExp): Promise<boolean> {
  try {
    await go()
    return false
  } catch (err) {
    return err instanceof Refused && source.test(err.message)
  }
}

rule('G1', 'an agent that shipped changes only with its source', {
  cases: {
    'the Chief of staff or a person: its instructions are refused, naming the kit': async (w) => {
      await sourcing(w)
      return refused(
        () => keepAgent(w.world, 'Sourcer', { instructions: 'Look in Ohio.' }, person(w), null),
        /Sourcing/,
      )
    },
    'the agent itself: its instructions and its skills are refused': async (w) => {
      const id = await sourcing(w)
      const skill = '---\nname: x\ndescription: y\n---\nDo it.'
      return (
        (await refused(
          () => keepAgent(w.world, 'Sourcer', { title: 'Something else' }, person(w), id),
          /Sourcing/,
        )) &&
        (await refused(
          () => keepAgentFile(w.world, 'Sourcer', 'skills/x/SKILL.md', skill, person(w), id),
          /Sourcing/,
        ))
      )
    },
    'another agent: refused': async (w) => {
      await sourcing(w)
      await keepAgent(
        w.world,
        'Scout',
        { title: 'Scouts', description: 'Looks around.', instructions: 'Look around.' },
        person(w),
        null,
      )
      const scout = w.world.agents.byName('Scout')?.id as string
      return refused(
        () => keepAgent(w.world, 'Sourcer', { instructions: 'x' }, person(w), scout),
        /Sourcing/,
      )
    },
    'a schedule kept for it: refused': async (w) => {
      const id = await sourcing(w)
      const runner = new ScheduleRunner(w.world, () => ({}) as BrowserEngine)
      return refused(
        () =>
          makeSchedule(
            w.world,
            runner,
            id,
            { name: 'Daily', when: { every: 'day', at: '09:00' }, what: 'Look.' },
            person(w),
          ),
        /Sourcing/,
      )
    },
    'Undo in the window: refused, naming the kit': async (w) => {
      const id = await sourcing(w)
      const r = await w.post(`/api/agents/${id}/undo`, { commit: 'HEAD', path: 'AGENT.md' })
      return r.status === 409 && /Sourcing/.test(String(r.body.problem))
    },
    'its source: the kit’s update changes it': async (w) => {
      const id = await sourcing(w)
      await update(w.world, 'Sourcing', join(KITS, 'sourcing-2'), person(w))
      return /Texas/.test(instructionsOf(w.world, id))
    },
    'Alpha’s own Module builder: refused for everyone but Alpha': async (w) => {
      await keepAlphaAgents(w.world, person(w))
      const builder = w.world.agents.shipped(ALPHA, BUILDER_KEY)
      return (
        !!builder &&
        refused(
          () => keepAgent(w.world, builder.name, { instructions: 'x' }, person(w), null),
          /Alpha/,
        )
      )
    },
  },
})

rule('G2', 'an update keeps what is the firm’s, and a deleted shipped agent stays deleted', {
  cases: {
    'its memories, its own files and the model picked stay through an update': async (w) => {
      const id = await sourcing(w)
      w.world.memories.save({
        agent: id,
        user: null,
        text: 'We never contact firms under 2 million.',
        essential: true,
        origin: 'person',
        saidBy: w.user.id,
        turn: null,
      })
      const model = config.models().agents.at(-1) as string
      await w.post(`/api/agents/${id}/model`, { model })
      await keepAgentFile(w.world, 'Sourcer', 'files/leads.md', '# Leads\n', person(w), id)
      await update(w.world, 'Sourcing', join(KITS, 'sourcing-2'), person(w))
      const files = (await w.get(`/api/agents/${id}`)).body.files as string[]
      return (
        w.world.memories.list(id, w.user.id).some((m) => /2 million/.test(m.text)) &&
        w.world.agents.get(id)?.model === model &&
        files.includes('leads.md')
      )
    },
    'a kit’s agent the firm deleted does not come back with its update': async (w) => {
      const id = await sourcing(w)
      removeAgent(w.world, id, person(w))
      await update(w.world, 'Sourcing', join(KITS, 'sourcing-2'), person(w))
      return !w.world.agents.byName('Sourcer')
    },
    'Alpha’s own agent the firm deleted does not come back at the next start': async (w) => {
      await keepAlphaAgents(w.world, person(w))
      const builder = w.world.agents.shipped(ALPHA, BUILDER_KEY)
      if (!builder) return false
      removeAgent(w.world, builder.id, person(w))
      await keepAlphaAgents(w.world, person(w))
      return !w.world.agents.shipped(ALPHA, BUILDER_KEY)
    },
  },
})
