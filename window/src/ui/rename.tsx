// A name changed where it shows: a table's in the bar, a module's in the rail. A double-click
// edits it in place, with Save and Cancel under it (Vikas, 23 Nov); Enter and Escape do the same,
// as a short list's entry does (editStep, R8). A name the core refuses (one another has, one naming
// a period) stays in the box with the core's words under it.
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { wordsOf } from '../api.ts'
import { cn } from './cn.ts'
import { Field } from './field.tsx'
import { type Edit, editStep } from './shortlist.tsx'
import { TickOrCross } from './yes-no.tsx'

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
  // Save and Cancel hang under the box, held to the window so a row of tabs that scrolls
  // sideways does not cut them off
  const box = useRef<HTMLSpanElement>(null)
  const [at, setAt] = useState<{ top: number; right: number } | null>(null)
  useLayoutEffect(() => {
    const r = edit ? box.current?.getBoundingClientRect() : undefined
    setAt(r ? { top: r.bottom + 4, right: window.innerWidth - r.right } : null)
  }, [edit])
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
    <span ref={box} className="relative block min-w-0 flex-1">
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
      />
      <span
        style={at ?? undefined}
        className="fixed z-(--z-pop) flex w-max max-w-72 flex-col items-end gap-1 font-sans"
      >
        <span className="flex gap-1">
          <TickOrCross yes={false} words="Cancel" onClick={() => step({ type: 'cancel' })} />
          <TickOrCross yes words="Save" onClick={() => step({ type: 'keep' })} />
        </span>
        {problem && (
          <span
            role="alert"
            className="min-w-48 whitespace-normal rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-warn shadow-pop"
          >
            {problem}
          </span>
        )}
      </span>
    </span>
  )
}

// A page's own title, renamed where it shows by a double-click: a row's page, a task's.
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
