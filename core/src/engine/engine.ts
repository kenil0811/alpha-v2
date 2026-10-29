// The engine as the api and the journeys runner see it: one desk per user over one world.
import { EventEmitter } from 'node:events'
import { takeIn } from '../files/documents.ts'
import { FILING, type Filing } from '../files/intake.ts'
import type { Card } from '../world/cards.ts'
import { Refused } from '../world/kinds.ts'
import { type RuleSpec, SAVE_RULE } from '../world/rules.ts'
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
        granted: this.folders(),
        emit: (e) => this.events.emit('event', { ...e, user: user.id } satisfies EngineEvent),
      })
      this.desks.set(user.id, d)
    }
    return d
  }

  get connectors() {
    return this.options.connectors ?? null
  }

  get hands() {
    return this.options.hands ?? null
  }

  get providers() {
    return this.options.providers ?? []
  }

  get route() {
    return this.options.route ?? null
  }

  // A new route reaches the next session: the open ones close and start again on it.
  rerouted(): void {
    for (const d of this.desks.values()) d.close()
    this.desks.clear()
  }

  // The folders the person granted are the connections to a place on this Mac (a watched
  // folder: a connector of the path kind): read, never written.
  folders(): string[] {
    const service = this.options.connectors
    return [
      ...(this.options.granted ?? []),
      ...this.world.connections
        .list()
        .filter((c) => service?.find(c.connector)?.manifest.auth === 'path')
        .map((c) => c.account),
    ]
  }

  // Connecting is the person's own act in Alpha's form: the sign-in gate is answered by doing it.
  async connect(user: User, connector: string, account: string, secret: string | null) {
    const service = this.options.connectors
    if (!service) throw new Refused('Connections are not set up in this core.')
    try {
      return await service.connect(connector, account, secret, user.id)
    } finally {
      this.changed(user)
    }
  }

  async disconnect(user: User, id: string): Promise<void> {
    const service = this.options.connectors
    if (!service) throw new Refused('Connections are not set up in this core.')
    await service.disconnect(id, user.id)
    this.changed(user)
  }

  async sync(user: User, id: string): Promise<void> {
    await this.options.connectors?.sync(id)
    this.events.emit('event', { type: 'lines', user: user.id } satisfies EngineEvent)
  }

  private changed(user: User): void {
    for (const d of this.desks.values()) d.setGranted(this.folders())
    this.events.emit('event', { type: 'lines', user: user.id } satisfies EngineEvent)
  }

  say(user: User, words: string, from: { id: string; name: string } | null = null): string {
    return this.desk(user).say(words, from)
  }

  stop(user: User): Promise<void> {
    return this.desk(user).stop()
  }

  // An agent's draft answered with the card's own buttons or in words: sent as drafted only on
  // its yes, Send it; anything else holds it, the words typed kept as the reason (item 41 of the
  // problems list, 25 Oct).
  async answerDraft(user: User, cardId: string, answer: string): Promise<Card> {
    const drafts = this.options.hands?.drafts
    if (!drafts) throw new Refused('Drafts are not set up in this core.')
    const out =
      answer === 'Send it'
        ? await drafts.send(cardId, null, user)
        : drafts.hold(
            cardId,
            'Something else',
            answer === 'Not now' || answer === 'No' ? '' : answer,
            user,
          )
    this.events.emit('event', { type: 'lines', user: user.id } satisfies EngineEvent)
    return out
  }

  answer(user: User, cardId: string, answer: string): Card {
    // a file from the mail: a yes files it where it was proposed, a no lets it go
    const intake = this.options.hands?.intake
    const waiting = this.world.cards.get(cardId)
    if (intake && waiting?.call?.tool === FILING) {
      const f = waiting.call.input as Filing
      const no = answer === 'Decline' || answer === 'No' || answer === 'Not now'
      const out = no
        ? intake.decline(cardId, '', user)
        : intake.file(cardId, { row: f.row, kind: f.kind }, user)
      this.events.emit('event', { type: 'lines', user: user.id } satisfies EngineEvent)
      return out
    }
    // a rule on its Save card: the person's Save makes it, as the card showed it
    if (
      waiting?.call?.tool === SAVE_RULE &&
      waiting.state === 'waiting' &&
      answer === waiting.options[0]
    )
      this.world.rules.save(waiting.call.input as RuleSpec, {
        actor: { kind: 'person', id: user.id },
        user: user.id,
        card: cardId,
      })
    const card = this.world.cards.answer(cardId, answer, { kind: 'person', id: user.id })
    this.events.emit('event', { type: 'lines', user: user.id } satisfies EngineEvent)
    // the desk carries on only with a card its own turn opened, or a run it started; an agent's
    // card from a scheduled run is the run's to go on with (item 41, 25 Oct)
    if (card.turn) this.desk(user).cardAnswered(card)
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
    this.connectors?.close()
  }
}
