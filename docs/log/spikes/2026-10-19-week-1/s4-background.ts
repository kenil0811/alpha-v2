// Spike 5: longer work as a background subagent; does its outcome reach the long-lived desk on
// its own, and does the desk say it in its own words without a new message from the person?
import { query } from '@anthropic-ai/claude-agent-sdk'
import { base, home, inbox, line, t0 } from './common.ts'

const box = inbox()
const q = query({
  prompt: box,
  options: base(home('s4'), {
    allowedTools: ['Agent', 'Bash'],
    permissionMode: 'dontAsk',
  }),
})
box.push(
  'Start a background agent (the Agent tool with run_in_background set) whose whole job is: run `for i in 1 2 3 4 5; do sleep 4; done; echo ok` with Bash, then reply with the single word PELICAN. Tell me in one line that you started it. Do not wait for it.',
)
const at = t0()
let results = 0
const deadline = Date.now() + 120_000
let timer: NodeJS.Timeout | undefined
const timeout = new Promise<'timeout'>((r) => {
  timer = setTimeout(() => r('timeout'), 120_000)
})
while (Date.now() < deadline) {
  const step = await Promise.race([q.next(), timeout])
  if (step === 'timeout' || step.done) break
  const m = step.value
  const l = line(m)
  if (l && !l.includes('thinking_tokens')) console.log(`[s4 ${at()}] ${l}`)
  if (m.type === 'result') {
    results += 1
    if (results === 2) break
  }
}
clearTimeout(timer)
console.log(`results seen: ${results}`)
box.close()
