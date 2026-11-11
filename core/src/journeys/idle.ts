// Waiting for the person's turn to end: true once the engine says this person's turn is idle,
// false when a journey's step has waited its full time.
import type { Engine } from '../engine/engine.ts'

export function idleOf(engine: Engine, user: string, limit: number): () => Promise<boolean> {
  return () =>
    new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        engine.events.off('event', on)
        resolve(false)
      }, limit)
      const on = (e: { type: string; user: string }) => {
        if (e.type === 'idle' && e.user === user) {
          clearTimeout(timer)
          engine.events.off('event', on)
          resolve(true)
        }
      }
      engine.events.on('event', on)
    })
}
