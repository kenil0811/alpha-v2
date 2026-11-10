// Keeping a growing conversation in view: an eased scroll to the end while you are at the end, which
// lets go the moment you scroll up and takes hold again when you come back down. While it first
// draws it is put at its end at once, so it opens there with no scroll to watch.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const dims = (el: HTMLElement) => `${el.scrollHeight}:${el.clientHeight}:${el.clientWidth}`
const SETTLE_MS = 1500 // how long a conversation that has just opened is still drawing

export function useFollow(conversation: string, loaded: boolean, opensAtEnd = true) {
  const scroller = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const ours = useRef(-1) // where this code last put the scroll, to tell it from the person's
  const seen = useRef(0) // where the scroll was at the last event, to tell up from down
  const frame = useRef(0)
  const size = useRef('') // the box's heights at the last event: a change is the layout's, not theirs
  const settling = useRef(0) // until when it is still drawing after it opened
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
    size.current = dims(el)
    frame.current = requestAnimationFrame(step)
  }, [])

  const follow = useCallback(() => {
    const el = scroller.current
    if (!el || !pinned.current) return
    // still drawing after it opened: at its end at once, before the screen is drawn
    if (performance.now() < settling.current) {
      cancelAnimationFrame(frame.current)
      frame.current = 0
      el.scrollTop = el.scrollHeight
      ours.current = el.scrollTop
      seen.current = el.scrollTop
      size.current = dims(el)
      return
    }
    if (!frame.current) frame.current = requestAnimationFrame(step)
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
    // watched again once the conversation has loaded: before that its boxes are not there, and what
    // drew after the first look went unfollowed, so it opened short of its end
  }, [follow, conversation, loaded])

  // a conversation opens at its end, with no scroll to watch
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    pinned.current = opensAtEnd
    settling.current = opensAtEnd ? performance.now() + SETTLE_MS : 0
    if (opensAtEnd) el.scrollTop = el.scrollHeight
    ours.current = el.scrollTop
    seen.current = el.scrollTop
    size.current = dims(el)
    setAway(false)
  }, [conversation, loaded])

  const onScroll = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const top = el.scrollTop
    const before = seen.current
    seen.current = top
    if (Math.abs(top - ours.current) < 1) return
    // the box or what is in it changed size (a panel sliding open, a reply drawing): the browser
    // moved the scroll, not the person, so the end is followed still
    const now = dims(el)
    if (now !== size.current) {
      size.current = now
      if (pinned.current) follow()
      return
    }
    const gap = el.scrollHeight - el.clientHeight - top
    // any move upward is the person's, however small; coming back near the end picks up again
    const atEnd = gap < 2 || (top > before && gap < 40)
    if (atEnd === pinned.current) return
    pinned.current = atEnd
    if (!atEnd) settling.current = 0
    setAway(!atEnd)
    if (!atEnd && frame.current) {
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [follow])

  const toLatest = useCallback(() => {
    pinned.current = true
    setAway(false)
    follow()
  }, [follow])

  return { scroller, content, onScroll, away, toLatest }
}
