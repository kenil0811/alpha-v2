// Spike 3: the permission callback, and a gated call deferred on its card, resumed in a new
// process (the core restarted) with the card's answer.
//   node s2-defer.ts callback          the callback asked: allow once, deny once
//   node s2-defer.ts defer             the hook defers; prints the session to resume
//   node s2-defer.ts resume <id> yes   a new process resumes; the hook allows
//   node s2-defer.ts resume <id> no    a new process resumes; the hook denies
//   node s2-defer.ts stream            a long-lived session: defer, then the answer pushed in
import {
  createSdkMcpServer,
  type HookCallback,
  query,
  tool,
} from '@anthropic-ai/claude-agent-sdk'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { base, drain, home, inbox } from './common.ts'

const [mode = 'defer', session, answer] = process.argv.slice(2)
const ran: string[] = []
const world = createSdkMcpServer({
  name: 'alpha',
  version: '0.0.0',
  alwaysLoad: process.env.ALWAYS_LOAD === '1',
  tools: [
    tool(
      'rows_remove',
      'Remove rows from one of the person\'s tables.',
      { table: z.string(), ids: z.array(z.number()) },
      async ({ table, ids }) => {
        ran.push(`${table}:${ids.join(',')}`)
        return { content: [{ type: 'text', text: `removed ${ids.length} row(s) from ${table}` }] }
      },
    ),
  ],
})
const STATE = join(import.meta.dirname, 'homes', 's2-state.json')
const ASK = 'Remove row 7 from my meals table. I asked for it; do it now.'

function gate(decide: () => 'defer' | 'allow' | 'deny'): HookCallback {
  return async (input) => {
    if (input.hook_event_name !== 'PreToolUse' || input.tool_name !== 'mcp__alpha__rows_remove')
      return {}
    const d = decide()
    console.log(`  hook PreToolUse ${input.tool_name} id=${input.tool_use_id} -> ${d}`)
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: d,
        ...(d === 'deny' ? { permissionDecisionReason: 'The person said no: nothing changed.' } : {}),
      },
    }
  }
}

if (mode === 'callback') {
  let n = 0
  const q = query({
    prompt: `${ASK} Then remove row 8 too, in a separate call.`,
    options: base(home('s2cb'), {
      mcpServers: { alpha: world },
      permissionMode: 'default',
      canUseTool: async (name, input) => {
        n += 1
        console.log(`  canUseTool #${n} ${name} ${JSON.stringify(input)}`)
        return n === 1
          ? { behavior: 'allow', updatedInput: input }
          : { behavior: 'deny', message: 'The person said no: nothing changed.' }
      },
    }),
  })
  const { result } = await drain(q, 'callback')
  console.log('ran:', ran, 'result:', result?.subtype)
} else if (mode === 'defer') {
  const cwd = home('s2')
  const q = query({
    prompt: ASK,
    options: base(cwd, {
      mcpServers: { alpha: world },
      allowedTools: ['mcp__alpha__rows_remove'],
      permissionMode: 'dontAsk',
      hooks: { PreToolUse: [{ hooks: [gate(() => 'defer')] }] },
    }),
  })
  const { result } = await drain(q, 'defer')
  writeFileSync(STATE, JSON.stringify({ cwd, session: result?.session_id }))
  console.log('ran:', ran, 'session:', result?.session_id)
} else if (mode === 'resume') {
  const { cwd, session: kept } = JSON.parse(readFileSync(STATE, 'utf8'))
  const id = session === 'last' ? kept : session
  const box = inbox()
  box.push(answer === 'yes' ? 'Yes, remove it.' : 'No, keep it.')
  const q = query({
    prompt: process.env.STREAM === '1' ? box : answer === 'yes' ? 'Yes, remove it.' : 'No, keep it.',
    options: base(cwd, {
      resume: id,
      debugFile: join(import.meta.dirname, 'homes', 's2-debug.txt'),
      mcpServers: { alpha: world },
      allowedTools: ['mcp__alpha__rows_remove'],
      permissionMode: 'dontAsk',
      hooks: { PreToolUse: [{ hooks: [gate(() => (answer === 'yes' ? 'allow' : 'deny'))] }] },
    }),
  })
  const { result } = await drain(q, `resume-${answer}`)
  console.log('ran:', ran, 'result:', result?.subtype)
  box.close()
} else if (mode === 'stream') {
  let card: 'waiting' | 'yes' = 'waiting'
  const box = inbox()
  const q = query({
    prompt: box,
    options: base(home('s2s'), {
      mcpServers: { alpha: world },
      allowedTools: ['mcp__alpha__rows_remove'],
      permissionMode: 'dontAsk',
      hooks: { PreToolUse: [{ hooks: [gate(() => (card === 'yes' ? 'allow' : 'defer'))] }] },
    }),
  })
  box.push(ASK)
  const first = await drain(q, 'stream-1')
  console.log('after first result, ran:', ran, 'deferred:', first.result?.deferred_tool_use?.id)
  card = 'yes'
  box.push('Yes, remove it.')
  const second = await drain(q, 'stream-2')
  console.log('after the answer, ran:', ran, 'result:', second.result?.subtype)
  box.close()
}
