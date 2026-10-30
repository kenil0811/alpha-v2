// Pills say a state; green, amber and red only ever mean done or fits, waits on you or unsure,
// and didn't finish. A topic chip names a module and, as a button, filters to it.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn.ts'

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'accent' | 'faint'

const TONES: Record<Tone, string> = {
  neutral: 'bg-sunk text-ink-2',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  accent: 'bg-accent-soft text-accent',
  faint: 'border border-line text-ink-3',
}

// One colour per choice of a single or multi-select (Vikas, 30 Oct: Clients ≠ Leads ≠ Insurers):
// the tone the field gives it, else the palette (--opt-1…8 in app.css) by its place among the
// field's choices, round again past eight; words that are no choice go by their letters. Never
// random, so a choice wears one colour in every cell, chip, dropdown and filter.
const OPTION = [
  'bg-opt-1-soft text-opt-1',
  'bg-opt-2-soft text-opt-2',
  'bg-opt-3-soft text-opt-3',
  'bg-opt-4-soft text-opt-4',
  'bg-opt-5-soft text-opt-5',
  'bg-opt-6-soft text-opt-6',
  'bg-opt-7-soft text-opt-7',
  'bg-opt-8-soft text-opt-8',
]
export type Choices = { choices: string[]; tones: Record<string, string> }
export function optionClass(of: Choices | undefined, value: string): string {
  const tone = of?.tones[value]
  if (tone && tone in TONES) return TONES[tone as Tone]
  let i = of ? of.choices.indexOf(value) : -1
  if (i < 0) i = [...value].reduce((h, ch) => (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0, 7)
  return OPTION[i % OPTION.length] as string
}

// A choice as its chip, in its own colour.
export function Choice({
  of,
  value,
  className,
}: {
  of: Choices | undefined
  value: string
  className?: string | undefined
}) {
  return (
    <Pill colour={optionClass(of, value)} className={cn('max-w-full', className)}>
      <span className="truncate">{value}</span>
    </Pill>
  )
}

export function Pill({
  tone = 'neutral',
  colour,
  children,
  className,
}: {
  tone?: Tone
  colour?: string | undefined // a choice's own colour (optionClass), in place of the tone
  children: ReactNode
  className?: string | undefined
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 font-medium text-sm',
        colour ?? TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Topic({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-5 items-center rounded-sm border border-line bg-surface px-1.75 font-medium text-ink-2 text-xs transition-colors hover:border-accent-line hover:text-accent',
        className,
      )}
      {...props}
    />
  )
}

// A small label in sentence case: nothing is in capitals (Vikas, 25 and 28 Oct).
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-semibold text-ink-3 text-sm', className)}>{children}</span>
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-xs border border-line px-1 font-mono text-ink-3 text-xs">
      {children}
    </kbd>
  )
}
