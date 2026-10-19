// Spike 6: connector tools a few at a time through tool search. Two dummy connectors with 60
// tools between them, loaded on demand (or all up front, to compare tokens).
//   node s5-toolsearch.ts search | upfront
import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { base, drain, home, OWN_TOOLS } from './common.ts'

const mode = process.argv[2] ?? 'search'
const called: string[] = []
function connector(name: string, verbs: string[], things: string[]) {
  const tools = []
  for (const v of verbs)
    for (const t of things)
      tools.push(
        tool(`${t}_${v}`, `${v} ${t.replace(/_/g, ' ')} in the person's ${name}.`, { query: z.string().optional() }, async (a) => {
          called.push(`${name}.${t}_${v}(${JSON.stringify(a)})`)
          return {
            content: [
              {
                type: 'text',
                text:
                  t === 'events' && v === 'list'
                    ? 'Tomorrow 09:30 Coffee with Priya; 11:00 Broker call (Harbor Capital)'
                    : 'nothing found',
              },
            ],
          }
        }),
      )
  return createSdkMcpServer({ name, version: '0.0.0', alwaysLoad: mode === 'upfront', tools })
}
const gmail = connector('gmail', ['list', 'get', 'send', 'draft', 'label', 'archive'], ['messages', 'threads', 'drafts', 'labels', 'filters'])
const calendar = connector('calendar', ['list', 'get', 'create', 'update', 'delete', 'respond'], ['events', 'calendars', 'attendees', 'reminders', 'rooms'])

const q = query({
  prompt: "What's on my calendar tomorrow morning? Answer in one line.",
  options: base(home('s5'), {
    mcpServers: { gmail, calendar },
    allowedTools: ['mcp__gmail', 'mcp__calendar'],
    permissionMode: 'dontAsk',
    tools: [...OWN_TOOLS, 'ToolSearch'],
  }),
})
const { result, init } = await drain(q, `s5-${mode}`)
console.log('tools in init:', init?.tools.length, init?.tools.filter((t) => !t.startsWith('mcp__')).join(', '))
console.log('called:', called)
console.log('answer:', result?.result)
const u = result?.modelUsage ?? {}
for (const [m, v] of Object.entries(u))
  console.log(`usage ${m}: in=${v.inputTokens} cacheRead=${v.cacheReadInputTokens} cacheWrite=${v.cacheCreationInputTokens} out=${v.outputTokens}`)
