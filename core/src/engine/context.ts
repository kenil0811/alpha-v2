// The context layers (design §6). The system prompt is in config; this builds the start layer
// (at session start and after compaction) and the per-turn layer (on each message). Everything
// else the model fetches.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { config } from '../config.ts'
import type { Table } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import type { Here } from './tools/common.ts'
import { instructionsFile } from './tools/index.ts'

function readWhole(file: string): string {
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : ''
}

// A module's skills, each by its SKILL.md's name and description (item 61 of the problems list,
// 25 Oct): what its scripts do, known from the start without reading the folder.
export function skillsOf(dir: string): { name: string; description: string }[] {
  const root = join(dir, 'skills')
  if (!existsSync(root)) return []
  const out: { name: string; description: string }[] = []
  for (const s of readdirSync(root, { withFileTypes: true })) {
    if (!s.isDirectory()) continue
    const file = join(root, s.name, 'SKILL.md')
    const front = /^---\n([\s\S]*?)\n---/.exec(readWhole(file))?.[1]
    if (!front) continue
    try {
      const f = (parse(front) ?? {}) as { name?: unknown; description?: unknown }
      out.push({
        name: String(f.name ?? s.name),
        description: String(f.description ?? '').trim(),
      })
    } catch {
      // a front matter that does not read is left out, never a broken start layer
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
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
  const rules = world.rules.inForce()
  if (rules.length)
    parts.push(
      `## The person's rules\nCode holds these: a call one denies is refused before it runs, and one it allows needs no card. Plan around them; a rule changes only on the person's word (the rule tool asks, their Save makes it).\n${rules.map((r) => `- ${r}`).join('\n')}`,
    )
  const map = world.map()
  parts.push('## Modules and tables')
  if (!map.length) parts.push('None yet.')
  for (const m of map) {
    parts.push(`### ${m.module}${m.within ? ` (inside ${m.within})` : ''}`)
    const notes = readWhole(m.notes)
    if (notes && notes.split('\n').length > 1) parts.push(`Notes:\n${notes}`)
    // tables with their counts and what each is; the fields come with the first touch of a table
    for (const t of m.tables)
      parts.push(
        `- ${t.name} (view ${t.view}${t.place === 'setup' ? ', setup' : t.place === 'part' ? `, part of ${t.of}` : ''}), ${t.rows} row${t.rows === 1 ? '' : 's'}${t.about ? `: ${t.about}` : ''}${t.documents?.length ? ` Its rows take documents: ${t.documents.join(', ')}.` : ''}`,
      )
    const skills = skillsOf(m.dir)
    if (skills.length)
      parts.push(
        `Skills (skills/<name>/SKILL.md says more):\n${skills.map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ''}`).join('\n')}`,
      )
  }
  parts.push(
    'A table’s fields and what each means come with your first query, write or change of it; ask for a grammar (scripts, pages, views, tasks) with guide.',
  )
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

// A table as the model needs it to read or write it: its fields with their kinds, choices,
// relations and what each means (the semantic layer, 24 Oct), given once per session on the
// table's first touch, and again after compaction when the start layer is resent.
export function tableBrief(world: World, t: Table): string {
  const rows = world.records.count(t.id)
  const lines = t.fields.map((f) => {
    const kind =
      f.kind === 'choice'
        ? `choice: ${f.choices.join(', ')}`
        : f.kind === 'relation'
          ? `relation to ${f.relatesTo ? (world.shape.table(f.relatesTo)?.name ?? 'a table') : 'a table'}${f.many ? ', a list' : ''}${f.partOf ? '; each row is part of that row, never without one, and goes with it' : ''}`
          : f.kind === 'notes'
            ? 'notes: the row’s free notes in Markdown, read in the view row_notes (not in this table’s view), written with change; mention a person as [@Name](person:<id from the view people>) and a row as [Name](row:<id>)'
            : f.kind
    return `- ${f.name} (${kind})${f.about ? `: ${f.about}` : ''}`
  })
  const bare = t.fields.filter((f) => !f.about).map((f) => f.name)
  return [
    `${t.name} (view ${t.slug}), ${rows} row${rows === 1 ? '' : 's'}${t.about ? `: ${t.about}` : ''}`,
    ...lines,
    ...(bare.length
      ? [
          `No sentence yet on what ${bare.join(', ')} ${bare.length === 1 ? 'means' : 'mean'}${t.about ? '' : ', nor on the table'}: when you can tell from the rows or the person's words, say so with shape describe (it shows as assumed until they edit it).`,
        ]
      : []),
  ].join('\n')
}

// The briefs of the tables a tool touched that the model has not been given yet this session.
export function firstTouch(world: World, here: Here, tables: Table[]): string {
  const fresh = tables.filter((t) => !here.touched.has(t.id))
  for (const t of fresh) here.touched.add(t.id)
  return fresh.map((t) => tableBrief(world, t)).join('\n\n')
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
        'reverted',
        'rule_saved',
        'rule_revoked',
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
