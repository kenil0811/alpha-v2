// Alpha's plugins: packages in plugins/, each loaded at start only where alpha.yaml's plugins line
// names it (rules P1), and given a host (plugin-sdk) that is all it may do in Alpha: read rows, call
// a connector's tool, ask the model once, keep rows in its own module, answer its own routes, add a
// block to the start of a conversation, write a journal line, give tools to an agent its kit
// carries, start a conversation with that agent, and put lines for How to work to the person
// (rules P2). The core names no plugin; with none, Alpha runs as it did. A plugin that does not load
// is said and left out, as a connector is.
import { mkdirSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readAgents } from '@alpha/kit-sdk'
import {
  checkPlugin,
  type Input,
  type Plugin,
  type PluginHost,
  type PluginTool,
  Refusal,
  type Row,
} from '@alpha/plugin-sdk'
import { entryOf } from '../connectors/discover.ts'
import type { ConnectorService } from '../connectors/service.ts'
import type { Engine } from '../engine/engine.ts'
import type { ToolEntry } from '../engine/registry.ts'
import { guardAsync, type Here, ok } from '../engine/tools/common.ts'
import { keepKit } from '../modules/defaults.ts'
import { readKit } from '../modules/kits/index.ts'
import { Reviews } from '../modules/reviews.ts'
import { run } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { Table, WriteCtx } from '../world/shape/index.ts'
import { businessCase } from '../world/shape/manifest.ts'
import type { Use } from '../world/spend.ts'
import type { User, World } from '../world/world.ts'

export const PLUGINS_DIR = join(import.meta.dirname, '..', '..', '..', 'plugins')

export interface Loaded {
  plugin: Plugin
  dir: string
}

// Every plugin in a folder, checked; the folders that did not load, with why.
export async function loadPlugins(
  dir: string,
): Promise<{ plugins: Loaded[]; failed: { folder: string; why: string }[] }> {
  const plugins: Loaded[] = []
  const failed: { folder: string; why: string }[] = []
  let names: string[] = []
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  } catch {
    return { plugins, failed }
  }
  for (const name of names) {
    const folder = join(dir, name)
    try {
      const mod = (await import(pathToFileURL(entryOf(folder)).href)) as { plugin?: unknown }
      const problems = checkPlugin(
        mod.plugin,
        plugins.map((p) => p.plugin.name),
      )
      if (problems.length) throw new Error(problems.join(' '))
      plugins.push({ plugin: mod.plugin as Plugin, dir: folder })
    } catch (err) {
      failed.push({ folder, why: err instanceof Error ? err.message : String(err) })
    }
  }
  return { plugins, failed }
}

// Of the plugins found, those alpha.yaml's plugins line names; what kept a named one from loading.
export function named(
  names: string[],
  found: Awaited<ReturnType<typeof loadPlugins>>,
): { plugins: Loaded[]; problems: string[] } {
  const plugins = found.plugins.filter((l) => names.includes(l.plugin.name))
  const problems = found.failed
    .filter((f) => names.includes(basename(f.folder)))
    .map((f) => `The plugin in ${f.folder} did not load: ${f.why}`)
  for (const n of names)
    if (!plugins.some((l) => l.plugin.name === n) && !problems.some((p) => p.includes(`/${n}`)))
      problems.push(`There is no plugin called ${n} in plugins/ to switch on.`)
  return { plugins, problems }
}

// The plugins alpha.yaml's plugins line names, loaded and given their hosts; one not named does not
// load at all (rules P1). What kept a named one from loading, in words.
export async function switchOn(
  names: string[],
  deps: PluginDeps,
): Promise<{ plugins: Plugins; problems: string[] }> {
  deps.world.pluginsOn = names
  const plugins = new Plugins(deps)
  if (!names.length) return { plugins, problems: [] }
  const chosen = named(names, await loadPlugins(PLUGINS_DIR))
  for (const f of await plugins.register(chosen.plugins))
    chosen.problems.push(`The plugin in ${f.folder} did not register: ${f.why}`)
  return { plugins, problems: chosen.problems }
}

export interface PluginDeps {
  world: World
  user: User
  home: string // Alpha's folder: each plugin keeps its files under plugins/<name>
  region: () => string | null
  ask: (
    system: string,
    prompt: string,
    schema: Record<string, unknown>,
  ) => Promise<{ answer: unknown; uses?: Use[] }>
  connectors: ConnectorService | null
}

export interface PluginRoute {
  method: 'GET' | 'POST'
  path: string // /api/plugins/<name>/<its path>
  answer: (input: Input) => Promise<unknown>
}

// Tools a plugin gave one agent its kit carries.
interface Given {
  plugin: string
  kit: string // its kit's name, whose module the agent came with
  agent: string // the agent's key
  tools: PluginTool[]
}

const TOOL = /^[a-z][a-z0-9_]*$/

