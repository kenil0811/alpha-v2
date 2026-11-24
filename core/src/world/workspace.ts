// The workspace: one name and one picture for the whole Alpha, the firm's, set by the owner (rules
// A6) and kept in the world's meta. With none, the window names it after the person, as before.
// Also who the work is for, in the owner's own words, and their website, from Set up Alpha's Your
// workspace.
// The picture is a small image the window sends as a data address; it is served at its own
// address (GET /api/workspace/picture), never carried on every answer.
import { createHash } from 'node:crypto'
import { type Db, one, run, tx } from './db.ts'
import { type Actor, append } from './journal.ts'
import { Refused } from './kinds.ts'

const NAME = 'workspace_name'
const PICTURE = 'workspace_picture'
const FOR = 'workspace_for'
const SITE = 'workspace_site'
const USE = 'workspace_use'
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

// Who the work is for, in the owner's own words: a firm, a practice, a shop, a team, just them.
export function workspaceFor(db: Db): string | null {
  return read(db, FOR)
}

// The workspace's own website, as the owner confirmed or gave it.
export function workspaceSite(db: Db): string | null {
  return read(db, SITE)
}

// Whether Alpha is used for a business or for personal work (Set up Alpha's About you): a
// business may need its admin's approval later, to connect what the firm owns.
export type WorkspaceUse = 'business' | 'personal'
export function workspaceUse(db: Db): WorkspaceUse | null {
  const v = read(db, USE)
  return v === 'business' || v === 'personal' ? v : null
}

// A workspace's name guessed from a mail domain: harbor-reno.com is Harbor Reno.
export function nameOfDomain(domain: string): string | null {
  const first = domain.toLowerCase().split('.')[0] ?? ''
  const words = first.split(/[-_]+/).filter(Boolean)
  return words.length ? words.map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ') : null
}

// A site as given (an address or a bare domain), as an https address; none when it is not one.
export function siteOf(given: string): string | null {
  const t = given.trim()
  if (!t || t.length > 300) return null
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
    return u.hostname.includes('.') || u.hostname === 'localhost' || /^[\d.]+$/.test(u.hostname)
      ? u.toString()
      : null
  } catch {
    return null
  }
}

// The picture as the data address it was given in, for a page that shows it before anyone is
// signed in (a member's welcome, behind their link).
export function workspacePictureData(db: Db): string | null {
  const p = read(db, PICTURE)
  return p && DATA.test(p) ? p : null
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

interface Change {
  name?: string | null | undefined
  picture?: string | null | undefined
  for?: string | null | undefined
  site?: string | null | undefined
  use?: WorkspaceUse | null | undefined
}

// A new name or picture; none puts the person's name or initial back. One journal line.
export function setWorkspace(db: Db, change: Change, actor: Actor): void {
  tx(db, () => changeWorkspace(db, change, actor))
}

function changeWorkspace(db: Db, change: Change, actor: Actor): void {
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
  if (change.for !== undefined) {
    const f = change.for?.trim().replace(/\s+/g, ' ') || null
    if (f && f.length > 300) throw new Refused('Who the work is for is 300 letters at most.')
    write(db, FOR, f)
    said.push(f ? `Said who the work here is for: ${f}` : 'Took who the work is for off.')
  }
  if (change.site !== undefined) {
    const site = change.site === null || !change.site.trim() ? null : siteOf(change.site)
    if (change.site?.trim() && !site) throw new Refused('That is not a website’s address.')
    write(db, SITE, site)
    said.push(
      site ? `Gave this workspace’s website: ${site}` : 'Took this workspace’s website off.',
    )
  }
  if (change.use !== undefined) {
    write(db, USE, change.use)
    said.push(
      change.use ? `Said Alpha is for ${change.use} work here.` : 'Took business or personal off.',
    )
  }
  if (said.length) append(db, { actor, kind: 'shaped', words: said.join(' ') })
}
