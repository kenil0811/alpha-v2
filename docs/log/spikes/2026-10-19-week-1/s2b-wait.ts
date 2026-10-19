// Spike 3, second half.
//   node s2b-wait.ts resume     after a deferral, a new process resumes a live session: does it go on
//                               past the "unavailable" result when the answer is pushed in?
//   node s2b-wait.ts hold <s>   the callback holds the call <s> seconds (a card waiting), then allows
import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { base, drain, home, inbox } from './common.ts'

const [mode = 'resume', secs = '90'] = process.argv.slice(2)
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

if (mode === 'resume') {
  const { cwd, session } = JSON.parse(readFileSync(join(import.meta.dirname, 'homes', 's2-state.json'), 'utf8'))
  const box = inbox()
  const q = query({
    prompt: box,
    options: base(cwd, {
      resume: session,
      mcpServers: { alpha: world },
      allowedTools: ['mcp__alpha__rows_remove'],
      permissionMode: 'dontAsk',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse')
                  console.log(`  hook ${input.tool_name} id=${input.tool_use_id} -> allow`)
                return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } }
              },
            ],
          },
        ],
      },
    }),
  })
  box.push('The person answered the card: yes, remove it.')
  const one = await drain(q, 'resume-1')
  console.log('first result:', one.result?.terminal_reason, 'ran:', ran)
  if (one.result?.terminal_reason === 'tool_deferred_unavailable') {
    box.push('The person answered the card: yes, remove it.')
    const two = await drain(q, 'resume-2')
    console.log('second result:', two.result?.terminal_reason, 'ran:', ran)
  }
  box.close()
} else {
  const box = inbox()
  const q = query({
    prompt: box,
    options: base(home('s2hold'), {
      mcpServers: { alpha: world },
      permissionMode: 'default',
      canUseTool: async (name, input) => {
        console.log(`  canUseTool ${name}: holding ${secs}s as a card would`)
        await new Promise((r) => setTimeout(r, Number(secs) * 1000))
        console.log('  the card says yes')
        return { behavior: 'allow', updatedInput: input }
      },
    }),
  })
  box.push('Remove row 7 from my meals table. I asked for it; do it now.')
  const { result } = await drain(q, 'hold')
  console.log('result:', result?.terminal_reason, 'ran:', ran)
  box.push('Thanks. Say "still here" if this session is still alive.')
  const again = await drain(q, 'hold-2')
  console.log('second turn:', again.result?.result)
  box.close()
}
