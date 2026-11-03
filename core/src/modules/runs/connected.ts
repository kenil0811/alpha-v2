// What a script reaches through a connector its kit names in uses (design §8, §11): a tool that
// only reads, and the files an item carries put on a row of the module's own tables. Each goes
// to the gates as the model's call goes, so the person's rules hold for it; a tool that writes or
// goes outward is never a script's: the person does it, on a card. Each call is a step of the run.
import type { Connector, Effect, ItemFile } from '@alpha/connector-sdk'
import { type ConnectorService, gateKey, mcpName } from '../../connectors/service.ts'
import { takeIn } from '../../files/documents.ts'
import { decide } from '../../gates/gates.ts'
import { Refused } from '../../world/kinds.ts'
import type { Module, Table } from '../../world/shape/index.ts'
import type { World } from '../../world/world.ts'
import type { AgentRunner } from './runner.ts'
import type { RunFor } from './types.ts'
import { usesOf } from './walls.ts'

// The connectors as the runner sees them: what a tool is, running it, and an item's files.
export interface ConnectorTools {
  tool(
    connector: string,
    tool: string,
    input: Record<string, unknown>,
  ): { effect: Effect | undefined; words: string } | null
  carries(connector: string): boolean // its items carry files
  run(connector: string, tool: string, input: Record<string, unknown>): Promise<unknown>
  files(connector: string, item: string): Promise<ItemFile[]>
}

// A tool as its connector declares it: its effect for the gates and its words in Activity.
export function toolOf(known: Connector[], connector: string, tool: string, input: unknown) {
  const c = known.find((k) => k.manifest.name === connector)
  const spec = c?.tools[tool]
  if (!c || !spec) return null
  return {
    effect: typeof spec.effect === 'function' ? spec.effect(input as never) : spec.effect,
    words: spec.words ? spec.words(input as never) : `Reached ${c.manifest.title}`,
  }
}

// The core's connectors, through the person's connection.
export function toolsOf(service: ConnectorService, world: World): ConnectorTools {
  return {
    tool: (connector, tool, input) =>
      service.isTool(mcpName(connector, tool))
        ? toolOf(service.known(), connector, tool, input)
        : null,
    carries: (connector) => !!service.find(connector)?.files,
    run: (connector, tool, input) => service.runTool(connector, tool, input),
    files: (connector, item) => {
      const conn = world.connections
        .list()
        .find((k) => k.connector === connector && k.state === 'connected')
      if (!conn) throw new Refused(`${connector} is not connected.`)
      return service.fetchFiles(conn.id, item)
    },
  }
}

export function connectorCalls(o: {
  runner: AgentRunner
  module: Module
  label: string
  runId: string
  who: RunFor
  refuse: (why: string) => never
  writable: (t: Table) => Table
  tableOf: (name: unknown) => Table
}) {
  const { runner, module, label, runId } = o
  const actor = { kind: 'agent' as const, id: label }
  const ctx = { actor, run: runId }
  const step = (words: string, data: Record<string, unknown>) => {
    runner.world.line({ actor, kind: 'run_step', words, data, run: runId, module: module.id })
    runner.notify()
  }
  // the walls: a connector the kit names in uses, and only a read; then the gates
  const reachable = (connector: string): ConnectorTools => {
    if (!usesOf(module).some((u) => u.connector?.toLowerCase() === connector.toLowerCase()))
      o.refuse(
        `${label} may not reach ${connector}: ${module.name}'s module.yaml names no such connector in uses.`,
      )
    if (!runner.connectors) throw new Refused('Connectors are not set up in this core.')
    return runner.connectors
  }
  const gated = (connector: string, key: string, input: Record<string, unknown>, words: string) => {
    const verdict = decide(runner.world, {
      call: { tool: gateKey(connector, key), input },
      effect: 'read',
      preview: `${words}?`,
      actor,
      user: o.who.user,
      turn: o.who.turn,
      module: module.id,
      agent: label,
    })
    if (!verdict.pass) o.refuse(verdict.reason)
  }
  return {
    'connectors.read': async (p: Record<string, unknown>) => {
      const connector = String(p.connector ?? '')
      const tool = String(p.tool ?? '')
      const input = (p.input ?? {}) as Record<string, unknown>
      const tools = reachable(connector)
      const t = tools.tool(connector, tool, input)
      if (!t) return o.refuse(`${connector} has no tool called ${tool}.`)
      if (t.effect !== 'read')
        o.refuse(
          `${label} may only read through ${connector}: ${tool} ${t.effect ? `is a ${t.effect}` : 'declares no effect'}, which is the person's to do, on a card.`,
        )
      gated(connector, tool, input, t.words)
      const out = await tools.run(connector, tool, input)
      step(`${t.words}.`, { connector, tool, input })
      return out
    },
    'connectors.file': async (p: Record<string, unknown>) => {
      const connector = String(p.connector ?? '')
      const item = String(p.item ?? '')
      const kind = String(p.kind ?? '').trim()
      const t = o.writable(o.tableOf(p.table))
      const kinds = t.documents ?? []
      if (!kinds.includes(kind))
        o.refuse(
          kinds.length
            ? `${t.name}'s rows take ${kinds.join(', ')}; ${kind || 'no kind'} is not one of them.`
            : `${t.name} takes no documents: its module.yaml says no documents.`,
        )
      const rec = runner.world.records.get(String(p.row))
      if (rec?.table.id !== t.id) throw new Refused(`${t.name} has no row ${String(p.row)}.`)
      const tools = reachable(connector)
      if (!tools.carries(connector)) return o.refuse(`${connector}'s items carry no files.`)
      gated(connector, 'files', { item }, `Fetch the files of ${item} from ${connector}`)
      const placed: { file: string; name: string; row: string; kind: string }[] = []
      for (const f of (await tools.files(connector, item)).filter((x) => !x.inline)) {
        const { file } = takeIn(runner.world, f.bytes, f.name, f.mime, ctx)
        runner.world.placeFile(file.hash, rec.record.id, kind, ctx)
        placed.push({ file: file.hash, name: f.name, row: rec.record.id, kind })
      }
      step(
        placed.length
          ? `Put ${placed.map((x) => x.name).join(', ')} from ${connector} on a row of ${t.name}, as ${kind}.`
          : `${item} from ${connector} carries no files.`,
        { connector, item, table: t.id, row: rec.record.id, files: placed.map((x) => x.file) },
      )
      return placed
    },
  }
}
