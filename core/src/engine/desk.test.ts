// The desk against a scripted session: never the model (CLAUDE.md). The script plays Claude
// Code's part: it calls the hooks the desk gave it and yields the messages a turn would.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySecrets } from '@alpha/connector-sdk'
import type { HookCallback, Options, Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadSet, STANDARD_DIR } from '../connectors/discover.ts'
import { ConnectorService } from '../connectors/service.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'
import { Desk, type DeskEvent, fileWall, type QueryFn } from './desk.ts'

let home: string
let world: World
let user: User

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-desk-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const msg = (m: Record<string, unknown>) => m as unknown as SDKMessage
const result = (text: string, more: Record<string, unknown> = {}) =>
  msg({
    type: 'result',
    subtype: 'success',
    result: text,
    terminal_reason: 'completed',
    duration_ms: 10,
    num_turns: 1,
    total_cost_usd: 0,
    modelUsage: {},
    session_id: 's_1',
    ...more,
  })

type Turn = (text: string, hooks: Hooks) => Promise<SDKMessage[]>

interface Hooks {
  call: (event: 'PreToolUse', input: Record<string, unknown>) => Promise<Record<string, unknown>>
  interrupted: Promise<void>
}

function scripted(turn: Turn) {
  const seen: { options?: Options; contexts: string[] } = { contexts: [] }
  const fn: QueryFn = ({ prompt, options }) => {
    seen.options = options
    let interrupt = () => {}
    const interrupted = () => new Promise<void>((r) => (interrupt = r))
    const run = (event: string, input: Record<string, unknown>) => {
      const hook = options.hooks?.[event as 'PreToolUse']?.[0]?.hooks[0] as HookCallback
      return hook(
        {
          hook_event_name: event,
          session_id: 's_1',
          transcript_path: '',
          cwd: '',
          ...input,
        } as never,
        undefined,
        { signal: new AbortController().signal },
      ) as Promise<Record<string, unknown>>
    }
    async function* gen() {
      yield msg({ type: 'system', subtype: 'init', session_id: 's_1' })
      for await (const m of prompt) {
        const text = m.message.content as string
        const out = (await run('UserPromptSubmit', { prompt: text })) as {
          hookSpecificOutput?: { additionalContext?: string }
        }
        seen.contexts.push(out.hookSpecificOutput?.additionalContext ?? '')
        for (const x of await turn(text, {
          call: run as Hooks['call'],
          interrupted: interrupted(),
        }))
          yield x
      }
    }
    const g = gen()
    return Object.assign(g, {
      interrupt: async () => {
        interrupt()
        return undefined
      },
      close: () => void g.return(undefined),
    }) as unknown as Query
  }
  return { fn, seen }
}

function deskWith(turn: Turn, connectors?: ConnectorService) {
  const { fn, seen } = scripted(turn)
  const events: DeskEvent[] = []
  const waiters: (() => void)[] = []
  const desk = new Desk(world, user, {
    query: fn,
    ...(connectors ? { connectors } : {}),
    emit: (e) => {
      events.push(e)
      if (e.type === 'idle') waiters.shift()?.()
    },
  })
  const idle = () => new Promise<void>((r) => waiters.push(r))
  return { desk, seen, events, idle }
}

describe('the file walls', () => {
  it('let the desk write in its folder and the modules, never a module.yaml, and read what was granted', () => {
    const d = (tool: string, file_path: string) =>
      fileWall(tool, { file_path }, '/home/desk', '/home/modules', ['/granted']).allow
    expect(d('Write', '/home/desk/notes.md')).toBe(true)
    expect(d('Edit', '/home/modules/rentals/skills/reader/run.js')).toBe(true)
    expect(d('Write', '/home/modules/rentals/module.yaml')).toBe(false)
    expect(d('Edit', '/home/modules/rentals/module.yaml')).toBe(false)
    expect(d('Write', '/granted/anything.txt')).toBe(false)
    expect(d('Read', '/granted/anything.txt')).toBe(true)
    expect(d('Read', '/elsewhere/secret')).toBe(false)
  })
})

