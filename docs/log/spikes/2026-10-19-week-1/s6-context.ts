// Spike 7: where context lands.
//   node s6-context.ts layers     SessionStart and UserPromptSubmit in a live session, then /compact
//   node s6-context.ts snapshot   is the appended prompt kept from the first turn on resume?
import { type HookCallback, query } from '@anthropic-ai/claude-agent-sdk'
import { base, drain, home, inbox } from './common.ts'

const mode = process.argv[2] ?? 'layers'

if (mode === 'snapshot') {
  const cwd = home('s6snap')
  const ask = 'What is the marker word in your instructions? Answer with the word only.'
  for (const snapshot of [undefined, false] as const) {
    const first = query({
      prompt: ask,
      options: base(cwd, {
        systemPrompt: { type: 'preset', preset: 'claude_code', append: 'The marker word is KESTREL.', ...(snapshot === false ? { snapshot } : {}) },
      }),
    })
    const one = await drain(first, `snap=${snapshot ?? 'default'} first`)
    const again = query({
      prompt: ask,
      options: base(cwd, {
        resume: one.result?.session_id,
        systemPrompt: { type: 'preset', preset: 'claude_code', append: 'The marker word is OSPREY.', ...(snapshot === false ? { snapshot } : {}) },
      }),
    })
    const two = await drain(again, `snap=${snapshot ?? 'default'} resumed`)
    console.log(`snapshot=${snapshot ?? 'default'}: first said ${one.result?.result}; resumed with OSPREY said ${two.result?.result}`)
  }
} else {
  const fired: string[] = []
  let turn = 0
  const start: HookCallback = async (input) => {
    if (input.hook_event_name !== 'SessionStart') return {}
    fired.push(`SessionStart:${input.source}`)
    console.log(`  hook SessionStart source=${input.source}`)
    return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `Start layer (${input.source}): the person's tables are Meals with 3 rows.` } }
  }
  const perTurn: HookCallback = async (input) => {
    if (input.hook_event_name !== 'UserPromptSubmit') return {}
    turn += 1
    fired.push(`UserPromptSubmit:${turn}`)
    console.log(`  hook UserPromptSubmit #${turn} source=${input.source} prompt=${JSON.stringify(input.prompt).slice(0, 60)}`)
    return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: `Per-turn layer: this is turn ${turn}; the clock says 21:${10 + turn}.` } }
  }
  const compact: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreCompact') return {}
    fired.push(`PreCompact:${input.trigger}`)
    console.log(`  hook PreCompact trigger=${input.trigger}`)
    return { systemMessage: 'Keep the person\'s own words about what they track.' }
  }
  const box = inbox()
  const q = query({
    prompt: box,
    options: base(home('s6'), {
      hooks: {
        SessionStart: [{ hooks: [start] }],
        UserPromptSubmit: [{ hooks: [perTurn] }],
        PreCompact: [{ hooks: [compact] }],
      },
    }),
  })
  const say = async (text: string, tag: string) => {
    box.push(text)
    const { result } = await drain(q, tag)
    console.log(`  -> ${tag}: ${result?.result}`)
  }
  await say('In one line: what does the start layer say, and what turn and clock does the per-turn layer say?', 't1')
  await say('Same question again, one line.', 't2')
  await say('/compact', 'compact')
  await say('After that: what does the start layer say now, and what turn does the per-turn layer say? One line.', 't3')
  box.close()
  console.log('fired:', fired.join(', '))
}
