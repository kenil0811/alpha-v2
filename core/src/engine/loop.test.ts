// Alpha's own loop against a scripted model: never the real one (CLAUDE.md). The script plays
// the model's part, answering with tool calls and text; the gates and the registry are real.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadSet, STANDARD_DIR } from '../connectors/discover.ts'
import { ConnectorService } from '../connectors/service.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'
import { ClaudeApiProvider } from './claudeapi.ts'
import { Desk, type DeskEvent } from './desk.ts'
import type { Chat, ChatAnswer, ChatRequest } from './loop.ts'
import { toolsOf } from './loop.ts'

let home: string
let world: World
let user: User

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-loop-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

type Step = (req: ChatRequest, round: number) => ChatAnswer | Promise<ChatAnswer>

const text = (words: string, stop = 'end_turn'): ChatAnswer => ({
  content: [{ type: 'text', text: words, citations: null }],
  stopReason: stop,
  usage: { input_tokens: 10, output_tokens: 5 },
})
const call = (id: string, name: string, input: Record<string, unknown>): ChatAnswer => ({
  content: [{ type: 'tool_use', id, name, input, caller: { type: 'direct' } }],
  stopReason: 'tool_use',
  usage: { input_tokens: 10, output_tokens: 5 },
})

// A desk on the key route, with the script as its model.
async function deskOn(script: Step) {
  const connectors = new ConnectorService(world, {
    secrets: new MemorySecrets(),
    known: (await loadSet(STANDARD_DIR)).connectors,
  })
  const seen: ChatRequest[] = []
  let round = 0
  const chat: Chat = async (req) => {
    seen.push(req)
    const answer = await script(req, round++)
    for (const b of answer.content) if (b.type === 'text') req.onText(b.text)
    return answer
  }
  const provider = new ClaudeApiProvider(world, { key: () => 'sk-ant-test', chat, userId: user.id })
  const events: DeskEvent[] = []
  const waiters: (() => void)[] = []
  const desk = new Desk(world, user, {
    provider,
    connectors,
    emit: (e) => {
      events.push(e)
      if (e.type === 'idle') waiters.shift()?.()
    },
  })
  const idle = () => new Promise<void>((r) => waiters.push(r))
  return { desk, seen, events, idle, connectors }
}

