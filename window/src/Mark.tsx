// The pencil (Vikas, 25 Oct): click it, click anything on screen (a cell, a row, a tab, a chart),
// and a small box opens there for a comment. The comment goes to Alpha with what was marked,
// in words: the page, and for a table cell its table, row, column and value.
import { Pencil } from 'lucide-react'
import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api, Problem } from './api.ts'
import { startAsk } from './ask.ts'
import type { Module } from './stream.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { stripItem, stripName } from './ui/edge.tsx'

export function startMark() {
  window.dispatchEvent(new Event('alpha:mark'))
}

export function MarkButton({ labelled = false }: { labelled?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation() // the folded strip opens on a click
        startMark()
      }}
      aria-label="Mark something and comment"
      data-tip="Mark something and comment"
      className={
        labelled
          ? stripItem()
          : 'grid size-7.5 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink'
      }
    >
      <Pencil className="size-4" />
      {/* on the folded strip, named under its icon (Batch E, 79.3) */}
      {labelled && <span className={stripName}>Mark</span>}
    </button>
  )
}

// an element's words as the screen shows them, a space between its parts (its text alone runs a
// heading into the line under it)
const words = (el: Element | null | undefined) =>
  el ? ((el as HTMLElement).innerText ?? el.textContent) : null

const short = (s: string | null | undefined, n = 80) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

// what a person would call the thing they clicked
export function describe(el: Element): string {
  // the rail's place, then the module's tab
  const where = [
    ...document.querySelectorAll('[aria-current="page"], [role="tab"][aria-selected="true"]'),
  ]
    .map((a) => short(a.getAttribute('aria-label') || words(a), 40))
    .filter((w, i, all) => w && all.indexOf(w) === i)
  const page = `${where.join(' › ') || 'this screen'} (${window.location.hash || '#/'})`
  const cell = el.closest('td, th')
  const table = cell?.closest('table')
  if (cell && table) {
    const col = (cell as HTMLTableCellElement).cellIndex
    const column = short(words(table.querySelector('thead tr')?.children[col]), 40)
    const row = cell.parentElement as HTMLTableRowElement
    const name = short(words(row.cells[1]), 60) // cell 0 is the row's number
    if (cell.tagName === 'TH') return `On ${page}: the column “${column}”`
    return `On ${page}: the row “${name}”${column ? `, column “${column}”, value “${short(words(cell))}”` : ''}`
  }
  const named = el.closest('[aria-label], [title], button, a, h1, h2, h3, label')
  const label = short(
    named?.getAttribute('aria-label') || named?.getAttribute('title') || words(el),
  )
  const heading = short(
    words(el.closest('section, aside, [role="dialog"]')?.querySelector('h1, h2, h3')),
    60,
  )
  return `On ${page}${heading ? `, in “${heading}”` : ''}: “${label || el.tagName.toLowerCase()}”`
}

type Picked = { what: string; box: DOMRect }

// The comment box stays fully on screen (Vikas, 1 Nov: it was cut off at the edge): under what was
// marked, else over it, else inside the window's height; its left edge on the marked thing's,
// shifted in from either side. `size` is the box as drawn, `view` the window.
const GAP = 8
type Edges = { top: number; bottom: number; left: number }
type Size = { width: number; height: number }
export function boxAt(box: Edges, size: Size, view: Size): { top: number; left: number } {
  const fit = (at: number, own: number, room: number) =>
    Math.max(GAP, Math.min(at, room - own - GAP))
  const under = box.bottom + GAP
  const over = box.top - GAP - size.height
  const top =
    under + size.height <= view.height - GAP
      ? under
      : over >= GAP
        ? over
        : fit(box.top + GAP, size.height, view.height)
  return { top, left: fit(box.left, size.width, view.width) }
}

