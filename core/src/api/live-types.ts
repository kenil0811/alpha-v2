// What the core says on the window's socket as things happen (server.ts's /ws): the world changed,
// a read counted something, or an agent's reply streaming, busy or idle.
export type LiveEvent =
  | { type: 'lines'; agent?: string; task?: string }
  | { type: 'read' }
  | {
      type: 'live'
      turn: string
      text: string
      doing: string | null
      parts: ({ kind: 'text'; text: string } | { kind: 'step'; words: string })[]
      agent?: string
      task?: string
    }
  | { type: 'busy'; turn: string; agent?: string; task?: string }
  | { type: 'idle'; agent?: string; task?: string }
