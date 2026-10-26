// A day as a person says it, "25 Oct" (with the year when it is another year's), never a
// browser's dd/mm/yyyy. Typed ("tomorrow", "fri", "25 Oct", "25/10", "2026-10-25") or picked on a
// small calendar; the value is the same yyyy-mm-dd a date input gives, '' for none.

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { type InputHTMLAttributes, type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { IconButton } from './button.tsx'
import { cn } from './cn.ts'
import { Field } from './field.tsx'
import { Popover } from './popover.tsx'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dayOf = (v: string) => new Date(`${v}T12:00:00`)
const title = (s = '') => s.charAt(0).toUpperCase() + s.slice(1)

// "25 Oct", or "25 Oct 2027" in another year
export function dayLabel(v: string, today = new Date()): string {
  if (!v) return ''
  const d = dayOf(v)
  const year = d.getFullYear() === today.getFullYear() ? '' : ` ${d.getFullYear()}`
  return `${d.getDate()} ${title(MONTHS[d.getMonth()])}${year}`
}

// What a person typed, as yyyy-mm-dd: '' for nothing, null for words that are not a day.
export function parseDay(words: string, today = new Date()): string | null {
  const w = words.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ')
  if (!w) return ''
  const plus = (n: number) =>
    iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n))
  if (w === 'today') return plus(0)
  if (w === 'tomorrow') return plus(1)
  if (w === 'yesterday') return plus(-1)
  // a weekday is the next one, a week on when it is today's
  const weekday = w.length >= 3 ? DAYS.findIndex((d) => d.startsWith(w)) : -1
  if (weekday >= 0) return plus((weekday - today.getDay() + 7) % 7 || 7)
  const hit = [
    /^(?<y>\d{4})-(?<m>\d{1,2})-(?<d>\d{1,2})$/, // 2026-10-25
    /^(?<d>\d{1,2})[/.-](?<m>\d{1,2})(?:[/.-](?<y>\d{2}|\d{4}))?$/, // 25/10, 25/10/26
    /^(?<d>\d{1,2})(?:st|nd|rd|th)? (?<m>[a-z]{3,})(?: (?<y>\d{4}))?$/, // 25 Oct
    /^(?<m>[a-z]{3,}) (?<d>\d{1,2})(?:st|nd|rd|th)?(?: (?<y>\d{4}))?$/, // Oct 25
  ]
    .map((r) => r.exec(w)?.groups)
    .find(Boolean)
  if (!hit?.d || !hit.m) return null
  const m = /\d/.test(hit.m) ? +hit.m : MONTHS.indexOf(hit.m.slice(0, 3)) + 1
  const d = +hit.d
  const y = !hit.y ? today.getFullYear() : hit.y.length === 2 ? 2000 + +hit.y : +hit.y
  const out = new Date(y, m - 1, d)
  return out.getMonth() === m - 1 && out.getDate() === d ? iso(out) : null
}

export function DateField({
  value,
  onChange,
  className,
  ...rest
}: { value: string; onChange: (v: string) => void } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
>) {
  const [words, setWords] = useState(dayLabel(value))
  const [wrong, setWrong] = useState(false)
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)
  useEffect(() => setWords(dayLabel(value)), [value])

  const settle = (keep: boolean) => {
    const v = parseDay(words)
    if (v === null) {
      if (keep) return setWrong(true)
      setWords(dayLabel(value))
    } else {
      setWords(dayLabel(v))
      if (v !== value) onChange(v)
    }
    setWrong(false)
  }
  const pick = (v: string) => {
    setOpen(false)
    setWrong(false)
    setWords(dayLabel(v))
    if (v !== value) onChange(v)
  }
  return (
    <span ref={anchor} className={cn('relative inline-flex min-w-0', className)}>
      <Field
        {...rest}
        value={words}
        aria-invalid={wrong || undefined}
        onChange={(e) => {
          setWords(e.target.value)
          setWrong(false)
        }}
        onFocus={(e) => e.target.select()}
        onBlur={() => settle(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            settle(true)
          } else if (e.key === 'Escape' && words !== dayLabel(value)) {
            e.preventDefault()
            setWords(dayLabel(value))
            setWrong(false)
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={cn('w-full pr-8', wrong && 'border-bad focus:border-bad')}
      />
      <IconButton
        label="Pick a day"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="absolute top-0.25 right-0.25 size-7"
      >
        <CalendarDays className="size-3.75" />
      </IconButton>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} className="min-w-0">
        <Month value={value} onPick={pick} />
      </Popover>
    </span>
  )
}

// A month of days from Monday; the arrow keys move a day or a week, Enter picks.
function Month({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  const [at, setAt] = useState(value || iso(new Date()))
  const grid = useRef<HTMLDivElement>(null)
  const a = dayOf(at)
  const first = new Date(a.getFullYear(), a.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7
  const count = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate()
  const today = iso(new Date())
  const shift = (days: number, months = 0) =>
    setAt(iso(new Date(a.getFullYear(), a.getMonth() + months, a.getDate() + days)))

  // the focus follows the day the keys moved to
  useEffect(() => {
    if (grid.current?.contains(document.activeElement))
      grid.current.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
  }, [at])
  useEffect(() => grid.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus(), [])

  const keys = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (step) shift(step)
    else if (e.key === 'PageUp') shift(0, -1)
    else if (e.key === 'PageDown') shift(0, 1)
    else return
    e.preventDefault()
  }
  return (
    <div className="flex w-60 flex-col gap-1 p-1">
      <div className="flex items-center justify-between">
        <IconButton label="Previous month" onClick={() => shift(0, -1)}>
          <ChevronLeft className="size-3.75" />
        </IconButton>
        <span className="font-medium text-ink text-md">
          {title(MONTHS[a.getMonth()])} {a.getFullYear()}
        </span>
        <IconButton label="Next month" onClick={() => shift(0, 1)}>
          <ChevronRight className="size-3.75" />
        </IconButton>
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the arrow keys move between the days, which are buttons */}
      <div ref={grid} onKeyDown={keys} className="grid grid-cols-7 text-center text-sm">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <span key={d} className="py-1 text-ink-3">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`blank${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const v = iso(new Date(a.getFullYear(), a.getMonth(), i + 1))
          return (
            <button
              key={v}
              type="button"
              tabIndex={v === at ? 0 : -1}
              aria-label={dayLabel(v)}
              aria-pressed={v === value}
              onClick={() => onPick(v)}
              className={cn(
                'grid h-7.5 place-items-center rounded-sm text-ink outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-accent-soft',
                v === today && 'font-semibold text-accent',
                v === value && 'bg-accent text-accent-ink hover:bg-accent',
              )}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between border-line border-t pt-1">
        <button
          type="button"
          onClick={() => onPick(today)}
          className="rounded-sm px-2 py-1 text-ink-2 text-sm hover:bg-hover hover:text-ink"
        >
          Today
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onPick('')}
            className="rounded-sm px-2 py-1 text-ink-2 text-sm hover:bg-hover hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
