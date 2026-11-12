// The gate adapter: the one place a tool call is journaled and put to the gates. The Agent SDK's
// hooks call it. A world tool's effect comes from its table (tools.ts); a connector tool's from its
// connector; a web address opened, and the shell's reach outside, from the web check (L1). The
// verdict is the gates' (gates.ts): pass, or a card.

import type { CallSays } from '../connectors/process.ts'
import type { ConnectorService } from '../connectors/service.ts'
import { undoOf } from '../connectors/takeback.ts'
import { decide, gateOf } from '../gates/gates.ts'
import { allowHost, asksBeforeSites, moduleNetwork, onList } from '../modules/runs/reach.ts'
import type { RunPlace } from '../modules/runs/types.ts'
import { CHIEF, CHIEF_CARD } from '../world/agents/index.ts'
import type { Actor } from '../world/journal.ts'
import type { User, World } from '../world/world.ts'
import { hostOf, ShownLinks } from './links.ts'
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
  emit?: (e: { type: 'lines' } | { type: 'step' } | { type: 'doing'; words: string }) => void
}

export class Gatekeeper {
  private world: World
  private here: Here
  private user: User
  private connectors: ConnectorService | null
  private emit: NonNullable<GateOptions['emit']>
  private networkWaits: string[] = []
  // what the agent was shown this session; each web call's address and how it went; the calls
  // whose results came in from outside (a page, a search, a connector's read)
  readonly links = new ShownLinks()
  private web = new Map<string, { url: string; how: string | null }>()
  private outside = new Map<string, string | undefined>()
  private browsing = new Set<string>() // browse steps under way, whose line keeps the step's picture
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
    // a connector's tool says what it is, from its own process when it runs in one
    const says = this.connectors?.isTool(toolName)
      ? await this.connectors.says(toolName, input)
      : undefined
    const words = says?.words ?? this.words(toolName, input)
    const name = toolName.replace(`mcp__${SERVER}__`, '')
    this.emit({ type: 'step' }) // what the model wrote before this step is kept before its line
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
    this.links.wrote(JSON.stringify(input))
    const url = typeof input.url === 'string' ? input.url : undefined
    if (
      toolName === 'WebSearch' ||
      toolName === 'WebFetch' ||
      (name === 'look' && url) ||
      name === 'browse'
    )
      this.outside.set(call.callId, url)
    if (name === 'browse') this.browsing.add(call.callId)
    else if (this.connectors?.isTool(toolName)) this.outside.set(call.callId, undefined)
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
    if (toolName === 'WebFetch') return this.opens(String(input.url ?? ''), call.callId)
    if (!toolName.startsWith(`mcp__${SERVER}__`)) return { allow: true }
    if (name === 'look' && typeof input.url === 'string') return this.opens(input.url, call.callId)
    if (name === 'browse' && input.action === 'open' && typeof input.url === 'string')
      return this.opens(input.url, call.callId)
    return this.worldTool(name, input, words, call)
  }

  // A fresh session: nothing is shown in it yet.
  freshSession(): void {
    this.links.clear()
  }

  // A turn starts: the person's own message names its links and sites; another agent's does not.
  turnStarts(): void {
    const cur = this.here.current
    if (cur.said && cur.message) this.links.said(cur.message)
  }

  // The agent whose turn this is, as its scripts' place: its folder holds its list of sites.
  private place(): RunPlace {
    const id = this.here.current.agent ?? CHIEF
    const name = id === CHIEF ? CHIEF_CARD.name : (this.world.agents.get(id)?.name ?? id)
    return { id: null, name, dir: this.world.agents.dirOf(id) }
  }

  // A deny rule on the site: it closes the site whatever else would open it.
  private denied(host: string): boolean {
    return !!this.world.rules.judge({
      effect: 'outward',
      tool: 'network',
      to: [],
      site: host,
      table: null,
      module: null,
      schedule: null,
      own: false,
    }).deny
  }

  // A site on the agent's list, or one the person named in this session, unless a rule denies it.
  private listed(place: RunPlace, host: string): string | null {
    if (this.denied(host)) return null
    if (onList(moduleNetwork(place), host)) return `on ${place.name}'s list`
    return this.links.named(host) ? 'a site you named' : null
  }

  // A yes on a card puts the site on the agent's list for good, shared with its scripts and shell.
  private keepSite(place: RunPlace, host: string): void {
    allowHost(place, host)
    this.world.line({
      actor: { kind: 'system' },
      kind: 'shaped',
      words: `${place.name} may now open ${host}.`,
      data: { agent: this.here.current.agent ?? CHIEF, host },
    })
  }

  // A web address the agent opens (WebFetch, look) goes with no card, unless a deny rule closes
  // its site. Where the firm asks before new sites, only one shown in its conversation, or on a
  // site listed or named, goes with no card; any other is a link it wrote itself, which goes to
  // the gates as the shell's reach does (docs/rules.md L1).
  private opens(url: string, callId: string): Decision {
    const host = hostOf(url)
    if (!host) return { allow: false, reason: `${url} is not a web address.` }
    const place = this.place()
    const how = this.denied(host)
      ? null
      : this.links.shown(url)
        ? 'shown in what it read'
        : this.listed(place, host)
    this.web.set(callId, { url, how })
    if (how || (!this.denied(host) && !asksBeforeSites(this.world))) return { allow: true }
    const cur = this.here.current
    const verdict = decide(this.world, {
      call: { tool: 'network', input: { host, agent: cur.agent ?? CHIEF } },
      effect: 'outward',
      preview: `Let ${place.name} open ${host}?`,
      detail: url,
      yes: 'Let it',
      restsOn: [`a link ${place.name} wrote itself; it was not in anything it read`],
      cannotUndo: 'What is in a web address reaches that site.',
      actor: this.actor(),
      user: this.user.id,
      turn: cur.turn,
    })
    if (verdict.pass) {
      this.web.set(callId, { url, how: verdict.card ? 'on your yes' : 'by your rule' })
      if (verdict.card) this.keepSite(place, host)
    }
    return this.decision(verdict)
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
    // draft says it
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
      // what Revert can do with it once done: the tool's own words, or none
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

  // The shell's reach to a host outside, asked by the sandbox: any site unless a deny rule closes
  // it. Where the firm asks before new sites, a site on the agent's list or named goes; any other
  // is outward, so a card, and a yes puts it on the list.
  network(host: string): Decision {
    const cur = this.here.current
    const place = this.place()
    const site = host.toLowerCase()
    if (this.listed(place, site) || (!this.denied(site) && !asksBeforeSites(this.world)))
      return { allow: true }
    const verdict = decide(this.world, {
      call: { tool: 'network', input: { host, agent: cur.agent ?? CHIEF } },
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
    else if (verdict.card) this.keepSite(place, host.toLowerCase())
    return this.decision(verdict, false)
  }

  private decision(verdict: ReturnType<typeof decide>, emit = true): Decision {
    if (verdict.pass) return { allow: true }
    if (emit) this.emit({ type: 'lines' })
    return { allow: false, reason: verdict.reason }
  }

  // After a call: the journal line saying how it went, and, for a connector's write or send,
  // what it is once done (final, or taken back by Revert, with what the call returned). Returns
  // the hosts whose reach waits on a card, so the route can tell the model why its command came
  // back empty.
  async after(call: {
    callId: string
    ok: boolean
    ms?: number
    error?: string
    result?: unknown
  }): Promise<string[]> {
    const made = this.calls.get(call.callId)
    this.calls.delete(call.callId)
    const web = this.web.get(call.callId)
    this.web.delete(call.callId)
    // what came in from outside: every address in it counts as shown, short ones by its page
    if (call.ok && this.outside.has(call.callId) && call.result !== undefined)
      this.links.add(textOf(call.result), this.outside.get(call.callId))
    this.outside.delete(call.callId)
    // a browse step's picture, kept by its hash: the record shows what the page was after it
    const picture = this.browsing.delete(call.callId) ? this.here.picture : undefined
    if (picture) delete this.here.picture
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
        ...(web?.how ? { how: web.how } : {}),
        ...(picture ? { picture } : {}),
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

// Every piece of text in what a call returned, one per line, however the route shaped it.
function textOf(r: unknown): string {
  if (typeof r === 'string') return r
  if (Array.isArray(r)) return r.map(textOf).join('\n')
  if (r && typeof r === 'object') return Object.values(r).map(textOf).join('\n')
  return ''
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

// A write's or a change's values for a sensitive field, as the journal keeps them: "(kept out)".
// Every other input is kept as it is.
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
