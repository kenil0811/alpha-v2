// The gate adapter (decision 11): the one place a tool call is journaled and put to the gates,
// whatever runs the loop. The Agent SDK's hooks call it, and so does Alpha's own loop. A world
// tool's effect comes from its table (tools.ts); a connector tool's from its connector; the shell's
// reach outside from the sandbox's ask. The verdict is the gates' (gates.ts): pass, or a card.
import type { ConnectorService } from '../connectors/service.ts'
import { decide } from '../gates/gates.ts'
import type { User, World } from '../world/world.ts'
import type { Decision } from './provider.ts'
import { EFFECTS, type Here, SERVER } from './tools/index.ts'
import { stepWords } from './words.ts'

export interface CallContext {
  callId: string
  subagent: string | null // the background agent making the call, when one is
}

export interface GateOptions {
  connectors?: ConnectorService | null
  // a journal line landed, or the reply's live words changed
  emit?: (e: { type: 'lines' } | { type: 'doing'; words: string }) => void
}

export class Gatekeeper {
  private world: World
  private here: Here
  private user: User
  private connectors: ConnectorService | null
  private emit: NonNullable<GateOptions['emit']>
  private networkWaits: string[] = []

  constructor(world: World, here: Here, user: User, options: GateOptions = {}) {
    this.world = world
    this.here = here
    this.user = user
    this.connectors = options.connectors ?? null
    this.emit = options.emit ?? (() => {})
  }

  // What a call is called where the person reads it: the connector's words, or Alpha's.
  words(toolName: string, input: Record<string, unknown>): string {
    return this.connectors?.words(toolName, input) ?? stepWords(toolName, input)
  }

  // Before a call: the journal line, then the gate. A tool of neither the world nor a connector
  // (the route's own: the shell, files, the web) passes here; the sandbox and the file walls
  // judge those.
  before(toolName: string, input: Record<string, unknown>, call: CallContext): Decision {
    const words = this.words(toolName, input)
    const cur = this.here.current
    const name = toolName.replace(`mcp__${SERVER}__`, '')
    this.world.line({
      actor: { kind: 'alpha' },
      kind: 'call',
      words,
      data: { tool: name, input, call: call.callId, subagent: call.subagent },
      user: this.user.id,
      turn: cur.turn,
    })
    this.emit({ type: 'doing', words })
    if (this.connectors?.isTool(toolName))
      return this.connector(toolName, input, words, call.subagent ? null : cur.message)
    if (!toolName.startsWith(`mcp__${SERVER}__`)) return { allow: true }
    return this.worldTool(name, input, words, call)
  }

  private worldTool(
    name: string,
    input: Record<string, unknown>,
    words: string,
    call: CallContext,
  ): Decision {
    const cur = this.here.current
    this.here.fromSubagent = !!call.subagent
    const effectOf = EFFECTS[name]
    const remove = name === 'change' ? ((input.remove as string[] | undefined) ?? []) : []
    const removingTable = name === 'shape' && input.action === 'remove_table'
    const tableName = typeof input.table === 'string' ? input.table : ''
    const table = tableName ? this.world.shape.table(tableName) : undefined
    const removingTasks =
      name === 'task' && input.action === 'remove'
        ? ((input.ids as string[] | undefined) ?? (typeof input.id === 'string' ? [input.id] : []))
        : []
    const ownEntries = remove.length
      ? this.world.records.personsOwn(remove)
      : removingTable && table
        ? this.world.records.personsOwn(this.world.records.list(table.id).map((r) => r.id))
        : removingTasks.length
          ? this.world.tasks.personsOwn(removingTasks)
          : false
    const verdict = decide(this.world, {
      call: { tool: name, input },
      effect: effectOf ? effectOf(input) : undefined,
      preview: `${words}?`,
      restsOn: !call.subagent && cur.message ? [`your message: “${cur.message}”`] : [],
      cannotUndo:
        remove.length || removingTable
          ? 'Removed rows are gone from the table; Activity keeps that they were there.'
          : removingTasks.length
            ? 'Removed tasks are gone with the tasks beneath them; Activity keeps that they were there.'
            : null,
      ownEntries,
      askedIn: typeof input.asked_in === 'string' ? input.asked_in : null,
      message: call.subagent ? null : cur.message,
      actor: { kind: 'alpha' },
      user: this.user.id,
      turn: cur.turn,
      module: table?.module.id ?? null,
    })
    return this.decision(verdict)
  }

  // A connector tool's effect, declared by its connector, goes to the gates like any other.
  private connector(
    toolName: string,
    input: Record<string, unknown>,
    words: string,
    message: string | null,
  ): Decision {
    const preview = this.connectors?.preview(toolName, input)
    const cur = this.here.current
    const verdict = decide(this.world, {
      call: { tool: this.connectors?.keyOf(toolName) ?? toolName, input },
      effect: this.connectors?.effect(toolName, input),
      restsOn: message ? [`your message: “${message}”`] : [],
      preview: preview?.words ? `${preview.words}?` : `${words}?`,
      ...(preview?.detail ? { detail: preview.detail } : {}),
      ...(preview?.yes ? { yes: preview.yes } : {}),
      cannotUndo: 'Once it has gone, it cannot be called back.',
      message,
      actor: { kind: 'alpha' },
      user: this.user.id,
      turn: cur.turn,
    })
    return this.decision(verdict)
  }

  // A script's reach to a host outside, asked by the sandbox: outward, so a card.
  network(host: string): Decision {
    const cur = this.here.current
    const verdict = decide(this.world, {
      call: { tool: 'network', input: { host } },
      effect: 'outward',
      preview: `${stepWords('network', { host })}?`,
      yes: 'Let it',
      restsOn: [],
      cannotUndo: 'What a script sends to that site leaves your world.',
      actor: { kind: 'alpha' },
      user: this.user.id,
      turn: cur.turn,
    })
    this.emit({ type: 'lines' })
    if (!verdict.pass) this.networkWaits.push(host)
    return this.decision(verdict, false)
  }

  private decision(verdict: ReturnType<typeof decide>, emit = true): Decision {
    if (verdict.pass) return { allow: true }
    if (emit) this.emit({ type: 'lines' })
    return { allow: false, reason: verdict.reason }
  }

  // After a call: the journal line saying how it went. Returns the hosts whose reach waits on a
  // card, so the route can tell the model why its command came back empty.
  after(call: { callId: string; ok: boolean; ms?: number; error?: string }): string[] {
    this.world.line({
      actor: { kind: 'alpha' },
      kind: 'called',
      words: call.ok ? 'Done.' : 'That step did not work.',
      data: {
        call: call.callId,
        ok: call.ok,
        ...(call.ms !== undefined ? { ms: call.ms } : {}),
        ...(call.ok ? {} : { error: call.error ?? '' }),
      },
      user: this.user.id,
      turn: this.here.current.turn,
    })
    this.emit({ type: 'lines' })
    return this.networkWaits.splice(0)
  }
}
