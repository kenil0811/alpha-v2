// A person's or an organization's face: a round mark for a person, a square for an organization,
// with their initials until a photo is kept.
import { cn } from './cn.ts'

export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words.at(-1)?.[0] ?? '') : '')).toUpperCase()
}

export function Avatar({
  name,
  organization,
  big,
}: {
  name: string
  organization?: boolean | undefined
  big?: boolean | undefined
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center bg-sunk font-semibold text-ink-2',
        organization ? 'rounded-md' : 'rounded-full',
        big ? 'size-12 text-lg' : 'size-8 text-xs',
      )}
    >
      {initials(name) || '?'}
    </span>
  )
}
