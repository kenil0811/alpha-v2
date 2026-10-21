// The model sorts a person's items into the groups the person named (a kit's circles), for their
// review: each item one group or none, with why in a few words, from the facts given only
// (config/judging.md). A wall in code: an answer naming a group or an item that was not asked is
// dropped. Items go in batches, so a long list is sorted in a few calls.
import type { Ask } from '../files/reading.ts'
import { Refused } from '../world/kinds.ts'

export interface JudgeSpec {
  groups: { name: string; about: string }[]
  items: { id: string; facts: string }[]
}

export interface Judged {
  id: string
  group: string | null
  why: string
}

const BATCH = 120

export async function judge(
  spec: JudgeSpec,
  ask: Ask,
): Promise<{ judged: Judged[]; tokens: number }> {
  const names = spec.groups.map((g) => g.name.trim()).filter(Boolean)
  if (!names.length) throw new Refused('Name the groups to sort into, each with who belongs in it.')
  const groups = spec.groups
    .filter((g) => g.name.trim())
    .map((g) => `- ${g.name.trim()}: ${g.about.trim() || '(no words given)'}`)
    .join('\n')
  const out: Judged[] = []
  let tokens = 0
  for (let i = 0; i < spec.items.length; i += BATCH) {
    const batch = spec.items.slice(i, i + BATCH)
    const prompt = `The groups, in the person's words:\n${groups}\n\nThe items, one a line (id: facts):\n${batch
      .map((x) => `${x.id}: ${x.facts.replace(/\s+/g, ' ').trim()}`)
      .join('\n')}`
    const schema = {
      type: 'object',
      properties: {
        answers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              group: { anyOf: [{ type: 'string', enum: names }, { type: 'null' }] },
              why: { type: 'string' },
            },
            required: ['id', 'group', 'why'],
            additionalProperties: false,
          },
        },
      },
      required: ['answers'],
      additionalProperties: false,
    }
    const { answer, tokens: used } = await ask(prompt, schema)
    tokens += used
    const asked = new Set(batch.map((x) => x.id))
    const given = new Map<string, Judged>()
    for (const a of ((answer as { answers?: unknown[] })?.answers ?? []) as Judged[]) {
      if (!a || !asked.has(String(a.id)) || given.has(String(a.id))) continue
      const group = typeof a.group === 'string' && names.includes(a.group) ? a.group : null
      given.set(String(a.id), { id: String(a.id), group, why: group ? String(a.why ?? '') : '' })
    }
    for (const x of batch) out.push(given.get(x.id) ?? { id: x.id, group: null, why: '' })
  }
  return { judged: out, tokens }
}
