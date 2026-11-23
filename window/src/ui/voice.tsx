// A microphone inside a text box: what the person says is typed after what is there (Vikas, 23 Nov).
// Only where the browser can hear (Chrome, Safari); elsewhere it is not drawn.
import { Mic } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from './cn.ts'

interface Ear {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
const Hearing =
  typeof window === 'undefined'
    ? undefined
    : (window as { webkitSpeechRecognition?: new () => Ear }).webkitSpeechRecognition

export function Voice({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (words: string) => void
  className?: string
}) {
  const [on, setOn] = useState(false)
  const ear = useRef<Ear | null>(null)
  useEffect(() => () => ear.current?.stop(), [])
  if (!Hearing) return null
  const listen = () => {
    if (on) return ear.current?.stop()
    const e = new Hearing()
    e.lang = navigator.language
    e.interimResults = true
    e.continuous = true
    const typed = value.trimEnd()
    e.onresult = (r) => {
      const said = Array.from(r.results, (x) => x[0]?.transcript ?? '').join('')
      onChange([typed, said.trim()].filter(Boolean).join(' '))
    }
    e.onend = () => setOn(false)
    ear.current = e
    e.start()
    setOn(true)
  }
  return (
    <button
      type="button"
      aria-label={on ? 'Stop listening' : 'Speak'}
      aria-pressed={on}
      data-tip={on ? 'Stop listening' : 'Speak'}
      onClick={listen}
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-full',
        on ? 'animate-pulse bg-bad-soft text-bad' : 'text-ink-3 hover:bg-hover hover:text-ink',
        className,
      )}
    >
      <Mic className="size-3.5" />
    </button>
  )
}
