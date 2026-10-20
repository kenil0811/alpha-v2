// shadcn's button, kept thin: the kit's weight, not the model's.
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn.ts'

const button = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md text-base transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-ink shadow-btn hover:bg-accent/90',
        outline: 'border border-line bg-surface shadow-btn hover:bg-hover',
        ghost: 'text-ink-2 hover:bg-hover hover:text-ink',
      },
      size: { default: 'h-8 px-3', sm: 'h-7 px-2.5 text-sm' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>) {
  return <button className={cn(button({ variant, size }), className)} {...props} />
}
