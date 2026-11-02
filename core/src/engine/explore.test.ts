// A plugin's exploring session on Alpha's own loop (onboarding B): the model is given the plugin's
// tools and the answer tool and nothing else, each look's answer goes back to it, a turn without a
// look or an answer is asked for the answer, and a session that never settles ends in plain words.
// The model is a script here; never Claude.
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { exploreApi } from './claudeapi.ts'
import type { ChatAnswer, ChatRequest } from './loop.ts'
import type { ToolEntry } from './registry.ts'

const usage = { input_tokens: 10, output_tokens: 5 }
const text = (words: string): ChatAnswer => ({
  content: [{ type: 'text', text: words, citations: null }],
  stopReason: 'end_turn',
  usage,
})
const call = (id: string, name: string, input: Record<string, unknown>): ChatAnswer => ({
  content: [{ type: 'tool_use', id, name, input, caller: { type: 'direct' } }],
  stopReason: 'tool_use',
  usage,
})

const looked: unknown[] = []
const tools: ToolEntry[] = [
  {
    server: 'onboarding',
    name: 'day',
    description: 'One day.',
    input: { date: z.string().optional() },
    handler: async (input) => {
      looked.push(input)
      return { content: [{ type: 'text', text: '[t1] {"items":[]}' }] }
    },
  },
]
const SCHEMA = { type: 'object', properties: { about: { type: 'array' } } }

describe('an exploring session on Alpha’s own loop', () => {
  it('gives the plugin’s tools alone, sends each look back, and ends on the answer', async () => {
    const seen: ChatRequest[] = []
    const script = [
      call('u1', 'mcp__onboarding__day', { date: '2026-10-20' }),
      text('Let me think.'),
      call('u2', 'answer', { about: ['You plan your days'] }),
    ]
    const out = await exploreApi(
      async (req) => {
        seen.push(structuredClone({ ...req, signal: undefined, onText: undefined }) as never)
        return script.shift() ?? text('')
      },
      'claude-test',
      'Get to know them.',
      'The overview.',
      tools,
      SCHEMA,
      10,
    )
    expect(out.answer).toEqual({ about: ['You plan your days'] })
    expect(out.tokens).toBe(45)
    expect(out.uses).toHaveLength(3)
    expect(looked).toEqual([{ date: '2026-10-20' }])
    expect(seen[0]?.tools.map((t) => t.name)).toEqual(['mcp__onboarding__day', 'answer'])
    expect(seen[0]?.system).toMatch(/^Get to know them\.\n\n.*answer tool once/)
    // the look's answer went back under its call
    expect(seen[1]?.messages.at(-1)).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'u1', content: '[t1] {"items":[]}' }],
    })
    // a turn of words alone is asked for the answer
    expect(seen[2]?.messages.at(-1)).toEqual({
      role: 'user',
      content: 'Give your answer by calling the answer tool.',
    })
  })

  it('says so when the model never settles in the turns it has, or calls a tool it was not given', async () => {
    let n = 0
    await expect(
      exploreApi(
        async () => call(`u${++n}`, 'mcp__alpha__records_add', {}),
        'claude-test',
        'Get to know them.',
        'The overview.',
        tools,
        SCHEMA,
        3,
      ),
    ).rejects.toThrow('The model did not settle on an answer in the turns it had.')
    expect(n).toBe(3)
  })
})
