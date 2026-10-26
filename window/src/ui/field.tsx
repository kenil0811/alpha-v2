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
  useRef,
  useState,
} from 'react'
import { Refusal, useAct } from './act.tsx'
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

// One dropdown everywhere: a button that opens a short list, with a search
// line when there are more than five. Written as a <select> is, <option>s and onChange alike.
export function Select({
  className,
  value,
  defaultValue,
  onChange,
  children,
  disabled,
  title,
  adds,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  // Add new… at the list's foot: one line naming the new one, sent for Alpha to add
  adds?: { what: string; send: (words: string) => Promise<unknown> } | undefined
}) {
  const options = optionsOf(children)
  const [own, setOwn] = useState(String(defaultValue ?? options[0]?.value ?? ''))
  const now = value === undefined ? own : String(value)
  const [open, setOpen] = useState(false)
  const [words, setWords] = useState('')
  const [asking, setAsking] = useState(false) // Add new…'s line is open
  const [ask, setAsk] = useState('')
  const { busy, problem, act } = useAct()
  const anchor = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    setWords('')
    setAsking(false)
    setAsk('')
  }
  const shown = options.filter((o) => o.label.toLowerCase().includes(words.trim().toLowerCase()))
  // the keyboard is the menu's own (ui/popover.tsx): the arrows, Home, End and a letter move
  // between the lines, Return picks, Escape closes; ↓ or ↑ on the button opens it
  const keys = (e: KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setOpen(true)
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
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={rest['aria-label']}
        title={title}
        disabled={disabled}
        onClick={() => setOpen(!open)}
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
        <div className="flex max-h-72 min-w-44 flex-col p-1">
          {options.length > 5 && (
            <label className="mb-1 flex items-center gap-1.5 border-line border-b px-2 pb-1.5">
              <Search className="size-3.25 text-ink-3" />
              <input
                // biome-ignore lint/a11y/noAutofocus: the list was opened to choose; typing narrows it
                autoFocus
                value={words}
                onChange={(e) => setWords(e.target.value)}
                placeholder="Search"
                aria-label="Search"
                className="min-w-0 flex-1 bg-transparent text-ink text-md outline-none placeholder:text-ink-3"
              />
            </label>
          )}
          <div role="menu" className="overflow-y-auto">
            {shown.map((o) => (
              <MenuItem
                key={o.value}
                checked={o.value === now}
                disabled={o.disabled}
                onClick={() => pick(o.value)}
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
            <form
              onSubmit={async (e: FormEvent) => {
                e.preventDefault()
                e.stopPropagation() // drawn over a form (Add a row) that would take the submit too
                if (ask.trim() && (await act(() => adds.send(ask.trim())))) close()
              }}
              className="flex flex-col gap-1.5 p-1"
            >
              <div className="flex items-center gap-1.5">
                <Field
                  autoFocus
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  placeholder={`The new ${adds.what}`}
                  aria-label={`The new ${adds.what}`}
                  className="flex-1"
                />
                <Button type="submit" size="sm" variant="primary" disabled={busy || !ask.trim()}>
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