describe('Alpha’s own loop', () => {
  it('sends the layers with the words and every tool’s schema, runs a write through the gate, and keeps the messages', async () => {
    const { desk, seen, events, idle } = await deskOn((_req, round) =>
      round === 0
        ? call('t1', 'mcp__alpha__shape', {
            action: 'make_table',
            module: 'Food',
            table: 'Meals',
            about: 'One meal the person ate.',
            fields: [{ name: 'Food', kind: 'text', about: 'What was eaten.' }],
          })
        : round === 1
          ? call('t2', 'mcp__alpha__write', {
              table: 'Meals',
              rows: [{ values: { Food: 'two eggs' }, provenance: { kind: 'stated' } }],
            })
          : text('Logged two eggs.'),
    )
    const done = idle()
    desk.say('log two eggs')
    await done
    // the first request: the start layer and the turn layer beside the person's words
    const first = seen[0] as ChatRequest
    expect(first.system).toContain('You are Alpha, working for Kenil')
    expect(first.messages).toHaveLength(1)
    const content = first.messages[0]?.content as { type: string; text: string }[]
    expect(content[0]?.text).toBe('log two eggs')
    expect(content[1]?.text).toContain('# Alpha: where things stand')
    expect(first.tools.map((t) => t.name)).toContain('mcp__alpha__write')
    expect(first.tools.map((t) => t.name)).toContain('mcp__gmail__send')
    expect(first.tools.find((t) => t.name === 'mcp__alpha__query')?.input_schema).toMatchObject({
      type: 'object',
      properties: { sql: { type: 'string' } },
    })
    // the tool results went back as the tools' own answers
    const third = seen[2] as ChatRequest
    expect(third.messages).toHaveLength(5)
    expect(third.messages[2]?.role).toBe('user')
    // the world has the row, and the journal the calls
    const meals = world.shape.table('Meals')
    expect(meals && world.records.list(meals.id)).toHaveLength(1)
    expect(
      world.lines({ kinds: ['call', 'called', 'replied'] }).map((l) => [l.kind, l.words]),
    ).toEqual([
      ['call', 'Made the table Meals'],
      ['called', 'Done.'],
      ['call', 'Added a row to Meals'],
      ['called', 'Done.'],
      ['replied', 'Logged two eggs.'],
    ])
    // the reply streamed, and the session's messages are kept for resuming
    expect(events.some((e) => e.type === 'live' && e.text === 'Logged two eggs.')).toBe(true)
    expect(world.messages(user.id)).toHaveLength(6)
    expect(world.desk(user.id)?.sessionId).toBe(`own:${user.id}`)
    desk.close()
  })

  it('puts a send on the same card as the other route, tells the model it waits, and carries on after the yes', async () => {
    const mail = { to: 'priya@harbor.example', subject: 'The CIM', body: 'Could you send it over?' }
    const sent: string[] = []
    const { desk, seen, idle, connectors } = await deskOn((req, round) => {
      const content = req.messages.at(-1)?.content
      const results = Array.isArray(content)
        ? (content as { type: string; is_error?: boolean; content?: string }[]).filter(
            (b) => b.type === 'tool_result',
          )
        : []
      if (round === 0) return call('s1', 'mcp__gmail__send', mail)
      if (results[0]?.is_error) {
        sent.push(String(results[0].content))
        return text('It waits for your yes.')
      }
      return text('Sent.')
    })
    let done = idle()
    desk.say('send Priya a note asking for the CIM')
    await done
    expect(sent[0]).toMatch(/waits/i)
    const card = world.cards.waiting(user.id).find((c) => c.call?.tool === 'gmail_send')
    expect(card?.words).toBe('Send an email to priya@harbor.example: “The CIM”, a new recipient?')
    expect(connectors.known().length).toBeGreaterThan(0)
    // the person's yes on the card: the desk is told and carries on in the same session
    done = idle()
    desk.cardAnswered(
      world.cards.answer(card?.id ?? '', 'Send it', { kind: 'person', id: user.id }),
    )
    await done
    const last = seen.at(-1)?.messages.at(-1)?.content as { text: string }[]
    expect(last[0]?.text).toContain('The person said yes on the card')
    expect(world.lines({ kinds: ['replied'] }).map((l) => l.words)).toEqual([
      'It waits for your yes.',
      'Sent.',
    ])
    desk.close()
  })

  it('stops when the person says stop, resumes with its kept messages, and says when the key’s window is closed', async () => {
    let calls = 0
    const { desk, idle } = await deskOn(async (req) => {
      calls += 1
      if (calls === 1) {
        await new Promise((r) => setTimeout(r, 50))
        if (req.signal.aborted) throw new Error('aborted')
        return text('Done.')
      }
      return text('Again.')
    })
    let done = idle()
    desk.say('count to a million')
    await new Promise((r) => setTimeout(r, 10))
    await desk.stop()
    await done
    expect(world.lines({ kinds: ['replied'] }).map((l) => l.words)).toEqual(['Stopped.'])
    // the next message resumes the same session with what was kept
    done = idle()
    desk.say('and now?')
    await done
    // the stopped turn kept the person's words with no answer; the API takes two user messages
    expect(world.messages(user.id).map((m) => m.role)).toEqual(['user', 'user', 'assistant'])
    desk.close()
    const { Limited } = await import('./loop.ts')
    const at = new Date(Date.now() + 60_000)
    const { desk: limited, idle: idle2 } = await deskOn(() => {
      throw new Limited('The usage limit for this key is reached for now.', at)
    })
    const d2 = idle2()
    limited.say('hello')
    await d2
    expect(world.lines({ kinds: ['limit'] }).map((l) => l.words)[0]).toMatch(
      /usage window is closed until/,
    )
    limited.close()
  })

  it('refuses a key that is not there, and names what the route cannot do', async () => {
    const p = new ClaudeApiProvider(world, { key: () => null, userId: user.id })
    await expect(p.ask('x', 'y', {})).rejects.toThrow(/No API key is kept/)
    expect(p.can).toEqual({
      shell: false,
      files: false,
      web: false,
      subagents: false,
      structured: true,
    })
    expect(toolsOf).toBeTypeOf('function')
  })
})
