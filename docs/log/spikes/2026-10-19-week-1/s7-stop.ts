// Spike 8 (asked in the plan as "Stop interrupts the turn"): the person's Stop mid-turn, then the
// same live session carries on with their next sentence.
import { query } from '@anthropic-ai/claude-agent-sdk'
import { base, drain, home, inbox } from './common.ts'

const box = inbox()
const q = query({
  prompt: box,
  options: base(home('s7'), { allowedTools: ['Bash'], permissionMode: 'dontAsk' }),
})
box.push('Run `for i in 1 2 3 4 5 6 7 8; do echo $i; sleep 3; done` with Bash, then say "done counting".')
setTimeout(() => {
  console.log('  -> Stop pressed')
  q.interrupt().then((r) => console.log('  interrupt answered:', JSON.stringify(r)))
}, 8000)
const one = await drain(q, 'counting')
console.log('first turn ended:', one.result?.subtype, one.result?.terminal_reason)
box.push('Say "still here" and nothing else.')
const two = await drain(q, 'after')
console.log('second turn:', two.result?.result)
box.close()
