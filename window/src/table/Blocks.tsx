// A row's document as open blocks (Vikas, 27 Oct): the centre of a row's own page. Each line of
// its notes is a block — text, a heading, a to-do, a bullet, a numbered line, a quote, a divider —
// edited where it stands. Return makes the next block, Backspace on an empty one takes it away,
// "/" on an empty block picks a kind, and Markdown's own starts ("# ", "- ", "[] ", "> ", "1. ",
// "---") turn a block into that kind as they are typed. A block drags by its handle. What is kept
// is Markdown, as the notes always were, saved a moment after typing stops.
import { GripVertical, Plus } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../ui/cn.ts'
import { MenuItem, Popover } from '../ui/popover.tsx'

export type Kind = 'p' | 'h1' | 'h2' | 'h3' | 'todo' | 'done' | 'bullet' | 'number' | 'quote' | 'hr'
export interface Block {
  id: number
  kind: Kind
  text: string
}

const STARTS: [RegExp, Kind][] = [
  [/^### /, 'h3'],
  [/^## /, 'h2'],
  [/^# /, 'h1'],
  [/^- \[[xX]\] /, 'done'],
  [/^- \[ \] /, 'todo'],
  [/^\[\] /, 'todo'],
  [/^[-*] /, 'bullet'],
  [/^\d+\. /, 'number'],
  [/^> /, 'quote'],
]
const MARKS: Record<Kind, string> = {
  p: '',
  h1: '# ',
  h2: '## ',
  h3: '### ',
  todo: '- [ ] ',
  done: '- [x] ',
  bullet: '- ',
  number: '1. ',
  quote: '> ',
  hr: '---',
}
const NAMES: [Kind, string][] = [
  ['p', 'Text'],
  ['h1', 'Heading'],
  ['h2', 'Subheading'],
  ['h3', 'Small heading'],
  ['todo', 'To-do'],
  ['bullet', 'Bullet'],
  ['number', 'Numbered'],
  ['quote', 'Quote'],
  ['hr', 'Divider'],
]

let next = 1
const block = (kind: Kind, text = ''): Block => ({ id: next++, kind, text })

// Markdown to blocks and back: one block a line, blank lines between paragraphs dropped.
export function toBlocks(md: string): Block[] {
  const out = md
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) return block('hr')
      for (const [re, kind] of STARTS) if (re.test(l)) return block(kind, l.replace(re, ''))
      return block('p', l)
    })
  return out.length ? out : [block('p')]
}
export function toMarkdown(blocks: Block[]): string {
  let n = 0
  return blocks
    .filter((b) => b.kind === 'hr' || b.text.trim())
    .map((b, i, all) => {
      n = b.kind === 'number' ? n + 1 : 0
      const line = b.kind === 'number' ? `${n}. ${b.text}` : `${MARKS[b.kind]}${b.text}`
      // a paragraph or heading stands apart; lines of one list run together
      const prev = all[i - 1]
      const together = prev && LIST.has(prev.kind) && LIST.has(b.kind)
      return i === 0 || together ? line : `\n${line}`
    })
    .join('\n')
}
const LIST = new Set<Kind>(['todo', 'done', 'bullet', 'number'])

const LOOK: Record<Kind, string> = {
  p: 'text-base leading-relaxed',
  h1: 'font-serif text-2xl mt-4',
  h2: 'font-serif text-xl mt-3',
  h3: 'font-semibold text-lg mt-2',
  todo: 'text-base leading-relaxed',
  done: 'text-base leading-relaxed text-ink-3 line-through',
  bullet: 'text-base leading-relaxed',
  number: 'text-base leading-relaxed',
  quote: 'text-base leading-relaxed italic text-ink-2',
  hr: '',
}

