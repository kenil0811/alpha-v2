// The context layers (design §6). The system prompt is in config; this builds the start layer
// (at session start and after compaction) and the per-turn layer (on each message). Everything
// else the model fetches.
import { existsSync, readFileSync } from 'node:fs'
import { config } from '../config.ts'
import type { World } from '../world/world.ts'
import { instructionsFile } from './tools/index.ts'

function readWhole(file: string): string {
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : ''
}

export function startLayer(
  world: World,
  userId: string,
  deskDir: string,
  connections: string | null,
): string {
  const parts: string[] = ['# Alpha: where things stand']
  const everyone = readWhole(instructionsFile(world, null))
  const mine = readWhole(instructionsFile(world, userId))
  if (everyone || mine) {
    parts.push('## Standing instructions')
    if (everyone) parts.push(`For everyone:\n${everyone}`)
    if (mine) parts.push(`For this person:\n${mine}`)
  }
  const map = world.map()
  parts.push('## Modules and tables')
  if (!map.length) parts.push('None yet.')
  for (const m of map) {
    parts.push(`### ${m.module}${m.within ? ` (inside ${m.within})` : ''}`)
    const notes = readWhole(m.notes)
    if (notes && notes.split('\n').length > 1) parts.push(`Notes:\n${notes}`)
    for (const t of m.tables)
      parts.push(
        `- ${t.name} (view ${t.view}), ${t.rows} row${t.rows === 1 ? '' : 's'}: ${t.fields.join(', ') || 'no fields'}${t.documents?.length ? `; its rows take documents: ${t.documents.join(', ')}` : ''}`,
      )
  }
  const docs = world.files.documents()
  if (docs.length) {
    parts.push('## Files')
    for (const d of docs) {
      const on = world
        .rowsOfFile(d.fileHash)
        .map((r) => `${world.shape.table(r.table)?.name ?? 'a table'} row ${r.record}`)
      parts.push(
        `- ${d.title} (${d.kind}, ${d.chunks} pieces${on.length ? `; on ${on.join(', ')}` : ''})`,
      )
    }
  }
  const people = world.people.count()
  const companies = world.people.count('company')
  parts.push(
    `## People\n${people} people and ${companies} companies, each one however many rows name them, gathered from the rows of tables that name people (contacts, the people the person writes to, small meetings). Read them in the views people, companies, people_at and exchanges. Merging or parting people is the person's, on their card or their page.`,
  )
  const tasks = world.tasks.counts()
  parts.push(
    `## Tasks\n${tasks.open} open, ${tasks.overdue} overdue, ${tasks.today} due today. Keep them with the task tool and read them in the view tasks; each sits on the place it concerns.`,
  )
  parts.push(`## Connections\n${connections ?? 'None yet.'}`)
  parts.push(
    `## Folders\nYour own folder is ${deskDir}; module folders are under ${world.paths.modules}.`,
  )
  return parts.join('\n\n')
}

export function turnLayer(
  world: World,
  userId: string,
  seenId: number,
  message: string | null,
  from: { id: string; name: string } | null = null,
): string {
  const limits = config.limits()
  const parts: string[] = []
  if (from) parts.push(`Asked from the ${from.name} module.`)
  const now = new Date()
  parts.push(
    `Now: ${now.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`,
  )
  const elsewhere = world
    .lines({
      after: seenId,
      kinds: [
        'made',
        'shaped',
        'wrote',
        'changed',
        'removed',
        'filed',
        'remembered',
        'card_closed',
      ],
    })
    .filter((l) => l.user !== userId || l.actor.kind !== 'alpha')
    .slice(-limits.changed_lines)
  if (elsewhere.length)
    parts.push(
      `Changed since your last turn here:\n${elsewhere.map((l) => `- ${l.words}`).join('\n')}`,
    )
  const cards = world.cards.waiting(userId)
  if (cards.length)
    parts.push(
      `Cards waiting for the person:\n${cards
        .map((c) => `- ${c.id}: ${c.words}${c.options.length ? ` (${c.options.join(' / ')})` : ''}`)
        .join('\n')}`,
    )
  if (message) {
    const hits = world.search(message, limits.hint_lines)
    if (hits.length)
      parts.push(
        `What the message matches:\n${hits.map((h) => `- ${h.what} in ${h.where}: ${h.words.slice(0, 120)}`).join('\n')}`,
      )
  }
  return parts.join('\n\n')
}
