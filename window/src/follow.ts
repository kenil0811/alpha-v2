// Keeping a growing conversation in view: an eased scroll to the end while you are at the end, which
// lets go the moment you scroll up and takes hold again when you come back down.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export function useFollow(conversation: string, loaded: boolean) {
  const scroller = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const ours = useRef(-1) // where this code last put the scroll, to tell it from the person's
  const seen = useRef(0) // where the scroll was at the last event, to tell up from down
  const frame = useRef(0)
  const [away, setAway] = useState(false)

  const step = useCallback(() => {
    frame.current = 0
    const el = scroller.current
    if (!el || !pinned.current) return
    const gap = el.scrollHeight - el.clientHeight - el.scrollTop
    if (gap <= 0.5) return
    el.scrollTop += Math.max(1, gap * 0.3)
    ours.current = el.scrollTop
    seen.current = el.scrollTop
    frame.current = requestAnimationFrame(step)
  }, [])

  const follow = useCallback(() => {
    if (pinned.current && !frame.current) frame.current = requestAnimationFrame(step)
  }, [step])

  useEffect(() => {
    const box = content.current
    const view = scroller.current
    if (!box || !view) return
    const watch = new ResizeObserver(follow)
    watch.observe(box)
    watch.observe(view) // the message box growing or shrinking moves the end too
    return () => {
      watch.disconnect()
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [follow])

  // a conversation opens at its end, with no scroll to watch
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    ours.current = el.scrollTop
    seen.current = el.scrollTop
    pinned.current = true
    setAway(false)
  }, [conversation, loaded])

  const onScroll = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const top = el.scrollTop
    const before = seen.current
    seen.current = top
    if (Math.abs(top - ours.current) < 1) return
    const gap = el.scrollHeight - el.clientHeight - top
    // any move upward is the person's, however small; coming back near the end picks up again
    const atEnd = gap < 2 || (top > before && gap < 40)
    if (atEnd === pinned.current) return
    pinned.current = atEnd
    setAway(!atEnd)
    if (!atEnd && frame.current) {
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [])

  const toLatest = useCallback(() => {
    pinned.current = true
    setAway(false)
    follow()
  }, [follow])

  return { scroller, content, onScroll, away, toLatest }
}
