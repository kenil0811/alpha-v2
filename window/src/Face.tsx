// Alpha's face: quiet, working, or something needs you. A stand-in until Alpha has a character.
// Its moods: it listens while you type to it, glances about while it thinks, nods with a wide smile
// when it has finished, tilts when it could not, and blinks back when clicked. With reduced motion it only changes expression.
import { useEffect, useRef, useState } from 'react'
import { cn } from './ui/cn.ts'

// failed: the last turn did not finish; it tilts until the next one
export type Mood = 'quiet' | 'working' | 'needs' | 'failed'
type Shown = Mood | 'listening' | 'done'

const DONE_MS = 1600
const LISTEN_MS = 1200

// Typing in any box marked data-composer (the assistant's, Home's ask) makes every face listen.
function useListening(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const typed = (e: Event) => {
      if (!(e.target instanceof Element) || !e.target.closest('[data-composer]')) return
      setOn(true)
      clearTimeout(t)
      t = setTimeout(() => setOn(false), LISTEN_MS)
    }
    document.addEventListener('input', typed)
    return () => {
      document.removeEventListener('input', typed)
      clearTimeout(t)
    }
  }, [])
  return on
}

// A moment of "done" as work turns quiet.
function useJustDone(mood: Mood): boolean {
  const was = useRef(mood)
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (was.current === 'working' && mood === 'quiet') {
      setDone(true)
      const t = setTimeout(() => setDone(false), DONE_MS)
      was.current = mood
      return () => clearTimeout(t)
    }
    was.current = mood
    if (mood !== 'quiet') setDone(false)
  }, [mood])
  return done
}

const MOUTH: Record<Exclude<Shown, 'needs'>, string> = {
  quiet: 'M43 59 Q50 66 57 59',
  listening: 'M43 59 Q50 68 57 59',
  working: 'M45 62 Q50 64 55 62',
  done: 'M41 58 Q50 70 59 58',
  failed: 'M44 63 Q50 61 56 63',
}

export function Face({ mood }: { mood: Mood }) {
  const listening = useListening()
  const done = useJustDone(mood)
  const [boop, setBoop] = useState(false)
  const shown: Shown =
    mood === 'working' || mood === 'needs' ? mood : done ? 'done' : listening ? 'listening' : mood
  const light = {
    quiet: 'var(--face-quiet)',
    listening: 'var(--face-busy)',
    working: 'var(--face-busy)',
    done: 'var(--good)',
    failed: 'var(--face-needs)',
    needs: 'var(--face-needs)',
  }[shown]
  const eyeY = shown === 'listening' ? 43 : 46
  const eyeRy = shown === 'needs' ? 8.5 : 7
  const look = shown === 'working' ? 3 : 0
  const ink = 'var(--face-ink)'
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      onPointerDown={() => {
        setBoop(true)
        setTimeout(() => setBoop(false), 320)
      }}
      className={cn(
        'size-full origin-center transition-[rotate,scale] duration-320 ease-spring',
        shown === 'done' && 'face-nod',
        shown === 'failed' && '-rotate-8',
        boop && 'face-boop',
      )}
    >
      <line x1="50" y1="16" x2="50" y2="8" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      <circle
        cx="50"
        cy="6.5"
        r="5"
        fill={light}
        stroke={ink}
        strokeWidth="2"
        className={cn('transition-[fill] duration-200', shown === 'working' && 'face-pulse')}
      />
      <rect
        x="12"
        y="15"
        width="76"
        height="70"
        rx="30"
        fill="var(--face)"
        stroke={ink}
        strokeWidth="2.6"
      />
      <ellipse cx="38" cy="26" rx="14" ry="5" fill="var(--face-shine)" opacity="0.28" />
      <g className={cn('face-eyes', shown === 'working' && 'face-glance')}>
        <g className={cn(shown !== 'needs' && 'face-blink')}>
          <ellipse cx={37 + look} cy={eyeY} rx="5.5" ry={eyeRy} fill={ink} />
          <ellipse cx={63 + look} cy={eyeY} rx="5.5" ry={eyeRy} fill={ink} />
        </g>
        <circle cx={39 + look} cy={eyeY - 3} r="1.8" fill="var(--face-shine)" />
        <circle cx={65 + look} cy={eyeY - 3} r="1.8" fill="var(--face-shine)" />
      </g>
      <ellipse cx="26" cy="60" rx="6" ry="3.6" fill="var(--face-cheek)" opacity="0.75" />
      <ellipse cx="74" cy="60" rx="6" ry="3.6" fill="var(--face-cheek)" opacity="0.75" />
      {shown === 'needs' ? (
        <ellipse cx="50" cy="63" rx="3.6" ry="4.2" fill={ink} />
      ) : (
        <path d={MOUTH[shown]} stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
    </svg>
  )
}