export function Blocks({
  value,
  onSave,
  opens,
}: {
  value: string
  onSave: ((md: string) => Promise<boolean>) | undefined // none: read only
  opens: (url: string) => string // a mention's link, to where it opens
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => toBlocks(value))
  const [focus, setFocus] = useState<number | null>(null)
  const [menu, setMenu] = useState<number | null>(null) // the block "/" was typed in
  const [dragged, setDragged] = useState<number | null>(null)
  const kept = useRef(value)
  const boxes = useRef(new Map<number, HTMLTextAreaElement>())
  const rows = useRef(new Map<number, HTMLDivElement>())
  // a change from elsewhere (Alpha wrote the notes) comes in while no block is being typed in
  useEffect(() => {
    if (value !== kept.current && focus === null) {
      kept.current = value
      setBlocks(toBlocks(value))
    }
  }, [value, focus])
  // saved a moment after typing stops, once per pause
  useEffect(() => {
    if (!onSave) return
    const md = toMarkdown(blocks)
    if (md === kept.current) return
    const t = setTimeout(() => {
      kept.current = md
      void onSave(md)
    }, 700)
    return () => clearTimeout(t)
  }, [blocks, onSave])
  useEffect(() => {
    if (focus !== null) boxes.current.get(focus)?.focus()
  }, [focus])

  const set = (id: number, change: Partial<Block>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...change } : b)))
  const after = (id: number, b: Block) => {
    setBlocks((bs) => {
      const i = bs.findIndex((x) => x.id === id)
      return [...bs.slice(0, i + 1), b, ...bs.slice(i + 1)]
    })
    setFocus(b.id)
  }
  const type = (b: Block, text: string) => {
    if (text === '/' && !b.text) return setMenu(b.id)
    if (/^(-{3}|\*{3})$/.test(text)) {
      set(b.id, { kind: 'hr', text: '' })
      return after(b.id, block('p'))
    }
    if (b.kind === 'p')
      for (const [re, kind] of STARTS)
        if (re.test(text)) return set(b.id, { kind, text: text.replace(re, '') })
    set(b.id, { text })
  }
  const keys = (e: KeyboardEvent<HTMLTextAreaElement>, b: Block, i: number) => {
    const el = e.currentTarget
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // an empty list line ends the list
      if (!b.text && b.kind !== 'p') return set(b.id, { kind: 'p' })
      const rest = b.text.slice(el.selectionEnd)
      set(b.id, { text: b.text.slice(0, el.selectionStart) })
      const kind: Kind = b.kind === 'done' ? 'todo' : LIST.has(b.kind) ? b.kind : 'p'
      return after(b.id, block(kind, rest))
    }
    if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (b.kind !== 'p') {
        e.preventDefault()
        return set(b.id, { kind: 'p' })
      }
      const prev = blocks[i - 1]
      if (!prev || blocks.length === 1) return
      e.preventDefault()
      setBlocks((bs) =>
        bs
          .filter((x) => x.id !== b.id)
          .map((x) => (x.id === prev.id ? { ...x, text: x.text + b.text } : x)),
      )
      setFocus(prev.id)
    }
    if (e.key === 'ArrowUp' && el.selectionStart === 0) {
      const prev = blocks
        .slice(0, i)
        .reverse()
        .find((x) => x.kind !== 'hr')
      if (prev) {
        e.preventDefault()
        setFocus(prev.id)
      }
    }
    if (e.key === 'ArrowDown' && el.selectionEnd === el.value.length) {
      const nxt = blocks.slice(i + 1).find((x) => x.kind !== 'hr')
      if (nxt) {
        e.preventDefault()
        setFocus(nxt.id)
      }
    }
    if (e.key === 'Escape') el.blur()
  }
  const move = (from: number, to: number) =>
    setBlocks((bs) => {
      const b = bs.find((x) => x.id === from)
      if (!b || from === to) return bs
      const rest = bs.filter((x) => x.id !== from)
      const at = rest.findIndex((x) => x.id === to)
      return [...rest.slice(0, at), b, ...rest.slice(at)]
    })
  let n = 0

  return (
    <div className="flex flex-col">
      {blocks.map((b, i) => {
        n = b.kind === 'number' ? n + 1 : 0
        const editing = focus === b.id && !!onSave
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: a block is a drop place while one drags; its handle is the way in
          <div
            key={b.id}
            ref={(el) => {
              if (el) rows.current.set(b.id, el)
              else rows.current.delete(b.id)
            }}
            onDragOver={(e) => dragged !== null && e.preventDefault()}
            onDrop={() => dragged !== null && move(dragged, b.id)}
            className={cn(
              'group/b relative -ml-12 flex items-start gap-1 pl-12',
              dragged === b.id && 'opacity-40',
            )}
          >
            {onSave && (
              <div className="absolute top-1 left-2 flex opacity-0 transition-opacity group-hover/b:opacity-100">
                <button
                  type="button"
                  aria-label="Add a block below"
                  data-tip="Add a block below"
                  onClick={() => after(b.id, block('p'))}
                  className="grid size-5 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink"
                >
                  <Plus className="size-3.5" />
                </button>
                <button
                  type="button"
                  draggable
                  aria-label="Drag to move, click for its kind"
                  data-tip="Drag to move; click to turn it into another kind"
                  onDragStart={() => setDragged(b.id)}
                  onDragEnd={() => setDragged(null)}
                  onClick={() => setMenu(b.id)}
                  className="grid size-5 cursor-grab place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink"
                >
                  <GripVertical className="size-3.5" />
                </button>
              </div>
            )}
            {b.kind === 'hr' ? (
              <hr className="my-3 w-full border-line" />
            ) : (
              <>
                {(b.kind === 'todo' || b.kind === 'done') && (
                  <input
                    type="checkbox"
                    aria-label={b.kind === 'done' ? 'Done' : 'Not done'}
                    checked={b.kind === 'done'}
                    disabled={!onSave}
                    onChange={(e) => set(b.id, { kind: e.target.checked ? 'done' : 'todo' })}
                    className="mt-1.5 size-4 shrink-0 accent-accent"
                  />
                )}
                {b.kind === 'bullet' && (
                  <span className="mt-0.5 w-5 shrink-0 text-center text-ink-3">•</span>
                )}
                {b.kind === 'number' && (
                  <span className="mt-0.5 w-5 shrink-0 text-right text-ink-3 tabular-nums">
                    {n}.
                  </span>
                )}
                {b.kind === 'quote' && (
                  <span className="mr-2 w-0.5 shrink-0 self-stretch rounded-full bg-line" />
                )}
                {editing ? (
                  <textarea
                    ref={(el) => {
                      if (el) boxes.current.set(b.id, el)
                      else boxes.current.delete(b.id)
                    }}
                    aria-label="A block of the document"
                    value={b.text}
                    rows={1}
                    onChange={(e) => type(b, e.target.value)}
                    onKeyDown={(e) => keys(e, b, i)}
                    onBlur={() => setTimeout(() => setFocus((f) => (f === b.id ? null : f)), 0)}
                    placeholder={
                      b.kind === 'p'
                        ? 'Write, or type / for a kind of block'
                        : NAMES.find((x) => x[0] === b.kind)?.[1]
                    }
                    className={cn(
                      'field-sizing-content min-h-7 w-full resize-none bg-transparent py-0.5 text-ink outline-none placeholder:text-ink-3',
                      LOOK[b.kind],
                    )}
                  />
                ) : (
                  // biome-ignore lint/a11y/noStaticElementInteractions: a click starts typing in the block; Tab reaches its handle
                  // biome-ignore lint/a11y/useKeyWithClickEvents: as above
                  <div
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a')) return
                      if (onSave) setFocus(b.id)
                    }}
                    className={cn(
                      'min-h-7 w-full cursor-text py-0.5 text-ink [&_a]:text-accent [&_a]:hover:underline [&_p]:inline',
                      LOOK[b.kind],
                      !b.text && 'text-ink-3',
                    )}
                  >
                    {b.text ? (
                      <Markdown remarkPlugins={[remarkGfm]} urlTransform={opens}>
                        {b.text}
                      </Markdown>
                    ) : blocks.length === 1 && onSave ? (
                      'Write, or type / for a kind of block'
                    ) : (
                      ' '
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
      {onSave && (
        // biome-ignore lint/a11y/noStaticElementInteractions: the space under the last block; Add a block below is the keyboard way
        // biome-ignore lint/a11y/useKeyWithClickEvents: as above
        <div
          className="h-16 cursor-text"
          onClick={() => {
            const last = blocks.at(-1)
            if (last && last.kind === 'p' && !last.text) setFocus(last.id)
            else if (last) after(last.id, block('p'))
          }}
        />
      )}
      <Popover
        anchor={{ current: menu !== null ? (rows.current.get(menu) ?? null) : null }}
        open={menu !== null}
        onClose={() => setMenu(null)}
      >
        <div role="menu" className="flex min-w-44 flex-col p-1">
          {NAMES.map(([kind, name]) => (
            <MenuItem
              key={kind}
              onClick={() => {
                const id = menu
                setMenu(null)
                if (id === null) return
                set(id, {
                  kind,
                  text: blocks.find((x) => x.id === id)?.text.replace(/^\/$/, '') ?? '',
                })
                if (kind === 'hr') after(id, block('p'))
                else setFocus(id)
              }}
            >
              {name}
            </MenuItem>
          ))}
        </div>
      </Popover>
    </div>
  )
}