describe('the desk', () => {
  it('answers sentences in order, with the start layer on a fresh session’s first message only', async () => {
    const { desk, seen, idle } = deskWith(async (text) => [result(`heard: ${text}`)])
    const both = Promise.all([idle(), idle()])
    desk.say('track what I eat')
    desk.say('log two eggs')
    await both
    const replies = world
      .lines({ kinds: ['said', 'replied'] })
      .map((l) => [l.kind, l.words, l.turn])
    const [said1, said2] = world.lines({ kinds: ['said'] })
    expect(replies).toEqual([
      ['said', 'track what I eat', null],
      ['said', 'log two eggs', null],
      ['replied', 'heard: track what I eat', String(said1?.id)],
      ['replied', 'heard: log two eggs', String(said2?.id)],
    ])
    expect(seen.contexts[0]).toContain('# Alpha: where things stand')
    expect(seen.contexts[1]).not.toContain('# Alpha: where things stand')
    expect(seen.contexts[1]).toMatch(/^Now: /)
    expect(world.desk(user.id)?.sessionId).toBe('s_1')
    desk.close()
  })

  it('refuses a removal of the person’s own rows on a card, and lets it through on their yes', async () => {
    const m = world.shape.makeModule('Food', { actor: { kind: 'alpha' } })
    const t = world.shape.makeTable(m.id, 'Meals', [{ name: 'Food', kind: 'text' }], {
      actor: { kind: 'alpha' },
    })
    const said = world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'said',
      words: 'log two eggs',
      user: user.id,
    })
    const [row] = world.records.add(
      t.id,
      [{ values: { Food: 'eggs' }, provenance: { kind: 'stated' } }],
      {
        actor: { kind: 'alpha' },
        said: { message: said.id, user: user.id },
      },
    )
    const decisions: string[] = []
    const removal = (askedIn?: string) => ({
      tool_name: 'mcp__alpha__change',
      tool_use_id: `call_${decisions.length}`,
      tool_input: { table: 'Meals', remove: [row], ...(askedIn ? { asked_in: askedIn } : {}) },
    })
    const { desk, idle } = deskWith(async (text, hooks) => {
      const askedIn = text.startsWith('remove the eggs') ? 'remove the eggs' : undefined
      const out = (await hooks.call('PreToolUse', removal(askedIn))) as {
        hookSpecificOutput: { permissionDecision: string }
      }
      decisions.push(out.hookSpecificOutput.permissionDecision)
      return [result('ok')]
    })

    let done = idle()
    desk.say('tidy up my meals')
    await done
    expect(decisions).toEqual(['deny'])
    const [card] = world.cards.waiting(user.id)
    expect(card?.words).toBe('Remove a row from Meals?')
    expect(card?.gate).toBe('deletes_own')

    done = idle()
    desk.cardAnswered(
      world.cards.answer(card?.id as string, 'Yes', { kind: 'person', id: user.id }),
    )
    await done
    expect(decisions).toEqual(['deny', 'allow'])
    expect(world.lines({ kinds: ['noticed'] }).map((l) => l.words)).toEqual([
      'Carrying on after your yes.',
    ])

    done = idle()
    desk.say('remove the eggs, I had toast')
    await done
    expect(decisions).toEqual(['deny', 'allow', 'allow'])
    expect(world.cards.waiting(user.id)).toHaveLength(0)
    desk.close()
  })

  it('stops a turn when the person says stop, and carries on after', async () => {
    const { desk, idle } = deskWith(async (text, hooks) => {
      if (text === 'count slowly') {
        await hooks.interrupted
        return [
          result('', {
            subtype: 'error_during_execution',
            terminal_reason: 'aborted_tools',
            errors: [],
          }),
        ]
      }
      return [result('still here')]
    })
    let done = idle()
    desk.say('count slowly')
    await new Promise((r) => setTimeout(r, 20))
    await desk.stop()
    await done
    done = idle()
    desk.say('are you there?')
    await done
    expect(world.lines({ kinds: ['replied'] }).map((l) => l.words)).toEqual([
      'Stopped.',
      'still here',
    ])
    desk.close()
  })

  it('waits on a card showing the whole email before a send, and saves a draft at once', async () => {
    const connectors = new ConnectorService(world, {
      secrets: new MemorySecrets(),
      known: (await loadSet(STANDARD_DIR)).connectors,
    })
    const mail = { to: 'priya@harbor.example', subject: 'The CIM', body: 'Could you send it over?' }
    const decisions: string[] = []
    const { desk, idle } = deskWith(async (text, hooks) => {
      for (const tool of ['draft', 'send']) {
        const out = (await hooks.call('PreToolUse', {
          tool_name: `mcp__gmail__${tool}`,
          tool_use_id: `call_${decisions.length}`,
          tool_input: mail,
        })) as { hookSpecificOutput: { permissionDecision: string } }
        decisions.push(`${tool}:${out.hookSpecificOutput.permissionDecision}`)
      }
      return [result(text)]
    }, connectors)
    let done = idle()
    desk.say('draft and send Priya a note asking for the CIM')
    await done
    expect(decisions).toEqual(['draft:allow', 'send:deny'])
    const [card] = world.cards.waiting(user.id)
    expect(card?.words).toBe('Send an email to priya@harbor.example: “The CIM”, a new recipient?')
    expect(card?.detail).toBe(
      'To: priya@harbor.example\nSubject: The CIM\n\nCould you send it over?',
    )
    expect(card?.gate).toBe('leaves_world')
    done = idle()
    desk.cardAnswered(
      world.cards.answer(card?.id as string, 'Yes', { kind: 'person', id: user.id }),
    )
    await done
    expect(decisions.slice(2)).toEqual(['draft:allow', 'send:allow'])
    desk.close()
  })
})