export class Plugins {
  readonly deps: PluginDeps
  readonly loaded: Loaded[] = []
  readonly routes: PluginRoute[] = []
  private starts: (() => string | null)[] = []
  private given: Given[] = []
  // the engine, once it is made (after the plugins, which add to its conversations)
  engine: Engine | null = null

  constructor(deps: PluginDeps) {
    this.deps = deps
  }

  // Each plugin given its host; one whose register fails is said and left out.
  async register(loaded: Loaded[]): Promise<{ folder: string; why: string }[]> {
    const failed: { folder: string; why: string }[] = []
    for (const l of loaded) {
      try {
        await l.plugin.register(this.host(l))
        this.loaded.push(l)
      } catch (err) {
        failed.push({ folder: l.dir, why: err instanceof Error ? err.message : String(err) })
      }
    }
    return failed
  }

  // Their own modules, installed or brought up to date as Alpha's own are.
  async keepKits(ctx: WriteCtx): Promise<string[]> {
    const said: string[] = []
    for (const l of this.loaded)
      if (l.plugin.kit) {
        const folder = join(l.dir, l.plugin.kit)
        const out = await keepKit(this.deps.world, folder, ctx, { managed: true })
        if (out) said.push(out)
        // whose kit it is, so its agents and schedules hide while the plugin is off (rules P1)
        const m = this.deps.world.shape.ownModule(readKit(folder).manifest.name)
        if (m)
          run(
            this.deps.world.db,
            'UPDATE kits SET plugin = ? WHERE module_id = ?',
            l.plugin.name,
            m.id,
          )
      }
    return said
  }

  // The plugins on here, by name.
  on(): string[] {
    return this.loaded.map((l) => l.plugin.name)
  }

  // The tools plugins gave this agent, for its desks (rules P2): none for any other agent.
  toolsFor(agentId: string, here: Here): ToolEntry[] {
    const { world } = this.deps
    const a = world.agents.get(agentId)
    if (!a?.source || !a.key) return []
    return this.given
      .filter((g) => g.agent === a.key && world.shape.ownModule(g.kit)?.id === a.source)
      .flatMap((g) =>
        g.tools.map(
          (t): ToolEntry => ({
            server: g.plugin,
            name: t.name,
            description: t.description,
            input: t.input,
            alwaysLoad: true,
            handler: (input) =>
              guardAsync(async () => {
                const turn = {
                  person: here.current.user.id,
                  agent: agentId,
                  turn: here.current.turn ?? '',
                }
                try {
                  return ok(await t.run(input as never, turn))
                } catch (err) {
                  if (err instanceof Refusal) throw new Refused(err.message)
                  throw err
                }
              }),
          }),
        ),
      )
  }

  // What the plugins add to the start of a conversation.
  startBlocks(): string[] {
    return this.starts.flatMap((f) => {
      try {
        const words = f()
        return words?.trim() ? [words.trim()] : []
      } catch {
        return [] // a plugin's block that fails is left out, never a broken start
      }
    })
  }

