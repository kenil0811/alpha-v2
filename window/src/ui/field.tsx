// A field: one line of text, a choice, or the composer's words. Focus shows in the accent.

import { ChevronDown, Plus, Search } from 'lucide-react'
import {
  type ChangeEvent,
  Children,
  type FormEvent,
  type InputHTMLAttributes,
  isValidElement,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  useId,
  useRef,
  useState,
} from 'react'
import { api, wordsOf } from '../api.ts'
import { showAsk } from '../ask.ts'
import { Refusal } from './act.tsx'
import { Button } from './button.tsx'
import { cn } from './cn.ts'
import { MenuItem, MenuLine, Popover } from './popover.tsx'

const FIELD =
  'h-7.5 min-w-0 rounded-md border border-line bg-surface px-2.5 text-ink text-md outline-none transition-colors placeholder:text-ink-3 focus:border-accent-line focus:ring-3 focus:ring-accent-soft'

export function Field({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...props} />
}

type Option = { value: string; label: string; disabled: boolean }

// the <option>s a Select was given, through fragments and lists
function optionsOf(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((c): Option[] => {
    if (!isValidElement<{ value?: unknown; children?: ReactNode; disabled?: boolean }>(c)) return []
    if (c.type !== 'option') return optionsOf(c.props.children)
    const label = Children.toArray(c.props.children).join('')
    return [{ value: String(c.props.value ?? label), label, disabled: !!c.props.disabled }]
  })
}

// The ★ default kept under a key, in this browser only: the core has no place for it yet.
export function starred(key: string): string {
  try {
    return localStorage.getItem(`alpha.star.${key}`) ?? ''
  } catch {
    return ''
  }
}

function keepStar(key: string, value: string) {
  try {
    if (value) localStorage.setItem(`alpha.star.${key}`, value)
    else localStorage.removeItem(`alpha.star.${key}`)
  } catch {}
}

