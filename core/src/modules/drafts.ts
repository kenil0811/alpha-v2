// A schedule's drafts: a kit's script drafts an email, which waits on a card with
// the whole of it. The person can change it, send it from their own mail, or say Not now with a
// reason, and the schedule is told what became of each draft on its next run. After three unchanged
// sends of one schedule's one kind of message the card offers Always: a standing permission that
// then sends that kind without a card, each one a line on Home. Scripts reach no network: the
// core sends, through the person's connection.
import { refusedBy } from '../gates/gates.ts'
import type { Card } from '../world/cards.ts'
import { all, one, parse } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { Covered, Rule } from '../world/rules.ts'
import type { User, World } from '../world/world.ts'

export const DRAFT = 'schedule_draft'

export interface Message {
  to: string
  cc?: string
  subject: string
  body: string
}

export interface Draft {
  schedule: string
  module: string
  kind: string // the kind of message, in the kit's words: CIM request
  key: string | null // one waiting draft per schedule and key (a deal): a newer one replaces it
  connector: string | null // the connector it goes from; none: the person's mail, whichever sends
  message: Message
  about: { table: string; row: string } | null
  note: string | null // where the address came from, and the like
}

// What became of a draft, handed to its schedule's next run.
export interface Outcome {
  key: string | null
  kind: string
  outcome: 'sent' | 'not sent'
  to: string
  subject: string
  reason: string | null
  changed: boolean
  about: { table: string; row: string } | null
  at: string
}

// The words a Not now picks from (a few reasons, put in front of the drafter).
export const REASONS = [
  'Wrong recipient',
  'Not needed',
  'Bad timing',
  'Wrong words',
  'Something else',
]

export interface Sender {
  send(connector: string | null, message: Message): Promise<unknown>
}

const ONE_ADDRESS = /^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/

const plural = (kind: string) => (/s$/i.test(kind) ? kind : `${kind}s`)

export class Drafts {
  private world: World
  private sender: Sender
  private owner: User
  // the drafter runs again once its draft is decided, to hear what became of it
  private back: (schedule: string, module: string) => void
  // the cards being sent right now: a second Send it on one of them is turned away (item 10 of
  // the problems list, 24 Oct), and a send that fails leaves the card waiting as it was
  private sending = new Set<string>()

  constructor(
    world: World,
    sender: Sender,
    owner: User,
    back: (schedule: string, module: string) => void = () => {},
  ) {
    this.world = world
    this.sender = sender
    this.owner = owner
    this.back = back
  }

  covered(d: Pick<Draft, 'schedule' | 'module' | 'kind'>): Covered {
    return { action: 'send_email', schedule: d.schedule, module: d.module, place: { kind: d.kind } }
  }

  sentence(d: Pick<Draft, 'schedule' | 'module' | 'kind'>): string {
    const m = this.world.shape.module(d.module)?.name ?? 'its module'
    return `Always send ${m}'s ${plural(d.kind)} (drafted by ${d.schedule}) without asking`
  }

  private aboutWords(d: Draft): string {
    if (!d.about) return ''
    const rec = this.world.records.get(d.about.row)
    return rec ? ` for ${this.world.rowName(rec.table, rec.record.values)}` : ''
  }

  // A draft from a run: sent at once when a standing permission covers it, else on a card. One
  // recipient each, never a blast (a wall).
  async propose(d: Draft, run: string | null): Promise<{ sent: boolean; card: string | null }> {
    if (!ONE_ADDRESS.test(d.message.to.trim()))
      throw new Refused(`A draft goes to one address; "${d.message.to}" is not one.`)
    if (d.message.cc && d.message.cc.split(/[,;]/).length > 1)
      throw new Refused('A draft copies at most one address.')
    if (!d.message.subject.trim() || !d.message.body.trim())
      throw new Refused('A draft needs a subject and a body.')
    if (d.about && !this.world.records.get(d.about.row))
      throw new Refused('The row the draft is about is not there.')
    this.denied(d, d.message, { kind: 'schedule', id: d.schedule }, run)
    // under a standing permission, an address the person has sent this kind to before goes at
    // once; a new recipient is a card of its own, saying so (Kenil, 24 Oct, item 7)
    const p = this.world.rules.covering(this.covered(d))
    const fresh = !this.approved(d, d.message.to)
    // the same thing to the same address, sent already (a run retried after its send, 28 Oct):
    // never again on its own; it waits on a card saying when it went
    const went = this.wentOn(d, d.message.to)
    if (p && !fresh && !went) {
      await this.sendNow(d, d.message, false, p, run)
      return { sent: true, card: null }
    }
    // a newer draft for the same thing replaces the waiting one
    if (d.key)
      for (const c of this.world.cards.waiting())
        if (c.call?.tool === DRAFT) {
          const was = c.call.input as Draft
          if (was.schedule === d.schedule && was.module === d.module && was.key === d.key)
            this.world.cards.withdraw(
              c.id,
              { kind: 'schedule', id: d.schedule },
              'A newer draft replaces it.',
            )
        }
    const m = d.message
    const card = this.world.cards.open({
      kind: 'permission',
      gate: 'leaves_world',
      words: `Send the ${d.kind}${this.aboutWords(d)} to ${m.to}${p ? ', a new recipient' : ''}?`,
      detail: `To: ${m.to}${m.cc ? `\nCc: ${m.cc}` : ''}\nSubject: ${m.subject}\n\n${m.body}`,
      restsOn: [
        `${d.schedule}'s draft${d.note ? ` (${d.note})` : ''}`,
        ...(went ? [`It went to ${m.to} on ${went.slice(0, 10)} already.`] : []),
        ...(p && !went
          ? [
              `Your standing permission covers ${plural(d.kind)}, but nothing has gone to ${m.to} before.`,
            ]
          : []),
      ],
      cannotUndo: 'Once it has gone, it cannot be called back.',
      options: ['Send it', 'Not now'],
      call: { tool: DRAFT, input: d },
      actor: { kind: 'schedule', id: d.schedule },
      user: this.owner.id,
      module: d.module,
      run,
    })
    return { sent: false, card: card.id }
  }

