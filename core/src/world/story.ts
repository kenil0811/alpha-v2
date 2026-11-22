// How far each person has gone through Set up Alpha, the first run told as a story of chapters
// (the 22 Nov onboarding redesign): each chapter done or skipped, and when they finished or
// declined it. Kept in the world, per person; which chapters a person's story has is the api's to
// say (api/story.ts), from who they are and what this Alpha has.
import { type Db, one, run } from './db.ts'

const LEFT_OUT = 'story:apps_left_out'

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

// The apps a person left out of Connect's Apps you use, by name: never listed for them again.
export function appsLeftOut(db: Db, user: string): string[] {
  const r = one<{ value: string }>(
    db,
    'SELECT value FROM preferences WHERE user_id = ? AND key = ?',
    user,
    LEFT_OUT,
  )
  try {
    return r ? (JSON.parse(r.value) as string[]) : []
  } catch {
    return []
  }
}

export function leaveAppOut(db: Db, user: string, name: string): void {
  const now = appsLeftOut(db, user)
  if (now.some((n) => n.toLowerCase() === name.toLowerCase())) return
  run(
    db,
    'INSERT INTO preferences (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value',
    user,
    LEFT_OUT,
    JSON.stringify([...now, name]),
  )
}
