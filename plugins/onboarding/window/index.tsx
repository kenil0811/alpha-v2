// Onboarding's screens in the window (Kenil's yes 2 Nov): its page at #/p/onboarding and its row on
// Home while something of it waits. Built only from the window's kit, so it looks and acts as the
// window's own screens do; removing the plugin's folder removes both.
import { Group, Line, LoaderCircle, type Screen, Sparkles } from '@alpha/window/kit'
import { useEffect, useState } from 'react'
import { Page } from './Page.tsx'
import { onboarding } from './routes.ts'

interface Home {
  state: 'start' | 'looking' | 'waiting' | 'done'
  waits?: { lines: number; questions: number; routines: number; suggestions: number }
}

// "11 lines, 4 questions and 6 suggestions wait for you".
export function waitWords(w: NonNullable<Home['waits']>): string {
  const parts = [
    [w.lines, 'line'],
    [w.questions, 'question'],
    [w.routines, 'routine'],
    [w.suggestions, 'suggestion'],
  ]
    .filter(([n]) => Number(n) > 0)
    .map(([n, one]) => `${n} ${one}${n === 1 ? '' : 's'}`)
  const said = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]
  const one = parts.length === 1 && parts[0]?.startsWith('1 ')
  return `${said} ${one ? 'waits' : 'wait'} for you`
}

function Waiting() {
  const [home, setHome] = useState<Home | null>(null)
  useEffect(() => {
    onboarding.get<Home>('/home').then(setHome, () => setHome(null))
  }, [])
  if (!home || home.state === 'done') return null
  return (
    <Group title="Let Alpha get to know you">
      <Line
        icon={
          home.state === 'looking' ? (
            <LoaderCircle className="size-3.5 animate-spin text-ink-3" />
          ) : (
            <Sparkles className="size-3.5 text-accent" />
          )
        }
        head={
          home.state === 'start' ? 'Start' : home.state === 'looking' ? 'Looking' : 'Waits for you'
        }
        words={
          home.state === 'start'
            ? 'Alpha reads what you allow on this Mac and learns what it can about your work, for your yes.'
            : home.state === 'looking'
              ? 'Alpha is looking closer at what you allowed.'
              : waitWords(home.waits ?? { lines: 0, questions: 0, routines: 0, suggestions: 0 })
        }
        href="#/p/onboarding"
      />
    </Group>
  )
}

export const screen: Screen = {
  name: 'onboarding',
  title: 'Let Alpha get to know you',
  Page,
  Waiting,
}
