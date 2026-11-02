// Alpha's plugins (onboarding 4a, Kenil's yes 2 Nov): packages in plugins/ loaded at start, each
// given a host (plugin-sdk) that is all it may do in Alpha: read rows, call a connector's tool,
// ask the model once, keep rows in its own module, answer its own routes, add a block to the start
// of a conversation, write a journal line. The core names no plugin; with none, Alpha runs as it
// did. A plugin that does not load is said and left out, as a connector is.
import { mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { checkPlugin, type Input, type Plugin, type PluginHost, type Row } from '@alpha/plugin-sdk'
import { entryOf } from '../connectors/discover.ts'
import type { ConnectorService } from '../connectors/service.ts'
import { keepKit } from '../modules/defaults.ts'
import { readKit } from '../modules/kits/index.ts'
import { Refused } from '../world/kinds.ts'
import type { Table, WriteCtx } from '../world/shape/index.ts'
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
        const out = await keepKit(this.deps.world, join(l.dir, l.plugin.kit), ctx)
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
          const line = world.line({
            actor: { kind: 'person', id: user.id },
            kind: 'set',
            words: `Changed a row of ${t.name}`,
            data: { table: t.id, row: id, plugin: name },
            user: user.id,
            module: t.module.id,
          })
          world.records.change(
            t.id,
            [{ id, values, provenance: { kind: 'stated', source: { message: line.id } } }],
            { actor: { kind: 'person', id: user.id }, user: user.id },
          )
        },
        rows: (table) => rowsOf(ownTable(table)),
      },
      route: (method, path, answer) => {
        const p = path.startsWith('/') ? path : `/${path}`
        this.routes.push({ method, path: `/api/plugins/${name}${p}`, answer })
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
