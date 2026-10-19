// Spike 1 and 2: the subscription with no key in a bare environment; an in-process world tool;
// strict MCP and no setting sources, so the person's own connectors, plugins and skills stay out.
import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { base, drain, home } from './common.ts'

const calls: string[] = []
const world = createSdkMcpServer({
  name: 'alpha',
  version: '0.0.0',
  tools: [
    tool('note_add', 'Keep a note in the world.', { words: z.string() }, async ({ words }) => {
      calls.push(words)
      return { content: [{ type: 'text', text: `kept: ${words}` }] }
    }),
  ],
})

const cwd = home('s1')
const q = query({
  prompt: 'Keep a note that says "two eggs", then tell me in one line that you did.',
  options: base(cwd, {
    mcpServers: { alpha: world },
    allowedTools: ['mcp__alpha__note_add'],
    permissionMode: 'dontAsk',
  }),
})
const { result, init } = await drain(q, 's1')
console.log('apiKeySource:', init?.apiKeySource)
console.log('tools:', init?.tools.join(', '))
console.log('mcp_servers:', JSON.stringify(init?.mcp_servers))
console.log('slash_commands:', init?.slash_commands.join(', '))
console.log('skills:', JSON.stringify((init as { skills?: unknown })?.skills ?? null))
console.log('plugins:', JSON.stringify(init?.plugins ?? null))
console.log('agents:', JSON.stringify(init?.agents ?? null))
console.log('tool ran with:', calls)
console.log('ok:', result?.subtype)
