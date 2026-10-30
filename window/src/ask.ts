// Start the assistant with words, unsent: the panel opens and the words wait in its composer for
// the person to finish and send. Kept here until a composer takes them, since a folded panel has
// none yet.
import type { InterviewView } from '@alpha/core/api'
import { useCallback, useEffect, useState } from 'react'
import { api, Problem, wordsOf } from './api.ts'

let waiting: string | null = null

export function startAsk(words: string) {
  waiting = words
  showAsk()
}

// Open the assistant's panel, on what was just said to it.
export function showAsk() {
  window.dispatchEvent(new Event('alpha:ask'))
}

// Add new… in a dropdown: ask Alpha for one more choice, in words, and show the assistant, where
// its question or its card follows.
export async function askForNew(what: string, to: string, words: string) {
  await api.post('/api/say', { words: `Add a new ${what} to ${to}: ${words}` })
  showAsk()
}

export function takeAsk(): string | null {
  const w = waiting
  waiting = null
  return w
}

// Interview me (Vikas, 30 Oct): Alpha's questions, the most useful first, as many as are worth
// asking; never a fixed prompt or count. Start asks the first in the conversation; with the pool
// not ranked today it is ranked first, and the button says it is preparing until it is.
export function useInterview(module: string | null) {
  const [view, setView] = useState<InterviewView | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const path = `/api/interview${module ? `?module=${encodeURIComponent(module)}` : ''}`
  const look = useCallback(
    () =>
      api
        .get<InterviewView>(path)
        .then((v) => {
          setView(v)
          return v
        })
        .catch(() => null),
    [path],
  )
  useEffect(() => {
    void look()
  }, [look])
  const start = async () => {
    setProblem(null)
    try {
      const said = () => api.post<{ preparing: boolean }>('/api/interview', { module })
      let out = await said()
      if (out.preparing) {
        setPreparing(true)
        // ponytail: polls every 2s, at most 3 minutes; a live event when runs end would do better
        for (let i = 0; i < 90 && out.preparing; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          const v = await look()
          if (v?.today && !v.preparing) out = await said()
        }
        setPreparing(false)
        if (out.preparing) throw new Problem('The questions are still being prepared; try again.')
      }
      void look()
      showAsk()
    } catch (err) {
      setPreparing(false)
      setProblem(wordsOf(err))
    }
  }
  const busy = preparing || !!view?.preparing
  const tip = busy
    ? 'Preparing today’s questions…'
    : view?.today
      ? view.left
        ? `A few questions today, starting with the most useful: ${view.first}`
        : 'Nothing worth asking today'
      : 'Not prepared yet today: Alpha prepares the questions first'
  return { view, busy, start, tip, problem }
}