  private waiting(cardId: string): { card: Card; d: Draft } {
    const card = this.world.cards.get(cardId)
    if (card?.call?.tool !== DRAFT) throw new Refused('That card is not a draft.')
    if (card.state !== 'waiting') throw new Refused('That card has already been answered.')
    return { card, d: card.call.input as Draft }
  }

  // The person's Send it, with their changes if they made any; with always, the standing
  // permission too, which only an unchanged send on a card that offered it can give.
  async send(cardId: string, edited: Message | null, who: User, always = false): Promise<Card> {
    const { d } = this.waiting(cardId)
    const m = edited ?? d.message
    if (!ONE_ADDRESS.test(m.to.trim())) throw new Refused(`"${m.to}" is not one address.`)
    const changed =
      !!edited &&
      (edited.to.trim() !== d.message.to.trim() ||
        (edited.cc ?? '').trim() !== (d.message.cc ?? '').trim() ||
        edited.subject.trim() !== d.message.subject.trim() ||
        edited.body.trim() !== d.message.body.trim())
    if (always && (changed || !this.world.rules.offers(this.covered(d))))
      throw new Refused('Always is offered only for a draft sent as it is, after three like it.')
    const ctx = { actor: { kind: 'person' as const, id: who.id }, user: who.id }
    // a deny holds even on the person's own Send (Kenil's call 2, 27 Oct)
    this.denied(d, m, ctx.actor, null)
    if (this.sending.has(cardId)) throw new Refused('That draft is being sent right now.')
    this.sending.add(cardId)
    try {
      await this.sender.send(d.connector, m)
    } finally {
      this.sending.delete(cardId)
    }
    const card = this.world.cards.answer(cardId, 'Send it', ctx.actor)
    this.world.rules.decided(this.covered(d), { yes: true, changed, card: cardId }, ctx)
    this.outcome(d, m, 'sent', null, changed, ctx.actor)
    if (always) this.world.rules.grant(this.covered(d), this.sentence(d), { ...ctx, card: cardId })
    this.back(d.schedule, d.module)
    return card
  }

  // The person's Not now, with one of the reasons.
  hold(cardId: string, reason: string, words: string, who: User): Card {
    const { d } = this.waiting(cardId)
    if (!REASONS.includes(reason)) throw new Refused(`Say why: ${REASONS.join(', ')}.`)
    const ctx = { actor: { kind: 'person' as const, id: who.id }, user: who.id }
    const card = this.world.cards.answer(cardId, 'Not now', ctx.actor)
    this.world.rules.decided(this.covered(d), { yes: false, changed: false, card: cardId }, ctx)
    this.outcome(
      d,
      d.message,
      'not sent',
      words.trim() ? `${reason}: ${words.trim()}` : reason,
      false,
      ctx.actor,
    )
    this.back(d.schedule, d.module)
    return card
  }

  // A send a deny rule covers is refused, quoting the rule, and the refusal is journaled.
  private denied(
    d: Draft,
    m: Message,
    actor: { kind: 'schedule' | 'person'; id: string },
    run: string | null,
  ): void {
    const deny = this.world.rules.judge({
      effect: 'outward',
      tool: d.connector ? `${d.connector}.send` : 'send',
      to: [m.to, ...(m.cc ? [m.cc] : [])],
      site: null,
      table: null,
      module: d.module,
      schedule: d.schedule,
      own: false,
    }).deny
    if (!deny) return
    this.world.rules.used(
      deny,
      `Refused: the ${d.kind}${this.aboutWords(d)} to ${m.to}. Your rule: ${deny.words}`,
      { actor, user: this.owner.id, run },
      true,
    )
    throw new Refused(refusedBy(deny))
  }

