// The mic beside every chat box (Vikas, 25 Nov): a click listens and writes what is said into the
// box, after what is there already; a second click, or a pause the browser hears as the end, stops
// it. The browser's own speech to text, so nothing new is installed; where the browser has none the
// button says so. Nothing is sent: the words wait in the box for Send.
import { Mic, MicOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from './cn.ts'

// the few parts of the browser's speech recognition this uses (not in every TypeScript dom lib)
interface Heard {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}
interface Listener {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: Heard) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start: () => void
  stop: () => void
}
type ListenerMaker = new () => Listener

const maker = (): ListenerMaker | null => {
  const w = window as unknown as {
    SpeechRecognition?: ListenerMaker
    webkitSpeechRecognition?: ListenerMaker
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// what was there, then what is heard, one space between
export const joined = (before: string, heard: string) => {
  const h = heard.trim()
  if (!h) return before
  return !before || /\s$/.test(before) ? before + h : `${before} ${h}`
}

export function MicButton({
  words,
  onWords,
  className,
}: {
  words: string
  onWords: (w: string) => void
  className?: string
}) {
  const [listening, setListening] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const listener = useRef<Listener | null>(null)
  useEffect(() => () => listener.current?.stop(), [])
  const Make = maker()
  const start = () => {
    if (!Make) return
    const l = new Make()
    const before = words
    l.continuous = true
    l.interimResults = true
    l.lang = navigator.language
    l.onresult = (e) => {
      let heard = ''
      for (let i = 0; i < e.results.length; i++) heard += e.results[i]?.[0]?.transcript ?? ''
      onWords(joined(before, heard))
    }
    l.onerror = (e) =>
      setProblem(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'The browser was not allowed the mic'
          : e.error === 'no-speech'
            ? 'Nothing was heard'
            : 'Voice input stopped',
      )
    l.onend = () => {
      setListening(false)
      listener.current = null
    }
    listener.current = l
    setProblem(null)
    setListening(true)
    l.start()
  }
  const tip = !Make
    ? 'This browser has no voice input'
    : listening
      ? 'Stop listening'
      : (problem ?? 'Speak instead of typing')
  return (
    <button
      type="button"
      aria-label={listening ? 'Stop listening' : 'Voice input'}
      aria-pressed={listening}
      data-tip={tip}
      disabled={!Make}
      onClick={() => (listening ? listener.current?.stop() : start())}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-35',
        listening ? 'bg-bad-soft text-bad' : 'text-ink-3 hover:bg-hover hover:text-ink',
        problem && !listening && 'text-bad',
        className,
      )}
    >
      {problem && !listening ? (
        <MicOff className="size-4" />
      ) : (
        <Mic className={cn('size-4', listening && 'animate-pulse')} />
      )}
    </button>
  )
}