  private host(l: Loaded): PluginHost {
    const { world, user } = this.deps
    const name = l.plugin.name
    const actor = { kind: 'system' as const, id: `plugin:${name}` }
    const dir = join(this.deps.home, 'plugins', name)
    mkdirSync(dir, { recursive: true })
    const kitName = l.plugin.kit ? readKit(join(l.dir, l.plugin.kit)).manifest.name : null
    const ownModule = () => (kitName ? world.shape.ownModule(kitName) : undefined)
    const ownTable = (table: string): Table => {
      const m = ownModule()
      const t = m && world.shape.ownTable(m.id, table)
      if (!t) throw new Refused(`${l.plugin.title} has no table called ${table}.`)
      return t
    }
    // an agent its kit carries, by its key
    const ownAgent = (key: string): string => {
      const m = ownModule()
      const a = m && world.agents.shipped(m.id, key)
      if (!a) throw new Refused(`${l.plugin.title} has no agent keyed ${key} here.`)
      return a.id
    }
    const byName = (t: Table, values: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(values).map(([slug, v]) => [
          t.fields.find((f) => f.slug === slug)?.name ?? slug,
          v,
        ]),
      )
    const rowsOf = (t: Table): Row[] =>
      world.records.list(t.id).map((r) => ({ id: r.id, values: byName(t, r.values) }))
    return {
      name,
      dir,
      person: () => ({
        name: user.name,
        region: this.deps.region(),
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0] ?? 'en',
      }),
      rows: (module, table) => {
        const m = world.shape.ownModule(module)
        const t = m && world.shape.ownTable(m.id, table)
        return t ? rowsOf(t) : []
      },
      catalogue: () => ({
        modules: [
          ...world.shape
            .modules()
            .map((m) => ({ name: m.name, installed: true, case: businessCase(m) })),
        ],
        connectors: (this.deps.connectors?.known() ?? []).map((c) => ({
          name: c.manifest.name,
          title: c.manifest.title,
          connected: world.connections
            .list()
            .some((k) => k.connector === c.manifest.name && k.state === 'connected'),
        })),
      }),
      people: () =>
        world.people
          .list('person')
          .filter((p) => p.count > 0)
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
          .map((p) => ({
            name: p.name,
            company: p.companies[0] ?? null,
            contact: p.count,
            last: p.last,
          })),
      connect: async (connector) => {
        const s = this.deps.connectors
        if (!s) throw new Refused('Connectors are not set up in this core.')
        const c = s.connector(connector)
        if (c.manifest.auth !== 'system')
          throw new Refused(`${c.manifest.title} connects through its own step, in Connections.`)
        try {
          const conn = await s.connect(
            connector,
            c.manifest.account?.label ?? 'This computer',
            null,
            this.deps.user.id,
          )
          return { connected: conn.state === 'connected', problem: conn.health }
        } catch (err) {
          return { connected: false, problem: err instanceof Error ? err.message : String(err) }
        }
      },
      connectorTool: async (connector, tool, input) => {
        if (!this.deps.connectors) throw new Refused('Connectors are not set up in this core.')
        return this.deps.connectors.runTool(connector, tool, input)
      },
      ask: async (system, prompt, schema) => {
        const { answer, uses } = await this.deps.ask(system, prompt, schema)
        world.spend.add({ kind: 'ask', module: ownModule()?.id ?? null }, uses ?? [])
        return answer
      },
      own: {
        add: (table, rows) =>
          world.records.add(
            ownTable(table).id,
            rows.map((r) => ({
              values: r.values,
              provenance: { kind: 'assumed' as const, basis: r.basis },
            })),
            { actor },
          ),
        // the person's own word, from the plugin's screen: journaled, its source
        set: (table, id, values) => {
          const t = ownTable(table)
          // the change's own line, in the person's name (rules A1)
          world.records.change(t.id, [{ id, values, provenance: { kind: 'stated' } }], {
            actor: { kind: 'person', id: user.id },
            user: user.id,
            byHand: { words: `Changed a row of ${t.name}` },
          })
        },
        rows: (table) => rowsOf(ownTable(table)),
      },
      route: (method, path, answer) => {
        const p = path.startsWith('/') ? path : `/${path}`
        // a plugin's refusal is said as the core's are; anything else is the core's failure
        this.routes.push({
          method,
          path: `/api/plugins/${name}${p}`,
          answer: async (input) => {
            try {
              return await answer(input)
            } catch (err) {
              if (err instanceof Refusal) throw new Refused(err.message)
              throw err
            }
          },
        })
      },
      startBlock: (words) => {
        this.starts.push(words)
      },
      journal: (words, data) => {
        world.line({
          actor,
          kind: 'plugin',
          words,
          data: { plugin: name, ...(data ?? {}) },
          user: user.id,
          module: ownModule()?.id ?? null,
        })
      },
      tools: (agent, tools) => {
        if (!l.plugin.kit || !kitName)
          throw new Refused(`${l.plugin.title} carries no agent: it has no kit.`)
        const keys = readAgents(join(l.dir, l.plugin.kit, 'agents')).flatMap((x) =>
          typeof x === 'string' ? [] : [x.key],
        )
        if (!keys.includes(agent))
          throw new Refused(`${l.plugin.title}'s kit carries no agent keyed ${agent}.`)
        const taken = this.given.filter((g) => g.plugin === name).flatMap((g) => g.tools)
        for (const t of tools) {
          if (!TOOL.test(t.name))
            throw new Refused(`${t.name}: a tool's name is letters, digits and underscores.`)
          if ([...taken, ...tools].filter((x) => x.name === t.name).length > 1)
            throw new Refused(`${l.plugin.title} has two tools called ${t.name}.`)
        }
        this.given.push({ plugin: name, kit: kitName, agent, tools })
      },
      converse: (person, agent, words, brief) => {
        if (!this.engine) throw new Refused('Conversations are not set up in this core.')
        const who = world.user(person)
        if (!who) throw new Refused('There is no such person here.')
        this.engine.desk(who, ownAgent(agent)).takeWork(words, brief)
      },
      howToWork: (turn, lines) => {
        const t = ownTable(lines.table)
        const m = ownModule()
        const a = world.agents.get(turn.agent)
        if (!m || a?.source !== m.id)
          throw new Refused(`Only an agent ${l.plugin.title}'s kit carries puts lines to a person.`)
        const who = world.user(turn.person)
        if (!who) throw new Refused('There is no such person here.')
        if (lines.for === 'everyone' && who.role !== 'owner')
          throw new Refused('Only the owner keeps a line for everyone here.')
        const card = new Reviews(world, null).open(
          {
            words: lines.words,
            table: t,
            field: lines.choice,
            choices: [lines.keep, lines.drop],
            rows: lines.rows,
            note: null,
            howToWork: { line: lines.line, for: lines.for, heading: lines.heading },
          },
          { agent: turn.agent, turn: turn.turn, module: m.id, user: who.id },
        )
        return card.id
      },
    }
  }
}
