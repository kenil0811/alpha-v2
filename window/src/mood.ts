// Alpha's mood, as its face shows it (ui-rules L24): something waits on the person, it is working,
// its last line could not finish, or quiet. The last thing waiting on the person, answered by them,
// gets one small burst (L26).
import type { Stream } from '@alpha/core/api'
import { useEffect, useRef } from 'react'
import type { Mood } from './Face.tsx'
import { celebrate, justPressed } from './ui/motion.ts'

export function useMood(stream: Stream | null, busy: boolean): Mood {
  const waitingNow = stream?.cards.length ?? 0
  const waitedBefore = useRef(waitingNow)
  useEffect(() => {
    if (waitedBefore.current > 0 && waitingNow === 0 && justPressed()) celebrate()
    waitedBefore.current = waitingNow
  }, [waitingNow])
  const last = stream?.lines.at(-1)?.kind
  if (waitingNow) return 'needs'
  if (busy || stream?.busy) return 'working'
  return last === 'error' || last === 'refused' ? 'failed' : 'quiet'
}
