// A field: one line of text, a choice, or the composer's words. Focus shows in the accent.
import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import { cn } from './cn.ts'

const FIELD =
  'h-7.5 min-w-0 rounded-md border border-line bg-surface px-2.5 text-ink text-md outline-none transition-colors placeholder:text-ink-3 focus:border-accent-line focus:ring-3 focus:ring-accent-soft'

export function Field({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(FIELD, 'pr-1', className)} {...props} />
}
