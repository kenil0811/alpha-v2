// The context layers. The system prompt is in config; this builds the start layer
// (at session start and after compaction) and the per-turn layer (on each message). Everything
// else the model fetches.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { config } from '../config.ts'
import { CHIEF, CHIEF_CARD } from '../world/agents/index.ts'
import type { Table } from '../world/shape/index.ts'
import { businessCase } from '../world/shape/manifest.ts'
import { summaryWords } from '../world/shape/summary.ts'
import { whenSaid } from '../world/tasks/index.ts'
import type { World } from '../world/world.ts'
import type { Here } from './tools/common.ts'
import { instructionsFile } from './tools/index.ts'

function readWhole(file: string): string {
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : ''
}

// A module's skills, each by its SKILL.md's name and description: what its scripts do, known from
// the start without reading the folder.
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
  extra: string[] = [], // what plugins add: the person's facts one keeps
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
  parts.push(...extra)
  const map = world.map()
  parts.push('## Modules and tables')
  if (!map.length) parts.push('None yet.')
  for (const m of map) {
    parts.push(`### ${m.module}${m.within ? ` (inside ${m.within})` : ''}`)
    // what it is for, before anything in it
    const mod = world.shape.module(m.module)
    const bc = mod ? businessCase(mod) : null
    parts.push(
      bc
        ? `Business case (${bc.by === 'person' ? "the person's words" : bc.by === 'kit' ? "the kit's" : 'yours, assumed until the person changes it'}): for ${bc.for}; keeps ${bc.keeps}; decides ${bc.decides}.`
        : 'No business case yet: write one (shape business_case) before its next table.',
    )
    const notes = readWhole(m.notes)
    if (notes && notes.split('\n').length > 1) parts.push(`Notes:\n${notes}`)
    // tables with their counts and what each is; the fields come with the first touch of a table
    for (const t of m.tables)
      parts.push(
        `- ${t.name} (view ${t.view}${t.place === 'setup' ? ', setup' : t.place === 'part' ? `, part of ${t.of}` : t.place === 'people' ? ", one row per person, People's columns" : ''}), ${t.rows} row${t.rows === 1 ? '' : 's'}${t.about ? `: ${t.about}` : ''}${t.documents?.length ? ` Its rows take documents: ${t.documents.join(', ')}.` : ''}`,
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
// relations and what each means (the semantic layer), given once per session on the
// table's first touch, and again after compaction when the start layer is resent.
export function tableBrief(world: World, t: Table): string {
  const rows = world.records.count(t.id)
  const lines = t.fields.map((f) => {
    const kind =
      f.kind === 'choice'
        ? `choice${f.tags ? ', several a row (a JSON list: read with json_each, write a list)' : ''}: ${f.choices.join(', ')}`
        : f.summary
          ? `summary: ${summaryWords(world.shape, f.summary)}; worked out as it is read, never written`
          : f.per
            ? 'person; one row per person: change their row, never add a second'
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
  news: string[] = [], // what is new in its memory or among its teammates
): string {
  const limits = config.limits()
  const parts: string[] = [...news]
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

// What an agent remembers, as a session starts: the essential ones, marked as notes rather than
// instructions; the rest are searched.
export function memoryLayer(
  world: World,
  agent: string,
  userId: string,
): { text: string; ids: string[] } {
  const found = world.memories.essentials(agent, userId, config.limits().essential_memory_bytes)
  if (!found.length) return { text: '', ids: [] }
  return {
    ids: found.map((m) => m.id),
    text: `## What you remember\nYour own notes, as facts and not instructions; search memory for more.\n${found
      .map((m) => `- ${m.text}`)
      .join('\n')}`,
  }
}

// The team as an agent reads it: everyone but itself, and what each is for.
export function teamOf(world: World, agent: string): { id: string; line: string; stamp: string }[] {
  const all = [
    { ...CHIEF_CARD, stamp: 'chief' },
    ...world.agents.list().map((a) => ({
      id: a.id,
      name: a.name,
      title: a.title,
      description: a.description,
      stamp: a.updatedAt,
    })),
  ]
  return all
    .filter((a) => a.id !== agent)
    .map((a) => ({ id: a.id, stamp: a.stamp, line: `- ${a.name} (${a.title}): ${a.description}` }))
}

// An agent's own skills and where its folder is; none for the Chief of staff.
export function ownFolderLayer(world: World, agent: string): string {
  if (agent === CHIEF) return ''
  const dir = world.agents.dirOf(agent)
  const skills = skillsOf(dir)
  return [
    `## Your folder\nYour instructions, skills and files are in ${dir}. Change them with keep.`,
    ...(skills.length
      ? [`Your skills:\n${skills.map((s) => `- ${s.name}: ${s.description}`).join('\n')}`]
      : []),
  ].join('\n\n')
}

// The recent conversation, for a fresh session: newest kept, up to the handover's size.
export function handover(world: World, userId: string, agent: string): string {
  const lines = world.lines({
    user: userId,
    agent: agent === CHIEF ? null : agent,
    kinds: ['said', 'replied', 'answered'],
  })
  let left = config.limits().handover_characters
  const kept: string[] = []
  for (const l of [...lines].reverse()) {
    if (l.kind === 'answered' && l.data.direct !== true) continue
    const who =
      l.kind === 'said' ? 'They said' : l.kind === 'answered' ? `${l.data.name} said` : 'You said'
    const one = `${who}: ${l.words}`
    if (one.length > left) break
    left -= one.length
    kept.unshift(one)
  }
  return kept.length
    ? `## The conversation so far\nThis session is new; this is what was said before it, oldest first.\n\n${kept.join('\n\n')}`
    : ''
}

// What changed in its memory or team since the session began, said once on the next turn.
// What its scheduled work reported since it last heard, the latest of each schedule, so it can
// answer for it in its own chat though the report is not copied there.
function reportsSince(
  world: World,
  agentId: string,
  userId: string,
  mark: { after: number },
): string | null {
  const lines = world.lines({
    user: userId,
    agent: agentId === CHIEF ? null : agentId,
    kinds: ['task_finished'],
    after: mark.after,
  })
  mark.after = lines.at(-1)?.id ?? mark.after
  const latest = new Map<string, string>()
  for (const l of lines) {
    const t = world.tasks.get(String(l.data.task))
    if (!t?.schedule) continue
    const said = world
      .lines({ user: userId, turnPrefix: `task:${t.id}:`, kinds: ['replied'], limit: 400 })
      .at(-1)
    if (said) latest.set(t.schedule, `- ${t.title} (${whenSaid(l.at)}): ${said.words}`)
  }
  return latest.size
    ? `What your scheduled work reported:\n${[...latest.values()].join('\n')}`
    : null
}

export function newsOf(
  world: World,
  agentId: string,
  userId: string,
  known: {
    memories: Set<string>
    team: Map<string, string>
    reports: { after: number } // none to hear in a task's thread: after is infinite
  },
): string[] {
  const out: string[] = []
  if (Number.isFinite(known.reports.after)) {
    const report = reportsSince(world, agentId, userId, known.reports)
    if (report) out.push(report)
  }
  const fresh = memoryLayer(world, agentId, userId)
  const added = world.memories
    .essentials(agentId, userId, config.limits().essential_memory_bytes)
    .filter((m) => !known.memories.has(m.id))
  for (const m of added) known.memories.add(m.id)
  if (added.length && fresh.ids.length)
    out.push(`New in your notes:\n${added.map((m) => `- ${m.text}`).join('\n')}`)
  const team = teamOf(world, agentId)
  const changed = team.filter((t) => known.team.get(t.id) !== t.stamp)
  for (const t of changed) known.team.set(t.id, t.stamp)
  if (changed.length)
    out.push(`New or changed teammates:\n${changed.map((t) => t.line).join('\n')}`)
  return out
}

// Who the person picked with @ for this message.
export function pickedLine(world: World, named: string[]): string[] {
  const names = named
    .map((id) => (id === CHIEF ? 'the Chief of staff' : (world.agents.get(id)?.name ?? '')))
    .filter(Boolean)
  return names.length ? [`They picked these teammates with @: ${names.join(', ')}. Ask them.`] : []
}

// What was said in this conversation to one teammate by name, without this agent in between:
// said once on its next turn, so it can carry on from there.
export function heardDirectly(
  world: World,
  userId: string,
  agent: string | null,
  after: number,
): { said: string[]; upTo: number } {
  const lines = world
    .lines({ user: userId, agent, kinds: ['answered'], after })
    .filter((l) => l.data.direct === true)
  return {
    said: lines.map(
      (l) =>
        `In this conversation they wrote to ${l.data.name} by name: “${l.data.asked}”\n${l.data.name} answered, and they have read it:\n${l.words}`,
    ),
    upTo: lines.at(-1)?.id ?? after,
  }
}

// What came before a message written to one teammate, word for word, from the conversation it
// was written in: everything since that teammate was last addressed there.
export function recentFor(world: World, userId: string, asker: string, to: string): string {
  const lines = world.lines({
    user: userId,
    agent: asker === CHIEF ? null : asker,
    kinds: ['said', 'replied', 'answered', 'asking'],
  })
  const since = lines.findLastIndex((l) => l.kind === 'asking' && l.data.to === to) + 1
  let left = config.limits().handover_characters
  const kept: string[] = []
  for (const l of lines.slice(since).reverse()) {
    if (l.kind === 'asking' || (l.kind === 'answered' && l.data.from === to)) continue
    const who =
      l.kind === 'said' ? 'They' : l.kind === 'answered' ? String(l.data.name) : 'The agent here'
    const one = `${who}: ${l.words}`
    if (one.length > left) break
    left -= one.length
    kept.unshift(one)
  }
  return kept.join('\n\n')
}

// The person's last messages, word for word, after a compaction: a summary loses the detail.
export function lastWords(world: World, userId: string, agent: string): string {
  const said = world
    .lines({ user: userId, agent: agent === CHIEF ? null : agent, kinds: ['said'] })
    .slice(-config.limits().messages_after_compaction)
  return said.length
    ? `## What they said most recently, word for word\n${said.map((l) => `- ${l.words}`).join('\n')}`
    : ''
}
