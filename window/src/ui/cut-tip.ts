// Words cut short show whole in our tooltip, and only while they are cut (A4, T4). The tip is
// set as the pointer comes over them, before the tooltip looks, so words that fit say nothing more.
// anyway: there is more than shows even when nothing is cut (tags past the first two).
import type { PointerEvent } from 'react'

// Whether the words in an element, or in what it holds, run past its edge.
const cut = (el: Element): boolean => el.scrollWidth > el.clientWidth || [...el.children].some(cut)

export const cutTip = (words: string | null | undefined, anyway = false) => ({
  onPointerEnter: (e: PointerEvent<HTMLElement>) => {
    const el = e.currentTarget
    const short = anyway || cut(el) || el.scrollHeight > el.clientHeight + 1
    el.dataset.tip = words && short ? words : ''
  },
})
