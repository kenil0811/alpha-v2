// Alpha's plugins (onboarding 4a, Kenil's yes 2 Nov): packages in plugins/ loaded at start, each
// given a host (plugin-sdk) that is all it may do in Alpha: read rows, call a connector's tool,
// ask the model once, keep rows in its own module, answer its own routes, add a block to the start
// of a conversation, write a journal line. The core names no plugin; with none, Alpha runs as it
// did. A plugin that does not load is said and left out, as a connector is.
import { mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { never } from '@alpha/connector-sdk'
import {
  checkPlugin,
  type Input,
  type Plugin,
  type PluginHost,
  Refusal,
  type Row,
} from '@alpha/plugin-sdk'
import { config } from '../config.ts'
import { entryOf } from '../connectors/discover.ts'
import type { ConnectorService } from '../connectors/service.ts'
import type { ToolEntry } from '../engine/registry.ts'
import { keepKit } from '../modules/defaults.ts'
import { readKit } from '../modules/kits/index.ts'
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
  // the person's route's exploring session; none where it cannot look around
  explore?: (
    system: string,
    prompt: string,
    tools: ToolEntry[],
    schema: Record<string, unknown>,
    turns: number,
  ) => Promise<{ answer: unknown; uses?: Use[] }>
}

export interface PluginRoute {
  method: 'GET' | 'POST'
  path: string // /api/plugins/<name>/<its path>
  answer: (input: Input) => Promise<unknown>
}

export class Plugins {
  readonly deps: PluginDeps
  readonly loaded: Loaded[] = []
  readonly routes: PluginRoute[] = []
  private starts: (() => string | null)[] = []

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
        const out = await keepKit(this.deps.world, join(l.dir, l.plugin.kit), ctx, {
          managed: true,
        })
        if (out) said.push(out)
      }
    return said
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
          private: !!c.manifest.private,
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
      neverOf: (connector) =>
        world.connections
          .list()
          .filter((k) => k.connector === connector)
          .flatMap((k) => k.never),
      setNever: (connector, words) => {
        // the person's own ticks, said in the plugin's screen
        for (const k of world.connections.list().filter((x) => x.connector === connector))
          world.connections.setNever(k.id, words, {
            actor: { kind: 'person', id: this.deps.user.id },
            user: this.deps.user.id,
          })
      },
      never: (words) =>
        never(
          words,
          world.connections.list().flatMap((c) => c.never),
        ),
      connectorTool: async (connector, tool, input) => {
        if (!this.deps.connectors) throw new Refused('Connectors are not set up in this core.')
        return this.deps.connectors.runTool(connector, tool, input)
      },
      ask: async (system, prompt, schema) => {
        const { answer, uses } = await this.deps.ask(system, prompt, schema)
        world.spend.add({ kind: 'ask', module: ownModule()?.id ?? null }, uses ?? [])
        return answer
      },
      explore: async (system, prompt, tools, schema) => {
        if (!this.deps.explore)
          throw new Refused('The way Alpha reaches Claude here cannot look around yet.')
        const calls: { id: string; tool: string; input: unknown; output: unknown }[] = []
        let made = 0 // ids given as each call starts, so calls side by side never share one
        const entries: ToolEntry[] = tools.map((t) => ({
          server: name,
          name: t.name,
          description: t.description,
          input: t.input,
          alwaysLoad: true,
          handler: async (input) => {
            const id = `t${++made}`
            try {
              const output = await t.run(input)
              calls.push({ id, tool: t.name, input, output })
              return { content: [{ type: 'text', text: `[${id}] ${JSON.stringify(output)}` }] }
            } catch (err) {
              const words = err instanceof Error ? err.message : String(err)
              calls.push({ id, tool: t.name, input, output: { problem: words } })
              return { content: [{ type: 'text', text: `[${id}] ${words}` }], isError: true }
            }
          },
        }))
        const { answer, uses } = await this.deps.explore(
          system,
          prompt,
          entries,
          schema,
          config.limits().explore_turns,
        )
        world.spend.add({ kind: 'ask', module: ownModule()?.id ?? null }, uses ?? [])
        return { answer, calls }
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
    }
  }
}
