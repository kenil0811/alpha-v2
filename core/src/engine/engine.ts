// The engine as the api and the journeys runner see it: one desk per user over one world.
import { EventEmitter } from 'node:events'
import { takeIn } from '../files/read.ts'
import type { Card } from '../world/cards.ts'
import type { User, World } from '../world/world.ts'
import { Desk, type DeskEvent, type DeskOptions } from './desk.ts'

export type EngineEvent = DeskEvent & { user: string }

export class Engine {
  readonly world: World
  readonly events = new EventEmitter()
  private desks = new Map<string, Desk>()
  private options: Omit<DeskOptions, 'emit'>

  constructor(world: World, options: Omit<DeskOptions, 'emit'> = {}) {
    this.world = world
    this.options = options
  }

  desk(user: User): Desk {
    let d = this.desks.get(user.id)
    if (!d) {
      d = new Desk(this.world, user, {
        ...this.options,
        emit: (e) => this.events.emit('event', { ...e, user: user.id } satisfies EngineEvent),
      })
      this.desks.set(user.id, d)
    }
    return d
  }

  say(user: User, words: string): string {
    return this.desk(user).say(words)
  }

  stop(user: User): Promise<void> {
    return this.desk(user).stop()
  }

  answer(user: User, cardId: string, answer: string): Card {
    const card = this.world.cards.answer(cardId, answer, { kind: 'person', id: user.id })
    this.events.emit('event', { type: 'lines', user: user.id } satisfies EngineEvent)
    this.desk(user).cardAnswered(card)
    return card
  }

  // What the person drops is filed at once (design §12).
  drop(user: User, bytes: Uint8Array, name: string, mime: string) {
    const out = takeIn(this.world, bytes, name, mime, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    this.events.emit('event', { type: 'lines', user: user.id } satisfies EngineEvent)
    return out
  }

  busy(user: User): boolean {
    return this.desks.get(user.id)?.busy ?? false
  }

  close(): void {
    for (const d of this.desks.values()) d.close()
    this.desks.clear()
  }
}