// One dropdown everywhere: a button that opens a short list, with a search
// line when there are more than five. Written as a <select> is, <option>s and onChange alike.
// With `starKey`, each line has a ★ that makes it the default, which sits first; with `adds`,
// Add new… at the foot asks the assistant for one more (a choice, to Stage in Deals).
export function Select({
  className,
  value,
  defaultValue,
  onChange,
  children,
  disabled,
  title,
  starKey,
  adds,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  starKey?: string // where the ★ default is kept
  adds?: { what: string; to: string } // what Add new… asks for, and where it goes
}) {
  const options = optionsOf(children)
  const [own, setOwn] = useState(String(defaultValue ?? options[0]?.value ?? ''))
  const now = value === undefined ? own : String(value)
  const [open, setOpen] = useState(false)
  const [words, setWords] = useState('')
  const [star, setStar] = useState(() => (starKey ? starred(starKey) : ''))
  const [asking, setAsking] = useState(false) // Add new…'s describe line is open
  const [ask, setAsk] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const shown = options
    .filter((o) => o.label.toLowerCase().includes(words.trim().toLowerCase()))
    .sort((a, b) => Number(!!star && b.value === star) - Number(!!star && a.value === star))
  const close = () => {
    setOpen(false)
    setWords('')
    setAsking(false)
    setAsk('')
    setProblem(null)
  }
  // the keyboard, as the browser's own select has it (UI batch 2, 26 Oct): arrows, Home and End
  // move, Return or Space picks, Escape closes, and typing jumps to an option that starts so
  const [hot, setHot] = useState(0)
  const typed = useRef({ words: '', at: 0 })
  const list = useId()
  const usable = (i: number) => i >= 0 && i < shown.length && !shown[i]?.disabled
  const step = (from: number, by: number) => {
    for (let i = from + by, n = 0; n < shown.length; i += by, n++) {
      const at = (i + shown.length) % shown.length
      if (usable(at)) return at
    }
    return from
  }
  const openAt = () => {
    const i = shown.findIndex((o) => o.value === now)
    setHot(usable(i) ? i : step(-1, 1))
    setOpen(true)
  }
  const keys = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openAt()
      }
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setHot((h) => step(h, e.key === 'ArrowDown' ? 1 : -1))
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setHot(e.key === 'Home' ? step(-1, 1) : step(shown.length, -1))
    } else if (e.key === 'Enter' || (e.key === ' ' && options.length <= 5)) {
      e.preventDefault()
      const o = shown[hot]
      if (o && !o.disabled) pick(o.value)
    } else if (options.length <= 5 && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      // no search line: letters jump to the first option that starts with what was typed
      const now = Date.now()
      typed.current = {
        words: (now - typed.current.at < 700 ? typed.current.words : '') + e.key.toLowerCase(),
        at: now,
      }
      const i = shown.findIndex(
        (o, j) => usable(j) && o.label.toLowerCase().startsWith(typed.current.words),
      )
      if (i >= 0) setHot(i)
    }
  }
  const pick = (v: string) => {
    setOwn(v)
    close()
    anchor.current?.focus()
    onChange?.({
      target: { value: v },
      currentTarget: { value: v },
    } as ChangeEvent<HTMLSelectElement>)
  }
  const toStar = (v: string) => {
    const next = v === star ? '' : v
    setStar(next)
    if (starKey) keepStar(starKey, next)
  }
  const send = async (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // the list is drawn over a form (Add a row) that would take the submit too
    if (!adds || !ask.trim()) return
    try {
      await api.post('/api/say', { words: `Add a new ${adds.what} to ${adds.to}: ${ask.trim()}` })
      close()
      showAsk()
    } catch (err) {
      setProblem(wordsOf(err))
    }
  }
  return (
    <>
      <button
        ref={anchor}
        type="button"
        role="combobox"
        aria-expanded={open}
        id={rest.id}
        aria-controls={open ? list : undefined}
        aria-activedescendant={open && shown[hot] ? `${list}-${hot}` : undefined}
        aria-label={rest['aria-label']}
        title={title}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAt())}
        onKeyDown={keys}
        className={cn(
          FIELD,
          'flex items-center gap-1.5 pr-1.5 text-left disabled:opacity-50',
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {(options.find((o) => o.value === now) ?? options[0])?.label ?? ''}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
      </button>
      <Popover anchor={anchor} open={open} onClose={close}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: the keys of the list it holds */}
        <div className="flex max-h-72 min-w-44 flex-col p-1" onKeyDown={keys}>
          {options.length > 5 && (
            <label className="mb-1 flex items-center gap-1.5 border-line border-b px-2 pb-1.5">
              <Search className="size-3.25 text-ink-3" />
              <input
                // biome-ignore lint/a11y/noAutofocus: the list was opened to choose; typing narrows it
                autoFocus
                value={words}
                onChange={(e) => {
                  setWords(e.target.value)
                  setHot(0)
                }}
                placeholder="Search"
                aria-label="Search"
                className="min-w-0 flex-1 bg-transparent text-ink text-md outline-none placeholder:text-ink-3"
              />
            </label>
          )}
          <div id={list} role="listbox" className="overflow-y-auto">
            {shown.map((o, i) => (
              <MenuItem
                key={o.value}
                id={`${list}-${i}`}
                active={i === hot}
                checked={o.value === now}
                disabled={o.disabled}
                onClick={() => pick(o.value)}
                star={
                  starKey && o.value
                    ? { on: o.value === star, onClick: () => toStar(o.value) }
                    : undefined
                }
              >
                {o.label || '—'}
              </MenuItem>
            ))}
            {shown.length === 0 && <p className="px-2.5 py-1.5 text-ink-3 text-md">No match.</p>}
          </div>
          {adds && <MenuLine />}
          {adds && !asking && (
            <MenuItem onClick={() => setAsking(true)}>
              <Plus className="size-3.5 text-ink-3" />
              Add new…
            </MenuItem>
          )}
          {adds && asking && (
            <form onSubmit={send} className="flex flex-col gap-1.5 p-1">
              <div className="flex items-center gap-1.5">
                <Field
                  autoFocus
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  placeholder={`The new ${adds.what}`}
                  aria-label={`The new ${adds.what}`}
                  className="flex-1"
                />
                <Button type="submit" size="sm" variant="primary" disabled={!ask.trim()}>
                  Send
                </Button>
              </div>
              <Refusal words={problem} />
            </form>
          )}
        </div>
      </Popover>
    </>
  )
}
