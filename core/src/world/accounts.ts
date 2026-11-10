// Who may sign in: on an Alpha that asks, each person has an account, a
// password only they know, and a browser session. The owner adds people and hands each a one-time
// link to set a password; nothing here sends mail. A password is kept only as its scrypt hash, a
// link and a session only as the hash of what the browser holds. The model never reads any of it
// (modelsql.ts opens no view on these tables).
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { all, type Db, newId, now, one, run, tx } from './db.ts'
import { type Actor, append } from './journal.ts'
import { Refused } from './kinds.ts'
import type { User } from './world.ts'

const hashOf = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  length: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>
const COST = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }
const LENGTH = 64
const MIN_PASSWORD = 12
const LINK_DAYS = 7
const TRIES = 5 // wrong passwords in a row before each try must wait
const WAIT_MS = 30_000
const MAX_WAIT_MS = 15 * 60_000
const WRONG = 'That email and password do not match.'

const secret = () => randomBytes(32).toString('base64url')
const digest = (s: string) => createHash('sha256').update(s).digest('hex')
const after = (ms: number) => new Date(Date.now() + ms).toISOString()
const DAY = 86_400_000

async function hashed(password: string): Promise<string> {
  const salt = randomBytes(16)
  const h = await hashOf(password, salt, LENGTH, COST)
  return `scrypt:${COST.N}:${salt.toString('base64')}:${h.toString('base64')}`
}

async function matches(password: string, kept: string): Promise<boolean> {
  const [, n, salt, h] = kept.split(':')
  const want = Buffer.from(h ?? '', 'base64')
  const got = await hashOf(password, Buffer.from(salt ?? '', 'base64'), want.length, {
    ...COST,
    N: Number(n),
  })
  return timingSafeEqual(got, want)
}

// compared against when no such person exists, so a wrong email takes as long as a wrong password
let noOne: Promise<string> | null = null
const nobody = () => {
  noOne ??= hashed(randomBytes(16).toString('hex'))
  return noOne
}

export interface AccountLine {
  id: string
  name: string
  email: string | null
  role: User['role']
  state: 'waiting' | 'in' // waiting: they have not set a password yet
  lastIn: string | null
}

interface AccountRow {
  user_id: string
  name: string
  role: User['role']
  email: string | null
  password: string | null
  link_until: string | null
  failed: number
  wait_until: string | null
  last_in: string | null
}

const SELECT = `SELECT a.user_id, u.name, u.role, a.email, a.password, a.link_until, a.failed,
  a.wait_until, a.last_in FROM accounts a JOIN users u ON u.id = a.user_id`

type Ctx = { actor: Actor; user?: string }

export class Accounts {
  private db: Db
  constructor(db: Db) {
    this.db = db
  }

  list(): AccountLine[] {
    return all<AccountRow>(this.db, `${SELECT} WHERE a.gone_at IS NULL ORDER BY u.created_at`).map(
      (r) => ({
        id: r.user_id,
        name: r.name,
        email: r.email,
        role: r.role,
        state: r.password ? ('in' as const) : ('waiting' as const),
        lastIn: r.last_in,
      }),
    )
  }

  // A one-time link for this person to set their password: a new one replaces the last.
  private link(userId: string): string {
    const token = secret()
    run(
      this.db,
      'UPDATE accounts SET link_hash = ?, link_until = ? WHERE user_id = ?',
      digest(token),
      after(LINK_DAYS * DAY),
      userId,
    )
    return token
  }

  // The owner's own way in on a new Alpha: until they have a password, a link at each start.
  ownerLink(owner: User): string | null {
    return tx(this.db, () => {
      const r = one<{ password: string | null }>(
        this.db,
        'SELECT password FROM accounts WHERE user_id = ?',
        owner.id,
      )
      if (r?.password) return null
      if (!r) run(this.db, 'INSERT INTO accounts (user_id) VALUES (?)', owner.id)
      return this.link(owner.id)
    })
  }

