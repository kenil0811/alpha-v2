// Words that type themselves out, a character at a time, as Alpha says its first line. The final
// words hold their place from the first frame (ui-rules U3), drawn unseen under the typed ones, so
// nothing moves. All at once when `now` (reduced motion, a second visit); a click or a key skips to
// the end. onDone once the last character is there.
import { useEffect, useState } from 'react'

export function Typing({
  text,
  now = false,
  ms = 30,
  onDone,
}: {
  text: string
  now?: boolean
  ms?: number
  onDone?: () => void
}) {
  const still =
    now ||
    (typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const [n, setN] = useState(still ? text.length : 0)
  const done = n >= text.length
  useEffect(() => {
    if (done) return
    const t = setInterval(() => setN((x) => x + 1), ms)
    const skip = () => setN(text.length)
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    return () => {
      clearInterval(t)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [done, ms, text.length])
  useEffect(() => {
    if (done && text) onDone?.()
  }, [done, text, onDone])
  return (
    <span className="grid">
      <span className="sr-only">{text}</span>
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {text}
      </span>
      <span aria-hidden className="col-start-1 row-start-1">
        {text.slice(0, n)}
      </span>
    </span>
  )
}
