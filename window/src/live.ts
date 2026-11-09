// What is streaming, by turn, kept outside React's tree: a word arriving re-draws only its own turn,
// never the whole window.
import type { LiveEvent } from '@alpha/core/api'
import { useSyncExternalStore } from 'react'

type Event = Extract<LiveEvent, { type: 'live' }>
export type LiveParts = Event['parts']
export interface LiveTurn {
  text: string
  doing: string | null
  parts: LiveParts
}

let turns: Record<string, LiveTurn> = {}
const watchers = new Set<() => void>()
const tell = () => {
  for (const w of watchers) w()
}

export function applyLive(e: Event): void {
  turns = { ...turns, [e.turn]: { text: e.text, doing: e.doing, parts: e.parts } }
  tell()
}

export function clearLive(): void {
  turns = {}
  tell()
}

const watch = (w: () => void) => {
  watchers.add(w)
  return () => {
    watchers.delete(w)
  }
}

export const useLiveTurn = (turn: string | null): LiveTurn | undefined =>
  useSyncExternalStore(watch, () => (turn ? turns[turn] : undefined))
