// How far each person has gone through Set up Alpha, the first run told as a story of chapters
// (the 22 Nov onboarding redesign): each chapter done or skipped, and when they finished or
// declined it. Kept in the world, per person; which chapters a person's story has is the api's to
// say (api/story.ts), from who they are and what this Alpha has.
import { type Db, one, run } from './db.ts'

const LEFT_OUT = 'story:apps_left_out'
const EXCLUDED = 'connect:accounts_excluded'

export type ChapterState = 'done' | 'skipped'

// The core's own chapters, by key: a plugin's chapter takes another.
export const CORE_CHAPTERS = ['welcome', 'claude', 'workspace', 'connect', 'people', 'here', 'done']

export interface Progress {
  chapters: Record<string, ChapterState>
  doneAt: string | null
  declinedAt: string | null
}

const NONE: Progress = { chapters: {}, doneAt: null, declinedAt: null }

export function progressOf(db: Db, user: string): Progress {
  const r = one<{ chapters: string; done_at: string | null; declined_at: string | null }>(
    db,
    'SELECT chapters, done_at, declined_at FROM story WHERE user_id = ?',
    user,
  )
  if (!r) return NONE
  let chapters: Record<string, ChapterState> = {}
  try {
    chapters = JSON.parse(r.chapters) as Record<string, ChapterState>
  } catch {
    // a value that does not read is as good as none
  }
  return { chapters, doneAt: r.done_at, declinedAt: r.declined_at }
}

function save(db: Db, user: string, p: Progress): void {
  run(
    db,
    `INSERT INTO story (user_id, chapters, done_at, declined_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET chapters = excluded.chapters, done_at = excluded.done_at,
     declined_at = excluded.declined_at`,
    user,
    JSON.stringify(p.chapters),
    p.doneAt,
    p.declinedAt,
  )
}

// A chapter gone through, or skipped.
export function markChapter(db: Db, user: string, chapter: string, state: ChapterState): void {
  const p = progressOf(db, user)
  save(db, user, { ...p, chapters: { ...p.chapters, [chapter]: state } })
}

// A chapter opened again for the person (a plugin's, after its regular check): their story waits
// on Home until they go through it.
export function unmarkChapter(db: Db, user: string, chapter: string): void {
  const p = progressOf(db, user)
  const { [chapter]: _gone, ...rest } = p.chapters
  save(db, user, { chapters: rest, doneAt: null, declinedAt: null })
}

// The story finished: Home's row goes.
export function finishStory(db: Db, user: string): void {
  save(db, user, { ...progressOf(db, user), doneAt: new Date().toISOString() })
}

// Not now: Home's row goes, and the story waits until the person opens it again.
export function declineStory(db: Db, user: string): void {
  save(db, user, { ...progressOf(db, user), declinedAt: new Date().toISOString() })
}

// Opened again from the workspace tile's menu: from the start, what was done shown as done.
export function reopenStory(db: Db, user: string): void {
  save(db, user, { ...progressOf(db, user), doneAt: null, declinedAt: null })
}

// What a person keeps by key, as JSON: none, or one that does not read, is the fallback.
function pref<T>(db: Db, user: string, key: string, none: T): T {
  const r = one<{ value: string }>(
    db,
    'SELECT value FROM preferences WHERE user_id = ? AND key = ?',
    user,
    key,
  )
  try {
    return r ? (JSON.parse(r.value) as T) : none
  } catch {
    return none
  }
}

function keep(db: Db, user: string, key: string, value: unknown): void {
  run(
    db,
    'INSERT INTO preferences (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value',
    user,
    key,
    JSON.stringify(value),
  )
}

// The apps a person left out of Connect's Apps you use, by name: never listed for them again,
// until they restore one from Excluded.
export function appsLeftOut(db: Db, user: string): string[] {
  return pref<string[]>(db, user, LEFT_OUT, [])
}

export function leaveAppOut(db: Db, user: string, name: string): void {
  const now = appsLeftOut(db, user)
  if (now.some((n) => n.toLowerCase() === name.toLowerCase())) return
  keep(db, user, LEFT_OUT, [...now, name])
}

export function bringAppBack(db: Db, user: string, name: string): void {
  const now = appsLeftOut(db, user)
  keep(
    db,
    user,
    LEFT_OUT,
    now.filter((n) => n.toLowerCase() !== name.toLowerCase()),
  )
}

// An account a person deleted from their connections: kept under Excluded, by its provider and
// address, with the connectors it was read by, so Restore brings it back.
export interface ExcludedAccount {
  provider: string // google, microsoft, or a connector's own name
  account: string
  connectors: string[]
}

const key = (a: { provider: string; account: string }) =>
  `${a.provider}:${a.account.trim().toLowerCase()}`

export function accountsExcluded(db: Db, user: string): ExcludedAccount[] {
  return pref<ExcludedAccount[]>(db, user, EXCLUDED, [])
}

export function excludeAccount(db: Db, user: string, a: ExcludedAccount): void {
  const rest = accountsExcluded(db, user).filter((x) => key(x) !== key(a))
  keep(db, user, EXCLUDED, [...rest, a])
}

// Taken off Excluded: what it was, for the caller to bring back; none if it was not there.
export function unexcludeAccount(
  db: Db,
  user: string,
  a: { provider: string; account: string },
): ExcludedAccount | null {
  const all = accountsExcluded(db, user)
  const was = all.find((x) => key(x) === key(a)) ?? null
  if (was)
    keep(
      db,
      user,
      EXCLUDED,
      all.filter((x) => x !== was),
    )
  return was
}
