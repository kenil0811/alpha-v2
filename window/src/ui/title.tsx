// A record's title, large in serif: a double-click changes it where it is kept, Enter saves and
// Escape lets it be (Vikas, 30 Oct: a click never edits). A row's page and a task's.
import { useState } from 'react'
import { cn } from './cn.ts'

export function Title({
  title,
  onRename,
  className,
}: {
  title: string
  onRename: ((t: string) => Promise<boolean>) | undefined
  className?: string
}) {
  const [typing, setTyping] = useState<string | null>(null)
  if (typing !== null)
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: a double-click opened it to type in
        autoFocus
        aria-label="Title"
        value={typing}
        onChange={(e) => setTyping(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setTyping(null)
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        onBlur={async () => {
          const t = typing.trim()
          if (!t || t === title || (await onRename?.(t))) setTyping(null)
        }}
        className={cn(
          'mt-1 w-full bg-transparent font-serif text-2xl text-ink outline-none',
          className,
        )}
      />
    )
  return (
    <h1
      className={cn('mt-1 font-serif text-2xl text-ink', className)}
      onDoubleClick={() => onRename && setTyping(title)}
      data-tip={onRename ? 'Double-click to rename' : undefined}
    >
      {title}
    </h1>
  )
}
