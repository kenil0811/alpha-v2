// Start the assistant with words, unsent: the panel opens and the words wait in its composer for
// the person to finish and send. Kept here until a composer takes them, since a folded panel has
// none yet.

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, Problem, wordsOf } from './api.ts'
import type { InterviewView } from './coming.ts'

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
// asking; never a fixed prompt or count. The button only says what is prepared; the sitting runs
// in the Interviewer's thread under Agents, which useSitting drives.
export function useInterview(module: string | null) {
  const [view, setView] = useState<InterviewView | null>(null)
  const path = `/api/interview${module ? `?module=${encodeURIComponent(module)}` : ''}`
  useEffect(() => {
    api.get<InterviewView>(path).then(setView, () => undefined)
  }, [path])
  const busy = !!view?.preparing
  const tip = busy
    ? 'Preparing today’s questions…'
    : view?.today
      ? view.left
        ? `A few questions today, starting with the most useful: ${view.first}`
        : 'Nothing worth asking today'
      : 'Not prepared yet today: Alpha prepares the questions first'
  return { view, busy, tip }
}

// The Interviewer's thread (Vikas, 30 Oct: "Interview me should take me to the Agents page with
// one of the agents named Interviewer"): a skill of Alpha's shown as an agent, by this id.
export const INTERVIEWER = { id: 'interviewer', name: 'Interviewer' } as const
let sitting: { module: string | null } | null = null

// Interview me, from Home (module: null) or a module's Overview: open the Interviewer's thread,
// which starts the sitting, scoped to the module.
export function interviewMe(module: string | null) {
  sitting = { module }
  const at = `#/conversation/${INTERVIEWER.id}`
  if (window.location.hash === at) window.dispatchEvent(new Event('alpha:interview'))
  else window.location.hash = at
}

// The sitting asked for, once: the Interviewer's thread takes it when it opens.
export function takeSitting(): { module: string | null } | null {
  const s = sitting
  sitting = null
  return s
}

// Start a sitting: with the pool not ranked today it is ranked first, and the thread says
// Preparing… with Stop until the first question is in. Stop stops waiting and the thread says so.
export function useSitting() {
  const [preparing, setPreparing] = useState<{ module: string | null } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const run = useRef(0)
  const start = useCallback(async (module: string | null) => {
    const me = ++run.current
    const live = () => run.current === me
    setProblem(null)
    setPreparing({ module })
    const said = () => api.post<{ preparing: boolean }>('/api/interview', module ? { module } : {})
    try {
      let out = await said()
      // ponytail: polls every 2s, at most 3 minutes; a live event when the pool is ranked would do better
      for (let i = 0; i < 90 && out.preparing && live(); i++) {
        await new Promise((r) => setTimeout(r, 2000))
        if (!live()) return
        const v = await api.get<InterviewView>('/api/interview')
        if (v.today && !v.preparing && live()) out = await said()
      }
      if (out.preparing && live())
        throw new Problem('The questions are still being prepared; try again.')
    } catch (err) {
      if (live()) setProblem(wordsOf(err))
    } finally {
      if (live()) setPreparing(null)
    }
  }, [])
  const stop = useCallback(() => {
    if (!preparing) return
    run.current++
    setPreparing(null)
    void api
      .post('/api/interview/stop', preparing.module ? { module: preparing.module } : {})
      .catch((err) => setProblem(wordsOf(err)))
  }, [preparing])
  return { preparing: !!preparing, problem, start, stop }
}
