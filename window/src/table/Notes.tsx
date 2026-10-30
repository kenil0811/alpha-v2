// A row's notes (core step 3b): Markdown, read as it is written, with a person or a row mentioned
// as a link. Write opens a plain text box; typing @ and a few letters offers people and rows
// to mention, from the same finder as ⌘K. It saves when you leave the box or press Done, so a
// version is one edit, not a keystroke. No rich-text editor: Markdown is what is kept.
import type { FoundRow } from '@alpha/core/api'
import { Pencil } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../api.ts'
import { Button } from '../ui/button.tsx'
import { Popover } from '../ui/popover.tsx'

// A mention's link, as notes keep it, to where it opens in the window.
export const opens = (url: string) =>
  url.startsWith('person:')
    ? `#/people/${url.slice(7)}`
    : url.startsWith('row:')
      ? `#/row/${url.slice(4)}`
      : /^(https?:|mailto:)/.test(url)
        ? url
        : ''

// What ⌘K's finder found, as a mention: a person by their page, a row by its own.
function mention(f: FoundRow): string | null {
  const person = /^#\/people\/([\w-]+)$/.exec(f.href)
  if (person) return `[@${f.label}](person:${person[1]})`
  const row = /^#\/table\/[\w-]+\/([\w-]+)$/.exec(f.href)
  return row ? `[${f.label}](row:${row[1]})` : null
}

export function Notes({
  value,
  onSave,
}: {
  value: string
  onSave: ((text: string) => Promise<boolean>) | undefined // none: read only here
}) {
  const [writing, setWriting] = useState(false)
  const [text, setText] = useState(value)
  const [found, setFound] = useState<FoundRow[]>([])
  const box = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!writing) setText(value)
  }, [value, writing])
  // the word after an @ being typed, if the caret is on one
  const asking = () => {
    const el = box.current
    if (!el) return null
    const before = el.value.slice(0, el.selectionStart)
    const m = /(^|\s)@([^\s@[\]()]{2,})$/.exec(before)
    return m ? { at: before.length - (m[2]?.length ?? 0) - 1, words: m[2] ?? '' } : null
  }
  const look = () => {
    const a = asking()
    if (!a) return setFound([])
    api.get<FoundRow[]>(`/api/find?words=${encodeURIComponent(a.words)}`).then(
      (f) => setFound(f.filter((x) => mention(x)).slice(0, 6)),
      () => setFound([]),
    )
  }
  const pick = (f: FoundRow) => {
    const a = asking()
    const m = mention(f)
    const el = box.current
    if (!a || !m || !el) return
    const caret = el.selectionStart
    setText(`${el.value.slice(0, a.at)}${m} ${el.value.slice(caret)}`)
    setFound([])
    requestAnimationFrame(() => el.focus())
  }
  const done = async () => {
    setFound([])
    if (text === value) return setWriting(false)
    if (!onSave || (await onSave(text))) setWriting(false)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setText(value)
      setWriting(false)
    }
  }
  if (!writing)
    return (
      <div className="flex flex-col gap-2">
        {value.trim() ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: a double-click writes, as everywhere; Edit is the keyboard's way
          <div
            onDoubleClick={(e) => onSave && !(e.target as Element).closest('a') && setWriting(true)}
            className="flex flex-col gap-2 text-md leading-relaxed [&_a]:text-accent [&_a]:hover:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
          >
            <Markdown
              remarkPlugins={[remarkGfm]}
              urlTransform={opens}
              components={{
                a: ({ href, children }) =>
                  href?.startsWith('#') ? (
                    <a href={href}>{children}</a>
                  ) : (
                    <a href={href} target="_blank" rel="noreferrer">
                      {children}
                    </a>
                  ),
              }}
            >
              {value}
            </Markdown>
          </div>
        ) : (
          <p className="text-ink-3 text-md">No notes yet.</p>
        )}
        {onSave && (
          <Button size="sm" variant="ghost" className="w-fit" onClick={() => setWriting(true)}>
            <Pencil className="size-3.25" />
            {value.trim() ? 'Edit' : 'Write'}
          </Button>
        )}
      </div>
    )
  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={box}
        // biome-ignore lint/a11y/noAutofocus: Write opens the box to type in
        autoFocus
        aria-label="Notes"
        value={text}
        rows={Math.min(16, Math.max(5, text.split('\n').length + 1))}
        onChange={(e) => setText(e.target.value)}
        onKeyUp={look}
        onKeyDown={onKey}
        onBlur={() => {
          // a pick from the list keeps the box; leaving it otherwise saves
          setTimeout(() => {
            if (document.activeElement !== box.current && !found.length) void done()
          }, 150)
        }}
        placeholder="Write here; type @ and a name to mention a person or a row"
        className="w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-md leading-relaxed outline-none focus:border-accent-line"
      />
      {/* against the window, never clipped by the panel that scrolls (S7) */}
      <Popover anchor={box} open={found.length > 0} onClose={() => setFound([])}>
        {found.map((f) => (
          <button
            key={f.href}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(f)}
            className="flex w-72 items-center justify-between gap-3 rounded-sm px-2.5 py-1.5 text-left text-md hover:bg-hover"
          >
            <span className="truncate text-ink">{f.label}</span>
            <span className="shrink-0 text-ink-3 text-sm">{f.hint}</span>
          </button>
        ))}
      </Popover>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={() => void done()}>
          Done
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setText(value)
            setWriting(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