  // Someone the owner adds, with the link to pass on to them.
  add(name: string, email: string, ctx: Ctx): { id: string; link: string } {
    const who = name.trim()
    const mail = email.trim().toLowerCase()
    if (!who) throw new Refused('Say the person’s name.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new Refused('That is not an email address.')
    return tx(this.db, () => {
      if (one(this.db, 'SELECT 1 FROM accounts WHERE email = ? AND gone_at IS NULL', mail))
        throw new Refused(`${mail} already has an account here.`)
      // someone removed earlier and added again keeps their history under the same person
      const before = one<{ user_id: string }>(
        this.db,
        'SELECT user_id FROM accounts WHERE email = ?',
        mail,
      )
      const id = before?.user_id ?? newId('u')
      if (before) {
        run(this.db, 'UPDATE users SET name = ? WHERE id = ?', who, id)
        run(
          this.db,
          'UPDATE accounts SET password = NULL, gone_at = NULL, failed = 0, wait_until = NULL WHERE user_id = ?',
          id,
        )
      } else {
        run(
          this.db,
          "INSERT INTO users (id, name, role, created_at) VALUES (?, ?, 'member', ?)",
          id,
          who,
          now(),
        )
        run(this.db, 'INSERT INTO accounts (user_id, email) VALUES (?, ?)', id, mail)
      }
      append(this.db, {
        actor: ctx.actor,
        kind: 'account',
        words: `Added ${who} (${mail}) to this Alpha.`,
        data: { person: id },
        user: ctx.user ?? null,
      })
      return { id, link: this.link(id) }
    })
  }

  // A new link for someone who forgot their password: the old password no longer works.
  newLink(id: string, ctx: Ctx): string {
    return tx(this.db, () => {
      const r = one<AccountRow>(this.db, `${SELECT} WHERE a.user_id = ? AND a.gone_at IS NULL`, id)
      if (!r) throw new Refused('That person is not here.')
      run(this.db, 'UPDATE accounts SET password = NULL, failed = 0 WHERE user_id = ?', id)
      run(this.db, 'DELETE FROM sessions WHERE user_id = ?', id)
      append(this.db, {
        actor: ctx.actor,
        kind: 'account',
        words: `Made a new sign-in link for ${r.name}.`,
        data: { person: id },
        user: ctx.user ?? null,
      })
      return this.link(id)
    })
  }

  // Someone leaves: they cannot sign in again. What they did stays in the journal under their name.
  remove(id: string, ctx: Ctx): void {
    tx(this.db, () => {
      const r = one<AccountRow>(this.db, `${SELECT} WHERE a.user_id = ? AND a.gone_at IS NULL`, id)
      if (!r) throw new Refused('That person is not here.')
      if (r.role === 'owner') throw new Refused('The owner stays.')
      run(
        this.db,
        'UPDATE accounts SET gone_at = ?, password = NULL, link_hash = NULL WHERE user_id = ?',
        now(),
        id,
      )
      run(this.db, 'DELETE FROM sessions WHERE user_id = ?', id)
      append(this.db, {
        actor: ctx.actor,
        kind: 'account',
        words: `Removed ${r.name} from this Alpha.`,
        data: { person: id },
        user: ctx.user ?? null,
      })
    })
  }

  private byLink(token: string): AccountRow | undefined {
    const r = one<AccountRow>(
      this.db,
      `${SELECT} WHERE a.link_hash = ? AND a.gone_at IS NULL`,
      digest(token),
    )
    return r?.link_until && r.link_until > now() ? r : undefined
  }

  // What the page behind a link shows; none when it is used or too old.
  linkFor(token: string): { name: string; email: string | null } | null {
    const r = this.byLink(token)
    return r ? { name: r.name, email: r.email } : null
  }

  // A password set from a link, which is then spent. The owner's first link has no email yet.
  async setPassword(
    token: string,
    password: string,
    email: string | null,
    days: number,
  ): Promise<string> {
    if (password.length < MIN_PASSWORD)
      throw new Refused(`A password is at least ${MIN_PASSWORD} characters.`)
    const hash = await hashed(password)
    return tx(this.db, () => {
      const r = this.byLink(token)
      if (!r) throw new Refused('This link was used already, or is too old: ask for a new one.')
      const mail = r.email ?? email?.trim().toLowerCase() ?? ''
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new Refused('Say your email address.')
      run(
        this.db,
        'UPDATE accounts SET email = ?, password = ?, link_hash = NULL, link_until = NULL, failed = 0, wait_until = NULL WHERE user_id = ?',
        mail,
        hash,
        r.user_id,
      )
      append(this.db, {
        actor: { kind: 'person', id: r.user_id },
        kind: 'account',
        words: `${r.name} set a password.`,
        data: { person: r.user_id },
        user: r.user_id,
      })
      return this.session(r.user_id, r.name, days)
    })
  }

  private session(userId: string, name: string, days: number): string {
    const token = secret()
    run(
      this.db,
      'INSERT INTO sessions (hash, user_id, created_at, until) VALUES (?, ?, ?, ?)',
      digest(token),
      userId,
      now(),
      after(days * DAY),
    )
    run(
      this.db,
      'UPDATE accounts SET last_in = ?, failed = 0, wait_until = NULL WHERE user_id = ?',
      now(),
      userId,
    )
    append(this.db, {
      actor: { kind: 'person', id: userId },
      kind: 'signed_in',
      words: `${name} signed in.`,
      user: userId,
    })
    return token
  }

  // Their email and password, the same words whichever was wrong; a run of wrong ones waits.
  async signIn(email: string, password: string, days: number): Promise<string> {
    const r = one<AccountRow>(
      this.db,
      `${SELECT} WHERE a.email = ? AND a.gone_at IS NULL`,
      email.trim().toLowerCase(),
    )
    if (r?.wait_until && r.wait_until > now())
      throw new Refused('Too many wrong tries: wait a minute, then try again.')
    const right = await matches(password, r?.password ?? (await nobody()))
    if (!r?.password || !right) {
      if (r) {
        const failed = r.failed + 1
        const wait = failed >= TRIES ? Math.min(WAIT_MS * 2 ** (failed - TRIES), MAX_WAIT_MS) : 0
        run(
          this.db,
          'UPDATE accounts SET failed = ?, wait_until = ? WHERE user_id = ?',
          failed,
          wait ? after(wait) : null,
          r.user_id,
        )
      }
      throw new Refused(WRONG)
    }
    return tx(this.db, () => this.session(r.user_id, r.name, days))
  }

  // Signed in by a provider, for an email the owner added; none when they did not.
  signInByEmail(email: string, days: number): string | null {
    const r = one<AccountRow>(
      this.db,
      `${SELECT} WHERE a.email = ? AND a.gone_at IS NULL`,
      email.trim().toLowerCase(),
    )
    if (!r) return null
    return tx(this.db, () => this.session(r.user_id, r.name, days))
  }

  // The person a browser's session belongs to; none when it is unknown or ran out.
  userOf(token: string | undefined): User | null {
    if (!token) return null
    const hash = digest(token)
    const s = one<{ id: string; name: string; role: User['role']; until: string }>(
      this.db,
      `SELECT u.id, u.name, u.role, s.until FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN accounts a ON a.user_id = s.user_id AND a.gone_at IS NULL WHERE s.hash = ?`,
      hash,
    )
    if (!s) return null
    if (s.until <= now()) {
      run(this.db, 'DELETE FROM sessions WHERE hash = ?', hash)
      return null
    }
    return { id: s.id, name: s.name, role: s.role }
  }

  signOut(token: string | undefined): void {
    if (token) run(this.db, 'DELETE FROM sessions WHERE hash = ?', digest(token))
  }
}
