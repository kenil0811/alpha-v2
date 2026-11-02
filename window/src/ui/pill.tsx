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

export function Pill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 font-medium text-sm',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

// A choice in its own colour (Batch E, 66.9, Kenil's look 2 Nov): one of eight by its place in its
// field's list, round again past eight, never random, so it wears one colour in every cell, chip,
// dropdown and filter; one that is a state (a tone: Won, Lost, Proposed) keeps its tone's dot, so
// states still read as states. Words that are no choice of the field go by their letters.
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
const STATE_DOT: Record<string, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  accent: 'bg-accent',
}
export type Choices = { choices: string[]; tones: Record<string, string> }

export function optionClass(of: Choices, value: string): string {
  let i = of.choices.indexOf(value)
  if (i < 0) i = [...value].reduce((h, c) => (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0, 7)
  return OPTION[i % OPTION.length] as string
}

export function Choice({
  of,
  value,
  className,
}: {
  of: Choices
  value: string
  className?: string | undefined
}) {
  const tone = of.tones[value]
  if (tone)
    return (
      <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
        <span className={cn('size-1.75 shrink-0 rounded-full', STATE_DOT[tone])} />
        <span className="truncate">{value}</span>
      </span>
    )
  return (
    <Pill className={cn('min-w-0 max-w-full', optionClass(of, value), className)}>
      <span className="truncate">{value}</span>
    </Pill>
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

// A small label, 12px in sentence case (Batch E, 66.3, Kenil's look 2 Nov): a card's head, a
// part's name in a row's panel. Nothing in Alpha is set in capitals.
export const LABEL = 'font-semibold text-ink-3 text-sm'

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(LABEL, className)}>{children}</span>
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-xs border border-line px-1 font-mono text-ink-3 text-xs">
      {children}
    </kbd>
  )
}
