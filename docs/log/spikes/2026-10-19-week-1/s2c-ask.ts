// Spike 3, the alternative: the gate refuses the call with words saying it waits on a card; the
// turn ends naturally; the yes comes as a message (in the same live session, or after a restart)
// and the call made again runs, because a yes card matches it.
//   node s2c-ask.ts live       answer pushed into the same session
//   node s2c-ask.ts restart    answer pushed into a resumed session in a new query
import { createSdkMcpServer, type HookCallback, query, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { base, drain, home, inbox } from './common.ts'

const mode = process.argv[2] ?? 'live'
const ran: string[] = []
const world = createSdkMcpServer({
  name: 'alpha',
  version: '0.0.0',
  alwaysLoad: true,
  tools: [
    tool(
      'rows_remove',
      "Remove rows from one of the person's tables.",
      { table: z.string(), ids: z.array(z.number()) },
      async ({ table, ids }) => {
        ran.push(`${table}:${ids.join(',')}`)
        return { content: [{ type: 'text', text: `removed ${ids.length} row(s) from ${table}` }] }
      },
    ),
  ],
})

// The card: a row keyed by the call's name and input.
const cards = new Map<string, 'waiting' | 'yes'>()
const gate: HookCallback = async (input) => {
  if (input.hook_event_name !== 'PreToolUse' || input.tool_name !== 'mcp__alpha__rows_remove') return {}
  const key = `${input.tool_name} ${JSON.stringify(input.tool_input)}`
  const state = cards.get(key)
  if (state === 'yes') {
    cards.delete(key)
    console.log(`  gate: yes card matches -> allow`)
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } }
  }
  cards.set(key, 'waiting')
  console.log(`  gate: card made (${key}) -> deny`)
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        'Not done yet: this waits for the person\'s yes on a card in their window. You will be told when they answer.',
    },
  }
}

const cwd = home('s2c')
const opts = (resume?: string) =>
  base(cwd, {
    mcpServers: { alpha: world },
    allowedTools: ['mcp__alpha__rows_remove'],
    permissionMode: 'dontAsk',
    hooks: { PreToolUse: [{ hooks: [gate] }] },
    ...(resume ? { resume } : {}),
  })
const ANSWER = 'The person said yes on the card: remove row 7 from the meals table.'

const box = inbox()
const q = query({ prompt: box, options: opts() })
box.push('Remove row 7 from my meals table, the one I logged by mistake.')
const one = await drain(q, 'ask')
console.log('after the ask, ran:', ran)
if (mode === 'live') {
  for (const k of cards.keys()) cards.set(k, 'yes')
  box.push(ANSWER)
  await drain(q, 'answer-live')
  box.close()
} else {
  box.close()
  await drain(q, 'close', 'end')
  for (const k of cards.keys()) cards.set(k, 'yes')
  const box2 = inbox()
  const q2 = query({ prompt: box2, options: opts(one.result?.session_id) })
  box2.push(ANSWER)
  await drain(q2, 'answer-restart')
  box2.close()
}
console.log('ran:', ran)
