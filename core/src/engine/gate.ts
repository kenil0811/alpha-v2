// The gate adapter (decision 11): the one place a tool call is journaled and put to the gates,
// whatever runs the loop. The Agent SDK's hooks call it, and so does Alpha's own loop. A world
// tool's effect comes from its table (tools.ts); a connector tool's from its connector; the shell's
// reach outside from the sandbox's ask. The verdict is the gates' (gates.ts): pass, or a card.

import type { CallSays } from '../connectors/process.ts'
import type { ConnectorService } from '../connectors/service.ts'
import { undoOf } from '../connectors/takeback.ts'
import { decide, gateOf } from '../gates/gates.ts'
import type { Actor } from '../world/journal.ts'
import type { User, World } from '../world/world.ts'
import type { Decision } from './provider.ts'
import { EFFECTS, type Here, SERVER } from './tools/index.ts'
import { stepWords } from './words.ts'

export interface CallContext {
  callId: string
  subagent: string | null // the background schedule making the call, when one is
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
  private onYes = new Map<string, string>()
  // each connector call under way, for the line that says it was done (what it is, once done)
  private calls = new Map<string, { tool: string; input: Record<string, unknown>; words: string }>()

  constructor(world: World, here: Here, user: User, options: GateOptions = {}) {
    this.world = world
    this.here = here
    this.user = user
    this.connectors = options.connectors ?? null
    this.emit = options.emit ?? (() => {})
  }

  // Alpha, in the voice of whichever agent this turn is.
  private actor(): Actor {
    const agent = this.here.current.agent
    return agent ? { kind: 'alpha', id: agent } : { kind: 'alpha' }
  }

  // What a call of Alpha's or the route's own is called where the person reads it; a connector's
  // tool says its own (`says`).
  words(toolName: string, input: Record<string, unknown>): string {
    return stepWords(toolName, input)
  }