  // Sent under a standing permission: the person's act through it, a line on Home.
  private async sendNow(d: Draft, m: Message, changed: boolean, p: Rule, run: string | null) {
    await this.sender.send(d.connector, m)
    const actor = { kind: 'person' as const, id: this.owner.id }
    this.world.rules.used(
      p,
      `Sent the ${d.kind}${this.aboutWords(d)} to ${m.to} under your standing permission.`,
      { actor, user: this.owner.id, run },
    )
    this.world.line({
      actor: { kind: 'schedule', id: d.schedule },
      kind: 'told',
      words: `${d.schedule}: Sent the ${d.kind}${this.aboutWords(d)} to ${m.to} (your standing permission).`,
      data: {
        schedule: d.schedule,
        ...(d.about ? { about: { table: d.about.table, rows: [d.about.row] } } : {}),
      },
      user: this.owner.id,
      module: d.module,
      run,
    })
    this.outcome(d, m, 'sent', null, changed, actor)
  }

  private outcome(
    d: Draft,
    m: Message,
    outcome: Outcome['outcome'],
    reason: string | null,
    changed: boolean,
    actor: { kind: 'person'; id: string },
  ) {
    this.world.line({
      actor,
      kind: 'draft_decided',
      words:
        outcome === 'sent'
          ? `Sent the ${d.kind}${this.aboutWords(d)} to ${m.to}${changed ? ', changed first' : ''}.`
          : `Did not send the ${d.kind}${this.aboutWords(d)}: ${reason}.`,
      data: {
        schedule: d.schedule,
        module: d.module,
        key: d.key,
        kind: d.kind,
        outcome,
        to: m.to,
        subject: m.subject,
        reason,
        changed,
        about: d.about,
      },
      user: this.owner.id,
      module: d.module,
    })
  }

  // Whether this kind of message has gone from this schedule to this address before, on the
  // person's yes or under their standing permission: the journal's own record of every send.
  private approved(d: Pick<Draft, 'schedule' | 'module' | 'kind'>, to: string): boolean {
    return !!one(
      this.world.db,
      `SELECT 1 FROM journal WHERE kind = 'draft_decided' AND module_id = ?
         AND json_extract(data, '$.schedule') = ? AND json_extract(data, '$.kind') = ?
         AND json_extract(data, '$.outcome') = 'sent' AND lower(json_extract(data, '$.to')) = lower(?)`,
      d.module,
      d.schedule,
      d.kind,
      to.trim(),
    )
  }

  // When this schedule sent this thing (its kind and key) to this address, if it did.
  private wentOn(
    d: Pick<Draft, 'schedule' | 'module' | 'kind' | 'key'>,
    to: string,
  ): string | null {
    if (!d.key) return null
    return (
      one<{ at: string }>(
        this.world.db,
        `SELECT at FROM journal WHERE kind = 'draft_decided' AND module_id = ?
           AND json_extract(data, '$.schedule') = ? AND json_extract(data, '$.kind') = ?
           AND json_extract(data, '$.key') = ? AND json_extract(data, '$.outcome') = 'sent'
           AND lower(json_extract(data, '$.to')) = lower(?) ORDER BY id DESC LIMIT 1`,
        d.module,
        d.schedule,
        d.kind,
        d.key,
        to.trim(),
      )?.at ?? null
    )
  }

  // What became of a schedule's drafts since it last ran, for its next run.
  outcomes(schedule: string, module: string, since: string | null): Outcome[] {
    return all<{ at: string; data: string }>(
      this.world.db,
      "SELECT at, data FROM journal WHERE kind = 'draft_decided' AND module_id = ? AND at > ? ORDER BY id",
      module,
      since ?? '',
    )
      .map((r) => ({ at: r.at, d: parse<Outcome & { schedule: string }>(r.data, {} as never) }))
      .filter((r) => r.d.schedule === schedule)
      .map(({ at, d }) => ({
        key: d.key,
        kind: d.kind,
        outcome: d.outcome,
        to: d.to,
        subject: d.subject,
        reason: d.reason,
        changed: d.changed,
        about: d.about,
        at,
      }))
  }

  // What a draft's card shows beside its words: the email to change, and Always when offered.
  view(card: Card) {
    if (card.call?.tool !== DRAFT) return null
    const d = card.call.input as Draft
    const rec = d.about ? this.world.records.get(d.about.row) : undefined
    return {
      schedule: d.schedule,
      kind: d.kind,
      message: d.message,
      note: d.note,
      about:
        rec && d.about
          ? {
              table: d.about.table,
              row: d.about.row,
              name: this.world.rowName(rec.table, rec.record.values),
            }
          : null,
      reasons: REASONS,
      always:
        card.state === 'waiting' && this.world.rules.offers(this.covered(d))
          ? this.sentence(d)
          : null,
    }
  }
}
