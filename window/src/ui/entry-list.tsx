// One way to keep a list of entries, the same wherever a person keeps one (Vikas, 30 Oct):
// Governance's Can do and Cannot do, How to work. Empty, its only line is New; with entries, a
// small Add sits at the right of its heading. A hover shows ✕ at an entry's right (the caller
// confirms it, or lets it be undone); a double-click edits an entry, Enter saves and Escape lets
// it be. A click never edits.
import { Plus, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Button, IconButton } from './button.tsx'
import { cn } from './cn.ts'

export function EntryList<T>({
  head,
  items,
  idOf,
  textOf,
  line,
  after,
  waits,
  groupOf,
  placeholder,
  removeLabel = 'Delete',
  onAdd,
  onEdit,
  onRemove,
}: {
  head: ReactNode // the heading's words; Add sits at its right
  items: T[]
  idOf: (t: T) => string
  textOf: (t: T) => string // the words a double-click edits
  line?: ((t: T) => ReactNode) | undefined // how an entry reads; its words by default
  after?: ((t: T) => ReactNode) | undefined // its own buttons, before the ✕ (Approve)
  waits?: ((t: T) => boolean) | undefined // greyed on dots: it waits on the person's yes
  groupOf?: ((t: T) => string) | undefined // a heading over each group, when there are two or more
  placeholder: string
  removeLabel?: string | ((t: T) => string) // the ✕'s words: Delete, or Revoke, Forget
  onAdd: (words: string) => Promise<boolean> // true when it went in, so the box closes
  onEdit?: ((t: T, words: string) => Promise<boolean>) | undefined
  onRemove?: ((t: T) => void) | undefined
}) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const groups = new Map<string, T[]>()
  for (const t of items) {
    const g = groupOf?.(t) ?? ''
    groups.set(g, [...(groups.get(g) ?? []), t])
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="flex h-9 items-center gap-1.5 border-line border-b font-medium text-ink text-md">
        {head}
        <span className="flex-1" />
        {items.length > 0 && !adding && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus className="size-3.25" />
            Add
          </Button>
        )}
      </h3>
      {[...groups].map(([g, list]) => (
        <div key={g} className="flex flex-col gap-1.5">
          {groups.size > 1 && <div className="pt-1 text-ink-3 text-sm">{g}</div>}
          {list.map((t) => {
            const id = idOf(t)
            if (editing === id && onEdit)
              return (
                <Words
                  key={id}
                  start={textOf(t)}
                  placeholder={placeholder}
                  onSave={(w) => onEdit(t, w)}
                  onDone={() => setEditing(null)}
                />
              )
            const waiting = waits?.(t) ?? false
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: a double-click edits; the ✕ and the entry's own buttons are the keyboard's way
              <div
                key={id}
                data-entry={id}
                data-waits={waiting || undefined}
                onDoubleClick={(e) => {
                  if (!onEdit || (e.target as Element).closest('button, a, input')) return
                  setEditing(id)
                }}
                className={cn(
                  'group/entry flex items-start gap-2 rounded-md border px-3 py-2',
                  waiting
                    ? 'border-line border-dashed text-ink-3 [background-image:radial-gradient(var(--line)_1px,transparent_0)] [background-size:6px_6px]'
                    : 'border-line bg-surface text-ink',
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  {line ? line(t) : <span className="text-md">{textOf(t)}</span>}
                </span>
                {after?.(t)}
                {onRemove && (
                  <IconButton
                    label={typeof removeLabel === 'string' ? removeLabel : removeLabel(t)}
                    onClick={() => onRemove(t)}
                    className="size-6.5 opacity-0 focus-visible:opacity-100 group-hover/entry:opacity-100"
                  >
                    <X className="size-3.5" />
                  </IconButton>
                )}
              </div>
            )
          })}
        </div>
      ))}
      {adding || items.length === 0 ? (
        adding ? (
          <Words
            start=""
            placeholder={placeholder}
            onSave={onAdd}
            onDone={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-8 items-center gap-1.5 rounded-sm px-1 text-ink-3 text-md hover:bg-hover hover:text-ink"
          >
            <Plus className="size-3.5" />
            New
          </button>
        )
      ) : null}
    </div>
  )
}

// The box an entry is typed in: Enter saves, Escape or leaving it unchanged lets it be.
function Words({
  start,
  placeholder,
  onSave,
  onDone,
}: {
  start: string
  placeholder: string
  onSave: (words: string) => Promise<boolean>
  onDone: () => void
}) {
  const [words, setWords] = useState(start)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    const w = words.trim()
    if (!w || w === start) return onDone()
    setBusy(true)
    const ok = await onSave(w)
    setBusy(false)
    if (ok) onDone()
  }
  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: New, Add or a double-click opened it to type in
      autoFocus
      value={words}
      disabled={busy}
      aria-label={placeholder}
      placeholder={placeholder}
      onChange={(e) => setWords(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void save()
        if (e.key === 'Escape') onDone()
      }}
      onBlur={() => !busy && (words.trim() === start.trim() || !words.trim()) && onDone()}
      className="h-9 rounded-md border border-accent-line bg-surface px-3 text-ink text-md outline-none placeholder:text-ink-3"
    />
  )
}
