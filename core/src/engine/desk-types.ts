// What a desk is given and says (split from desk.ts for its wall), and the fingerprint a kept
// session is resumed by.
import { createHash } from 'node:crypto'
import type { ConnectorService } from '../connectors/service.ts'
import type { AgentAsk } from '../world/agents/asks.ts'
import type { User } from '../world/world.ts'
import type { QueryFn } from './claudecode.ts'
import type { Provider } from './provider.ts'
import type { ModelRoute } from './route.ts'
import type { AgentBus } from './tools/common.ts'
import { type Hands, TOOL_NAMES } from './tools/index.ts'

export type { QueryFn } from './claudecode.ts'

export type DeskEvent =
  | { type: 'lines' }
  | { type: 'live'; turn: string; text: string; doing: string | null }
  | { type: 'busy'; turn: string }
  | { type: 'idle' }

export interface DeskOptions {
  // the model behind the desk, or how to pick it when a session opens (the route can change);
  // Claude Code when not given
  provider?: Provider | (() => Provider)
  // every provider the person can choose, by route, for Settings › Model
  providers?: { route: 'subscription' | 'key'; title: string; provider: Provider }[]
  query?: QueryFn // a scripted session for the Claude Code provider (tests)
  emit?: (e: DeskEvent) => void
  granted?: string[] // folders the person granted, read-only
  connectors?: ConnectorService
  hands?: Hands
  route?: ModelRoute // how this install reaches Claude: the person's subscription or a key
  agent?: string // whose desk this is; the Chief of staff's when none
  bus?: AgentBus & {
    settled(user: User, ask: AgentAsk, spent: number | null): void
    interim(user: User, ask: AgentAsk, words: string): void
  }
  // blocks plugins add to the start of a conversation (onboarding 4a); none when there are none
  starts?: () => string[]
  // Alpha's words alone (measured 24 Oct: six journeys, three runs each way; alone passed 17 of
  // 18 to appended's 18, 8% faster and 9% fewer input tokens, and one prompt serves both routes),
  // or appended to the route's own prompt:
  // measures one against the other.
  prompt?: 'appended' | 'alone'
}

export interface Turn {
  turn: string
  text: string // what is sent to the session
  said: { message: number; user: string } | null
  message: string | null // the person's own words, when the turn is on their message
  from?: { id: string; name: string } | null // the module they asked from
  ask?: string | null // the teammate's ask this turn answers
  root?: string | null // the person's request a chain of asks serves
  low?: boolean // a teammate's; a person's own message goes ahead of it
  named?: string[] // the teammates the person picked with @
}

// A kept session is resumed only with the same tools (v1 crashed resuming one made on others).
export function fingerprint(connectorTools: string[], agent = ''): string {
  return createHash('sha256')
    .update([...TOOL_NAMES, ...connectorTools, ...(agent ? [agent] : [])].join(','))
    .digest('hex')
    .slice(0, 16)
}
