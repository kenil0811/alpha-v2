// Room for a panel beside the page (Batch A, picks 2 and 3, Kenil's yes 1 Nov): a row, a task, a
// run or a person opens beside the page while the assistant is open, when the window holds the
// rail, the page's 600px (A5), the panel's 320px and the assistant. Without that room the panel
// gives way and the assistant stays (his call 3).
import type { Layout } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { STRIP } from './ui/edge.tsx' // a folded rail: its strip

const RAIL = 216
const PAGE = 600 // A5: the screen always keeps 600px
export const BESIDE = 320 // a panel beside the page
const ASSISTANT = 320

// What the rail and the assistant take, beside the page's 600px.
function taken(layout: Layout, asking: boolean): number {
  const rail = layout.railFolded ? STRIP : (layout.railWidth ?? RAIL)
  // a closed assistant takes nothing: its face sits in the bar
  const assistant = asking ? Math.max(ASSISTANT, layout.panel ?? ASSISTANT) : 0
  return rail + PAGE + assistant
}

export function roomBeside(window: number, layout: Layout, asking: boolean): boolean {
  return taken(layout, asking) + BESIDE <= window
}

// How wide a page opened beside starts: wide enough for a task's or a run's own page where the
// window has the room, never past it.
export function besideWidth(window: number, layout: Layout, asking: boolean): number {
  return Math.max(BESIDE, Math.min(WIDE, window - taken(layout, asking)))
}
const WIDE = 480

// The window's width as it is resized.
export function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const on = () => setWidth(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return width
}
