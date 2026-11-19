// The never-use list (rules N1): the kinds Alpha ships (core/config/never.yaml), the firm's own
// words kept by the owner, and each person's. A connection meets the shipped kinds the firm has on,
// the firm's words and its own person's; what matches is left out as it is read. The journal says
// that a word was added or taken off and for whom, never the word: the list says what the person
// would rather no one read.
import type { NeverList } from '@alpha/connector-sdk'
import { config } from '../config.ts'
import { all, type Db, now, run, tx } from './db.ts'
import { append } from './journal.ts'
import { Refused } from './kinds.ts'
import { actorName, type WriteCtx } from './shape/index.ts'

export const EVERYONE = 'everyone'

// One shipped kind as Settings shows it: its name and whether the firm has it on. Its words stay in
// core/config/never.yaml, never shown.
export interface NeverKind {
  key: string
  title: string
  on: boolean
}

// A word as the person typed it: whole words and phrases; ending in * it is a stem.
const tidy = (w: string) => w.trim().toLowerCase().replace(/\s+/g, ' ')

export class NeverUse {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  // The firm's words, or one person's.
  words(scope: string): string[] {
    return all<{ word: string }>(
      this.db,
      "SELECT word FROM never_use WHERE scope = ? AND kind = 'word' ORDER BY word",
      scope,
    ).map((r) => r.word)
  }

  // The shipped kinds, each on unless the owner turned it off for everyone.
  kinds(): NeverKind[] {
    const off = new Set(
      all<{ word: string }>(
        this.db,
        "SELECT word FROM never_use WHERE scope = ? AND kind = 'off'",
        EVERYONE,
      ).map((r) => r.word),
    )
    return config.never().map((k) => ({
      key: k.key,
      title: k.title,
      on: !off.has(k.key),
    }))
  }

  add(scope: string, word: string, ctx: WriteCtx): void {
    const w = tidy(word)
    if (!w.replace(/\*$/, '').trim()) throw new Refused('Say a word or a few words to leave out.')
    tx(this.db, () => {
      if (this.words(scope).includes(w)) return
      run(
        this.db,
        "INSERT INTO never_use (scope, kind, word, added_by, added_at) VALUES (?, 'word', ?, ?, ?)",
        scope,
        w,
        actorName(ctx.actor),
        now(),
      )
      append(this.db, {
        actor: ctx.actor,
        kind: 'never_use',
        words: `${actorName(ctx.actor)} added a word to the never-use list ${whose(scope)}.`,
        data: { scope, words: this.words(scope).length },
        user: ctx.user ?? null,
      })
    })
  }

  remove(scope: string, word: string, ctx: WriteCtx): void {
    tx(this.db, () => {
      const gone = run(
        this.db,
        "DELETE FROM never_use WHERE scope = ? AND kind = 'word' AND word = ?",
        scope,
        tidy(word),
      )
      if (!gone.changes) return
      append(this.db, {
        actor: ctx.actor,
        kind: 'never_use',
        words: `${actorName(ctx.actor)} took a word off the never-use list ${whose(scope)}.`,
        data: { scope, words: this.words(scope).length },
        user: ctx.user ?? null,
      })
    })
  }

  // A shipped kind on or off for everyone: off where it is the firm's own work (a practice's
  // patients, a firm of lawyers). The owner's to say; the route holds that.
  setKind(key: string, on: boolean, ctx: WriteCtx): void {
    const k = config.never().find((x) => x.key === key)
    if (!k) throw new Refused('There is no such kind on the never-use list.')
    tx(this.db, () => {
      const was = this.kinds().find((x) => x.key === key)?.on
      if (was === on) return
      if (on)
        run(
          this.db,
          "DELETE FROM never_use WHERE scope = ? AND kind = 'off' AND word = ?",
          EVERYONE,
          key,
        )
      else
        run(
          this.db,
          "INSERT INTO never_use (scope, kind, word, added_by, added_at) VALUES (?, 'off', ?, ?, ?)",
          EVERYONE,
          key,
          actorName(ctx.actor),
          now(),
        )
      append(this.db, {
        actor: ctx.actor,
        kind: 'never_use',
        words: `${actorName(ctx.actor)} ${on ? 'turned on' : 'turned off'} ${k.title} on the never-use list for everyone.`,
        data: { kind: key, on },
        user: ctx.user ?? null,
      })
    })
  }

  // What one person's connection never keeps: the shipped kinds the firm has on, the firm's words
  // and that person's (the firm's alone for a connection of the firm's).
  listFor(person: string | null): NeverList {
    const kinds = new Set(
      this.kinds()
        .filter((k) => k.on)
        .map((k) => k.key),
    )
    const shipped = config.never().filter((k) => kinds.has(k.key))
    const own = [
      ...this.words(EVERYONE),
      ...(person && person !== EVERYONE ? this.words(person) : []),
    ]
    return {
      words: [...shipped.flatMap((k) => k.words), ...own.filter((w) => !w.endsWith('*'))],
      stems: [
        ...shipped.flatMap((k) => k.stems),
        ...own.filter((w) => w.endsWith('*')).map((w) => w.slice(0, -1).trim()),
      ],
    }
  }
}

const whose = (scope: string) => (scope === EVERYONE ? 'for everyone' : 'for themselves')
