// A choice holding several (tags, core step 3c): shown as chips, one per choice held, each with
// its colour where the choice has one; picked from a list of the field's choices, ticked or not.
// The pick is kept as the typed words ("Rush, Late"), as every other editor keeps its value, and
// read back with readValue.
import type { FieldView } from '@alpha/core/api'
import { type KeyboardEvent, useState } from 'react'
import { askForNew } from '../ask.ts'
import { cn } from '../ui/cn.ts'
import { AddNew, SEARCH_PAST, SearchLine } from '../ui/field.tsx'
import { Pill } from '../ui/pill.tsx'
import { MenuLine } from '../ui/popover.tsx'
import { useTableName } from './context.ts'
import { DOT } from './values.ts'

// Chips in the room there is: the first two, the second cut with an ellipsis if it must be, and
// how many more; the whole list is on the tip.
export function TagChips({ field, value }: { field: FieldView; value: unknown }) {
  const held = Array.isArray(value) ? value.map(String).filter(Boolean) : []
  const more = held.length - 2
  return (
    <span
      className="inline-flex min-w-0 items-center gap-1 overflow-hidden"
      data-tip={held.length > 1 ? held.join(', ') : undefined}
    >
      {held.slice(0, 2).map((t, i) => (
        <Pill key={t} className={i ? 'min-w-0 shrink' : 'max-w-full'}>
          {field.tones[t] && (
            <span className={cn('size-1.75 shrink-0 rounded-full', DOT[field.tones[t]])} />
          )}
          <span className="truncate">{t}</span>
        </Pill>
      ))}
      {more > 0 && <span className="shrink-0 text-ink-3 text-sm">+{more}</span>}
    </span>
  )
}

const held = (typed: string) =>
  typed
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

export function TagPicker({
  field,
  typed,
  onTyped,
  onKeyDown,
}: {
  field: FieldView
  typed: string
  onTyped: (typed: string) => void
  onKeyDown?: (e: KeyboardEvent) => void // a cell's Enter and Escape
}) {
  const now = held(typed)
  const flip = (c: string, on: boolean) =>
    onTyped(field.choices.filter((x) => (x === c ? on : now.includes(x))).join(', '))
  // the same search and Add new… as every dropdown (Batch D, 66.7, Kenil's yes 2 Nov)
  const [words, setWords] = useState('')
  const table = useTableName()
  const shown = field.choices.filter((c) => c.toLowerCase().includes(words.trim().toLowerCase()))
  return (
    <fieldset className="flex flex-col" aria-label={field.name} onKeyDown={onKeyDown}>
      {field.choices.length > SEARCH_PAST && <SearchLine words={words} onWords={setWords} />}
      <div className="flex max-h-60 flex-col overflow-y-auto">
        {shown.map((c) => (
          <label key={c} className="flex h-7.5 items-center gap-2 rounded-sm px-1.5 hover:bg-hover">
            <input
              type="checkbox"
              className="accent-accent"
              checked={now.includes(c)}
              onChange={(e) => flip(c, e.target.checked)}
            />
            {field.tones[c] && (
              <span className={cn('size-1.75 shrink-0 rounded-full', DOT[field.tones[c]])} />
            )}
            <span className="min-w-0 flex-1 truncate text-ink">{c}</span>
          </label>
        ))}
        {shown.length === 0 && <p className="px-2.5 py-1.5 text-ink-3 text-md">No match.</p>}
      </div>
      {table && (
        <>
          <MenuLine />
          <AddNew
            adds={{
              what: 'choice',
              send: (w) => askForNew('choice', `${field.name} in ${table}`, w),
            }}
            onDone={() => setWords('')}
          />
        </>
      )}
    </fieldset>
  )
}
