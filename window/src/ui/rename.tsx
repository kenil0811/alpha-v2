// A name changed where it shows (Batch B, picks 7 and 14a, Kenil's yes 1 Nov): a table's in the
// bar, a module's in the rail. A double-click edits it in place, Enter keeping the change and
// Escape putting it back, as a short list's entry is (editStep, R8). A name the core refuses (one
// another has, one naming a period) stays in the box with the core's words under it; leaving the
// box then puts the name back.
import { type ReactNode, useState } from 'react'
import { wordsOf } from '../api.ts'
import { cn } from './cn.ts'
import { Field } from './field.tsx'
import { type Edit, editStep } from './shortlist.tsx'

export const RENAME_TIP = 'Double-click to rename'

type Step = Parameters<typeof editStep>[1]

export function Renamable({
  name,
  rename,
  className,
  children,
}: {
  name: string
  rename: ((to: string) => Promise<unknown>) | null // none: the name is not changed here
  className?: string // the box's width where it shows
  children: (start: (() => void) | undefined) => ReactNode // the name as shown; start edits it
}) {
  const [edit, setEdit] = useState<Edit>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const step = (s: Step) => {
    const out = editStep(edit, s)
    setEdit(out.edit)
    if (s.type === 'cancel') setProblem(null)
    const words = out.keep?.words
    if (!words || !rename) return
    rename(words).then(
      () => setProblem(null),
      (err) => {
        // kept in the box, so the person changes it rather than typing it again
        setProblem(wordsOf(err))
        setEdit({ key: 'name', words, was: name })
      },
    )
  }
  if (!edit)
    return (
      <>{children(rename ? () => step({ type: 'start', key: 'name', words: name }) : undefined)}</>
    )
  return (
    <span className="relative block min-w-0 flex-1">
      <Field
        autoFocus
        aria-label={`Rename ${name}`}
        value={edit.words}
        className={cn('w-full font-sans text-md', className)}
        onChange={(e) => step({ type: 'type', words: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') step({ type: 'keep' })
          if (e.key === 'Escape') step({ type: 'cancel' })
        }}
        onBlur={() => step({ type: problem ? 'cancel' : 'keep' })}
      />
      {problem && (
        <span
          role="alert"
          className="absolute top-full left-0 z-(--z-pop) mt-1 w-full min-w-48 whitespace-normal rounded-md border border-line bg-surface px-2.5 py-1.5 font-sans text-sm text-warn shadow-pop"
        >
          {problem}
        </span>
      )}
    </span>
  )
}

// The bar's name, in serif: a table's is renamed here, by a double-click.
export function BarName({
  name,
  rename,
}: {
  name: string
  rename: ((to: string) => Promise<unknown>) | null
}) {
  return (
    // the name truncates, not the h1, so a refusal under the box is not cut off
    <h1 className="hidden min-w-0 text-ink peer-empty:block">
      <Renamable name={name} rename={rename} className="w-64">
        {(start) =>
          start ? (
            // a double-click, or Enter by keyboard, edits it; a click alone does nothing
            <button
              type="button"
              className="block max-w-full truncate rounded-sm"
              onDoubleClick={start}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'F2') start()
              }}
              data-tip={RENAME_TIP}
            >
              {name}
            </button>
          ) : (
            <span className="block truncate">{name}</span>
          )
        }
      </Renamable>
    </h1>
  )
}

// A page's own title, renamed where it shows by a double-click, as the bar's name is (Batch D,
// 66.21, Kenil's yes 2 Nov): a row's page, a task's.
export function PageTitle({
  name,
  rename,
  className,
}: {
  name: string
  rename: ((to: string) => Promise<unknown>) | null
  className?: string // its size where it shows
}) {
  return (
    <h1 className={cn('min-w-0 font-serif text-ink', className)}>
      <Renamable name={name} rename={rename} className="w-full">
        {(start) =>
          start ? (
            <button
              type="button"
              className="block max-w-full rounded-sm text-left"
              onDoubleClick={start}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'F2') start()
              }}
              data-tip={RENAME_TIP}
            >
              {name}
            </button>
          ) : (
            <span className="block">{name}</span>
          )
        }
      </Renamable>
    </h1>
  )
}
