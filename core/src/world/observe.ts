// Watching a person's work (Vikas, 23 Nov; proposed for Kenil's review): the front app and its
// window's title every few seconds, never a screenshot. A wall in code: it runs only where Alpha
// stays on that computer (Alpha Bridge connected there) and the person said yes to it themselves,
// kept with who and when and taken back in Settings › Permissions. Without both, it never starts.
import { type Db, one, run } from './db.ts'

const KEY = 'observe_work'

export interface Leave {
  by: string // who said yes: the person themselves
  at: string
}

export function leaveOf(db: Db, user: string): Leave | null {
  const r = one<{ value: string }>(
    db,
    'SELECT value FROM preferences WHERE user_id = ? AND key = ?',
    user,
    KEY,
  )
  try {
    return r ? (JSON.parse(r.value) as Leave) : null
  } catch {
    return null
  }
}

// Only the person gives it, for themselves.
export function giveLeave(db: Db, user: string): Leave {
  const leave = { by: user, at: new Date().toISOString() }
  run(
    db,
    'INSERT INTO preferences (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value',
    user,
    KEY,
    JSON.stringify(leave),
  )
  return leave
}

export function takeBack(db: Db, user: string): void {
  run(db, 'DELETE FROM preferences WHERE user_id = ? AND key = ?', user, KEY)
}

// Why watching may not start, or none when it may: on a computer of theirs that stays connected,
// and only on their own yes.
export function mayNotWatch(
  leave: Leave | null,
  user: string,
  onComputers: string[],
): string | null {
  if (!leave || leave.by !== user)
    return 'You have not said yes to Alpha watching your work: Settings › Permissions.'
  if (!onComputers.length)
    return 'Alpha watches your work only where it stays on your computer: connect Alpha Bridge there.'
  return null
}
