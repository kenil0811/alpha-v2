// The workspace: one name and one picture for the whole Alpha, the firm's, set by the owner (rules
// A6) and kept in the world's meta. With none, the window names it after the person, as before.
// The picture is a small image the window sends as a data address; it is served at its own
// address (GET /api/workspace/picture), never carried on every answer.
import { createHash } from 'node:crypto'
import { type Db, one, run, tx } from './db.ts'
import { type Actor, append } from './journal.ts'
import { Refused } from './kinds.ts'

const NAME = 'workspace_name'
const PICTURE = 'workspace_picture'
const DATA = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/
export const PICTURE_MAX = 100_000 // a data address's length: the window sends a 96px square

const read = (db: Db, key: string) =>
  one<{ value: string }>(db, 'SELECT value FROM meta WHERE key = ?', key)?.value ?? null
const write = (db: Db, key: string, value: string | null) =>
  value === null
    ? run(db, 'DELETE FROM meta WHERE key = ?', key)
    : run(
        db,
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
        key,
        value,
      )

export interface WorkspacePicture {
  type: string
  bytes: Buffer
  version: string // changes with the picture, so the window asks again
}

export function workspaceName(db: Db): string | null {
  return read(db, NAME)
}

export function workspacePicture(db: Db): WorkspacePicture | null {
  const m = DATA.exec(read(db, PICTURE) ?? '')
  if (!m?.[1] || !m[2]) return null
  const bytes = Buffer.from(m[2], 'base64')
  return {
    type: `image/${m[1]}`,
    bytes,
    version: createHash('sha256').update(bytes).digest('hex').slice(0, 12),
  }
}

// A new name or picture; none puts the person's name or initial back. One journal line.
export function setWorkspace(
  db: Db,
  change: { name?: string | null | undefined; picture?: string | null | undefined },
  actor: Actor,
): void {
  tx(db, () => changeWorkspace(db, change, actor))
}

function changeWorkspace(
  db: Db,
  change: { name?: string | null | undefined; picture?: string | null | undefined },
  actor: Actor,
): void {
  const said: string[] = []
  if (change.name !== undefined) {
    const name = change.name?.trim() || null
    if (name && name.length > 80) throw new Refused('A workspace’s name is 80 letters at most.')
    write(db, NAME, name)
    said.push(name ? `Named this workspace ${name}.` : 'Took this workspace’s name off.')
  }
  if (change.picture !== undefined) {
    const p = change.picture
    if (p !== null && (p.length > PICTURE_MAX || !DATA.test(p)))
      throw new Refused('A workspace’s picture is a small PNG, JPEG or WebP image.')
    write(db, PICTURE, p)
    said.push(p ? 'Changed this workspace’s picture.' : 'Took this workspace’s picture off.')
  }
  if (said.length) append(db, { actor, kind: 'shaped', words: said.join(' ') })
}
