// The window's buttons (Ledger): a plain one, the primary in the accent, a ghost, and an icon button.
// Weight and spacing live here, never in a screen.
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn.ts'

const button = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-line bg-surface text-ink hover:bg-hover',
        primary: 'border-accent bg-accent text-accent-ink hover:brightness-110',
        ghost: 'border-transparent bg-transparent text-ink-2 hover:bg-hover hover:text-ink',
        warn: 'border-line bg-surface text-warn hover:bg-hover',
      },
      size: {
        default: 'h-7.5 px-3 text-md',
        sm: 'h-6.5 px-2.5 text-sm',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>) {
  return <button type={type} className={cn(button({ variant, size }), className)} {...props} />
}

// A square button holding one icon; its label is for screen readers and the tooltip.
export function IconButton({
  label,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-sm text-ink-3 transition-colors hover:bg-hover hover:text-ink disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
