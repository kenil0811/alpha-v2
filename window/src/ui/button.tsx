// The window's buttons: a plain one, the primary in the accent, a soft one, a ghost, and an
// icon button. Weight and spacing live here, never in a screen.
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from './cn.ts'
import { fitWords } from './fit.tsx'

const button = cva(
  // a press dips the button to 97% and lets it spring back (motion, 23 Nov)
  'group/fit inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition-[color,background-color,border-color,filter,transform] duration-120 ease-soft active:scale-97 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // every kind changes colour under the pointer, into the accent's tint; the primary darkens
        default:
          'border-line bg-surface text-ink hover:border-accent-line hover:bg-accent-soft hover:text-accent',
        primary: 'border-accent bg-accent text-accent-ink hover:brightness-90 active:brightness-80',
        // a way onward that is not the screen's main act: Open page
        soft: 'border-accent-line bg-accent-soft text-accent hover:border-accent',
        ghost:
          'border-transparent bg-transparent text-ink-2 hover:bg-accent-soft hover:text-accent',
        warn: 'border-line bg-surface text-warn hover:bg-hover',
        danger: 'border-line bg-surface text-bad hover:bg-bad-soft',
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
  children,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof button>) {
  return (
    <button type={type} className={cn(button({ variant, size }), className)} {...props}>
      {fitWords(children)}
    </button>
  )
}

// A square button holding one icon; its label is for screen readers and the tooltip.
export function IconButton({
  label,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      data-tip={label}
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-sm text-ink-3 transition-[color,background-color,transform] duration-120 ease-soft hover:bg-hover hover:text-ink active:scale-92 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
