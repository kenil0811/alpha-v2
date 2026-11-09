// One act of the person on a control (a switch, Run now, Disconnect): the control is busy while
// the core answers, a refusal is kept in words and shown beside the control, and the screen loads
// again either way (item 29 of the problems list, 25 Oct). Before this, a refusal was dropped and
// the click looked like it did nothing.
import { useCallback, useRef, useState } from 'react'
import { wordsOf } from '../api.ts'

export interface Act {
  busy: boolean // an act is under way
  on: string | null // what the last act was on (a row, a schedule), when it said
  problem: string | null // the refusal's words, until the next act
  act: (fn: () => Promise<unknown>, on?: string) => Promise<boolean>
}

export function useAct(onDone?: () => void): Act {
  const [busy, setBusy] = useState(false)
  const [on, setOn] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const done = useRef(onDone)
  done.current = onDone
  const act = useCallback(async (fn: () => Promise<unknown>, what?: string) => {
    setBusy(true)
    setOn(what ?? null)
    setProblem(null)
    let ok = true
    try {
      await fn()
    } catch (err) {
      ok = false
      setProblem(wordsOf(err))
    }
    setBusy(false)
    done.current?.()
    return ok
  }, [])
  return { busy, on, problem, act }
}

// The refusal's words beside the control, when there are any.
export function Refusal({ words }: { words: string | null }) {
  return words ? <span className="min-w-0 text-sm text-warn">{words}</span> : null
}