  // Before a call: the journal line, then the gate. A tool of neither the world nor a connector
  // (the route's own: the shell, files, the web) passes here; the sandbox and the file walls
  // judge those.
  async before(
    toolName: string,
    input: Record<string, unknown>,
    call: CallContext,
  ): Promise<Decision> {
    const cur = this.here.current
    // a connector's tool says what it is, from its own process when it runs in one (step 2)
    const says = this.connectors?.isTool(toolName)
      ? await this.connectors.says(toolName, input)
      : undefined
    const words = says?.words ?? this.words(toolName, input)
    const name = toolName.replace(`mcp__${SERVER}__`, '')
    this.world.line({
      actor: this.actor(),
      kind: 'call',
      words,
      // a connector's call says what it is, so Activity can show the writes and sends that went
      data: {
        tool: name,
        input: keptOut(this.world, name, input),
        call: call.callId,
        subagent: call.subagent,
        ...(says ? { effect: says.effect } : {}),
      },
      user: this.user.id,
      turn: cur.turn,
    })
    this.emit({ type: 'doing', words })
    if (this.connectors?.isTool(toolName)) {
      this.calls.set(call.callId, { tool: toolName, input, words })
      return this.connector(
        toolName,
        input,
        words,
        call.subagent ? null : cur.message,
        call.subagent,
        says,
        call.callId,
      )
    }
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
    const changing =
      name === 'change'
        ? ((input.rows as { id?: string }[] | undefined) ?? []).map((r) => String(r.id))
        : []
    const ownEntries = remove.length
      ? this.world.records.personsOwn(remove)
      : changing.length
        ? this.world.records.personsOwn(changing)
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
      actor: this.actor(),
      user: this.user.id,
      turn: cur.turn,
      module: table?.module.id ?? cur.from?.id ?? null,
      table: table?.id ?? null,
      schedule: call.subagent,
    })
    return this.decision(verdict)
  }

  // A connector tool's effect, declared by its connector, goes to the gates like any other.
  private connector(
    toolName: string,
    input: Record<string, unknown>,
    words: string,
    message: string | null,
    schedule: string | null,
    says: CallSays | undefined,
    callId: string,
  ): Decision {
    const preview = says?.preview ?? undefined
    const cur = this.here.current
    const tool = this.connectors?.keyOf(toolName) ?? toolName
    const effect = says?.effect
    // a send to an address nothing has gone to from here is said on the card, as a schedule's
    // draft says it (item 39 of the problems list, 25 Oct)
    const to = typeof input.to === 'string' ? input.to.trim() : ''
    const fresh =
      !!to &&
      gateOf({ call: { tool, input }, effect, preview: '', actor: this.actor() }) ===
        'leaves_world' &&
      !this.world.cards.approvedTo(tool, to)
    const verdict = decide(this.world, {
      call: { tool, input },
      effect,
      restsOn: [
        ...(message ? [`your message: “${message}”`] : []),
        ...(fresh ? ['Nothing has gone to this address from here before.'] : []),
      ],
      preview: `${preview?.words ?? words}${fresh ? ', a new recipient' : ''}?`,
      ...(preview?.detail ? { detail: preview.detail } : {}),
      ...(preview?.yes ? { yes: preview.yes } : {}),
      // what Revert can do with it once done (step 2, part 2): the tool's own words, or none
      cannotUndo:
        says?.undo && says.undo.kind !== 'final'
          ? says.undo.said
          : 'Once it has gone, it cannot be called back.',
      message,
      actor: this.actor(),
      user: this.user.id,
      turn: cur.turn,
      module: cur.from?.id ?? null,
      schedule,
      named: this.connectors?.ruleName(toolName) ?? null,
    })
    // went on the person's yes: said with how it went, so Activity puts it under that card's turn
    if (verdict.pass && verdict.card) this.onYes.set(callId, verdict.card.id)
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
      actor: this.actor(),
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

  // After a call: the journal line saying how it went, and, for a connector's write or send,
  // what it is once done (final, or taken back by Revert, with what the call returned: step 2,
  // part 2). Returns the hosts whose reach waits on a card, so the route can tell the model why
  // its command came back empty.
  async after(call: {
    callId: string
    ok: boolean
    ms?: number
    error?: string
    result?: unknown
  }): Promise<string[]> {
    const made = this.calls.get(call.callId)
    this.calls.delete(call.callId)
    const result = resultOf(call.result)
    const undo =
      made && call.ok && this.connectors
        ? await undoOf(this.connectors, made.tool, made.input, result)
        : null
    this.world.line({
      actor: this.actor(),
      kind: 'called',
      words: call.ok ? 'Done.' : 'That step did not work.',
      data: {
        call: call.callId,
        ok: call.ok,
        ...(call.ms !== undefined ? { ms: call.ms } : {}),
        ...(call.ok ? {} : { error: call.error ?? '' }),
        ...(this.onYes.has(call.callId) ? { card: this.onYes.get(call.callId) } : {}),
        ...(undo && made
          ? { undo: { kind: undo.kind, did: made.words, words: undo.words ?? null, result } }
          : {}),
      },
      user: this.user.id,
      turn: this.here.current.turn,
    })
    this.onYes.delete(call.callId)
    this.emit({ type: 'lines' })
    return this.networkWaits.splice(0)
  }
}

// What a tool's call returned, from its result as the route hands it: the connector's own
// answer, as JSON in the tool result's text, or as it is.
function resultOf(r: unknown): unknown {
  const content = Array.isArray(r)
    ? (r as { type?: string; text?: string }[])
    : r && typeof r === 'object' && Array.isArray((r as { content?: unknown }).content)
      ? (r as { content: { type?: string; text?: string }[] }).content
      : null
  const text =
    typeof r === 'string'
      ? r
      : content
        ? content.map((c) => (c.type === 'text' ? (c.text ?? '') : '')).join('')
        : null
  if (text === null) return r ?? null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// A write's or a change's values for a sensitive field, as the journal keeps them: "(kept out)"
// (step 2, part 3). Every other input is kept as it is.
function keptOut(
  world: World,
  tool: string,
  input: Record<string, unknown>,
): Record<string, unknown> {
  if ((tool !== 'write' && tool !== 'change') || typeof input.table !== 'string') return input
  const table = world.shape.table(input.table)
  const hidden = new Set(
    (table?.fields ?? []).filter((f) => f.sensitive).flatMap((f) => [f.name, f.slug, f.id]),
  )
  if (!hidden.size || !Array.isArray(input.rows)) return input
  return {
    ...input,
    rows: input.rows.map((r) => {
      const row = r as { values?: Record<string, unknown> }
      if (!row?.values) return r
      return {
        ...row,
        values: Object.fromEntries(
          Object.entries(row.values).map(([k, v]) => [k, hidden.has(k) ? '(kept out)' : v]),
        ),
      }
    }),
  }
}