// Mounted once: marking starts on the pencil and ends on a send, Cancel or Escape.
export function Marker({ from }: { from: Module | null }) {
  const [on, setOn] = useState(false)
  const [over, setOver] = useState<DOMRect | null>(null)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [words, setWords] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const own = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(170) // about the box's height, until it is drawn

  const stop = () => {
    setOn(false)
    setOver(null)
    setPicked(null)
    setWords('')
    setProblem(null)
  }

  useEffect(() => {
    const begin = () => {
      setPicked(null)
      setOn(true)
    }
    window.addEventListener('alpha:mark', begin)
    return () => window.removeEventListener('alpha:mark', begin)
  }, [])

  useEffect(() => {
    if (!on) return
    const mine = (t: EventTarget | null) => t instanceof Node && !!own.current?.contains(t)
    const move = (e: PointerEvent) => {
      if (picked || mine(e.target) || !(e.target instanceof Element)) return
      setOver(e.target.getBoundingClientRect())
    }
    // while choosing, a click marks instead of doing what it would
    const hold = (e: Event) => {
      if (picked || mine(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      if (e.type === 'click' && e.target instanceof Element)
        setPicked({ what: describe(e.target), box: e.target.getBoundingClientRect() })
    }
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault() // the assistant keeps its width
      e.stopPropagation()
      stop()
    }
    window.addEventListener('pointermove', move, true)
    for (const t of ['pointerdown', 'mousedown', 'mouseup', 'click'])
      window.addEventListener(t, hold, true)
    window.addEventListener('keydown', key, true)
    return () => {
      window.removeEventListener('pointermove', move, true)
      for (const t of ['pointerdown', 'mousedown', 'mouseup', 'click'])
        window.removeEventListener(t, hold, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [on, picked])

  // the box's real height (a problem line makes it taller), so it is placed by what it is
  useLayoutEffect(() => {
    const h = boxRef.current?.offsetHeight
    if (h && h !== height) setHeight(h)
  })

  if (!on) return null

  const send = async () => {
    const comment = words.trim()
    if (!picked || !comment) return
    try {
      await api.post('/api/say', {
        words: `${picked.what}\n\n${comment}`,
        ...(from ? { from: from.id } : {}),
      })
      stop()
      startAsk('') // opens the assistant on the answer
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not reach Alpha.')
    }
  }
  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }
  const shown = picked?.box ?? over
  const W = 320
  return (
    <div ref={own}>
      {/* while marking, the window dims a little and the outline glides from one thing to the
          next, so marking is never missed (Batch D, 79.12, Kenil's yes 2 Nov) */}
      {!shown && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-(--z-pop) bg-ink/10"
        />
      )}
      {shown && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-(--z-pop) rounded-sm shadow-[0_0_0_100vmax_color-mix(in_srgb,var(--ink)_10%,transparent)] outline-2 outline-accent outline-offset-1 transition-[top,left,width,height] duration-100"
          style={{ top: shown.top, left: shown.left, width: shown.width, height: shown.height }}
        />
      )}
      {!picked && (
        <div
          role="status"
          className="fixed top-2 left-1/2 z-(--z-pop) flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent bg-surface py-1 pr-1 pl-3 text-md shadow-pop ring-4 ring-accent-soft"
        >
          <Pencil className="size-3.5 text-accent" />
          Click anything to mark it
          <Button size="sm" variant="ghost" onClick={stop}>
            Stop (Esc)
          </Button>
        </div>
      )}
      {picked && (
        <div
          ref={boxRef}
          role="dialog"
          aria-label="Comment on what you marked"
          className={cn(
            'fixed z-(--z-pop) flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 shadow-pop',
          )}
          style={{
            width: W,
            ...boxAt(
              picked.box,
              { width: W, height },
              { width: window.innerWidth, height: window.innerHeight },
            ),
          }}
        >
          <p className="line-clamp-2 text-ink-3 text-sm">{picked.what}</p>
          <textarea
            // biome-ignore lint/a11y/noAutofocus: the box was opened to type in
            autoFocus
            rows={3}
            value={words}
            onChange={(e) => setWords(e.target.value)}
            onKeyDown={key}
            placeholder="Your comment for Alpha"
            aria-label="Your comment for Alpha"
            className="w-full resize-none rounded-md border border-line bg-surface px-2.5 py-1.5 text-ink text-md outline-none focus:border-accent-line focus:ring-3 focus:ring-accent-soft"
          />
          {problem && <p className="text-bad text-sm">{problem}</p>}
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={stop}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void send()} disabled={!words.trim()}>
              Send to Alpha
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
