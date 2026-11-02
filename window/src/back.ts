// Back returns to where you were (Batch A, pick 1, Kenil's yes 1 Nov): the places visited in this
// window, each with its screen's name, newest last. A tab switch inside a screen adds no place
// (his call 2). With nothing visited (a fresh start, a link), the bar's way back is the screen's
// parent, as before.
import { useEffect, useRef, useState } from 'react'
import { besideOf, splitBeside } from './opened.ts'

export interface Visit {
  hash: string
  name: string
}

const KEEP = 30

// A screen's own address, without the tab or list open on it: tabs inside a screen are one place.
// What is open beside it (opened.ts) is a step of its own, so Back closes it.
export function screenOf(address: string): string {
  const { base, trail } = splitBeside(address)
  return trail.length ? `${screenBase(base)}?beside=${besideOf(trail)}` : screenBase(base)
}

function screenBase(hash: string): string {
  const module = /^#\/module\/([^/?]+)/.exec(hash)
  if (module) return `#/module/${module[1]}`
  const table = /^#\/table\/([^/?]+)/.exec(hash)
  if (table && !/^#\/table\/[^/?]+\/[^/?]+/.test(hash)) return `#/table/${table[1]}`
  const section = /^#\/(settings|intelligence)\b/.exec(hash)
  if (section) return `#/${section[1]}`
  if (/^#\/tasks(\?|$)/.test(hash)) return '#/tasks'
  if (/^#\/people(\?|$)/.test(hash)) return '#/people'
  return hash.split('?')[0] || '#/'
}

// The places after leaving `from` for `to`: one more, unless it is the same screen.
export function visit(visits: Visit[], from: Visit, to: string): Visit[] {
  if (screenOf(from.hash) === screenOf(to)) return visits
  return [...visits, from].slice(-KEEP)
}

// Where Back goes: the newest place visited, or none.
export function backTo(visits: Visit[]): Visit | null {
  return visits.at(-1) ?? null
}

// The window's way back as the address changes: each screen left is kept with its name; going
// back takes the newest off and opens it.
export function useBack(hash: string, name: string): { to: Visit | null; go: () => void } {
  const [visits, setVisits] = useState<Visit[]>([])
  const was = useRef<Visit>({ hash, name })
  const returning = useRef(false)
  useEffect(() => {
    if (hash !== was.current.hash) {
      const from = was.current
      if (!returning.current) setVisits((v) => visit(v, from, hash))
      returning.current = false
    }
    was.current = { hash, name }
  }, [hash, name])
  const to = backTo(visits)
  return {
    to,
    go: () => {
      if (!to) return
      returning.current = true
      setVisits((v) => v.slice(0, -1))
      window.location.hash = to.hash
    },
  }
}
