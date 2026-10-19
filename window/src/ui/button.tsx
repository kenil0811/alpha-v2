// shadcn's button, kept thin: the kit's weight, not the model's.
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn.ts'

const button = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400',
  {
    variants: {
      variant: {
        default: 'bg-neutral-900 text-white hover:bg-neutral-700',
        outline: 'border border-neutral-200 bg-white hover:bg-neutral-50',
        ghost: 'hover:bg-neutral-100',
      },
      size: { default: 'h-8 px-3', sm: 'h-7 px-2.5 text-xs' },
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
