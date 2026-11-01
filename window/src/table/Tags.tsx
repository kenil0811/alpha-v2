// A choice holding several (tags, core step 3c): shown as chips, one per choice held, each with
// its colour where the choice has one; picked from a list of the field's choices, ticked or not.
// The pick is kept as the typed words ("Rush, Late"), as every other editor keeps its value, and
// read back with readValue.
import type { FieldView } from '@alpha/core/api'
import { Search } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { askForNew } from '../ask.ts'
import { AddNew } from '../ui/field.tsx'
import { Choice } from '../ui/pill.tsx'
import { MenuLine } from '../ui/popover.tsx'

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
        <Choice key={t} of={field} value={t} className={i ? 'min-w-0 shrink' : undefined} />
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

// The field's choices, ticked or not: a search past six, Add new… at the foot (asked of Alpha, as
// every dropdown's is).
export function TagPicker({
  field,
  typed,
  onTyped,
  onKeyDown,
  table,
}: {
  field: FieldView
  typed: string
  onTyped: (typed: string) => void
  onKeyDown?: (e: KeyboardEvent) => void // a cell's Enter and Escape
  table?: string | undefined // its table's name, for Add new…
}) {
  const now = held(typed)
  const [words, setWords] = useState('')
  const flip = (c: string, on: boolean) =>
    onTyped(field.choices.filter((x) => (x === c ? on : now.includes(x))).join(', '))
  const shown = field.choices.filter((c) => c.toLowerCase().includes(words.trim().toLowerCase()))
  return (
    <fieldset className="flex flex-col" aria-label={field.name} onKeyDown={onKeyDown}>
      {field.choices.length > 6 && (
        <label className="mb-1 flex items-center gap-1.5 border-line border-b px-2 pb-1.5">
          <Search className="size-3.25 text-ink-3" />
          <input
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder="Search"
            aria-label="Search"
            className="min-w-0 flex-1 bg-transparent text-ink text-md outline-none placeholder:text-ink-3"
          />
        </label>
      )}
      <div className="flex max-h-60 flex-col overflow-y-auto">
        {shown.map((c) => (
          <label key={c} className="flex h-7.5 items-center gap-2 rounded-sm px-1.5 hover:bg-hover">
            <input
              type="checkbox"
              className="accent-accent"
              checked={now.includes(c)}
              onChange={(e) => flip(c, e.target.checked)}
            />
            <span className="min-w-0 flex-1">
              <Choice of={field} value={c} />
            </span>
          </label>
        ))}
        {shown.length === 0 && <p className="px-2.5 py-1.5 text-ink-3 text-md">No match.</p>}
      </div>
      <MenuLine />
      <AddNew
        adds={{
          what: 'choice',
          send: (w) => askForNew('choice', table ? `${field.name} in ${table}` : field.name, w),
        }}
        onDone={() => undefined}
      />
    </fieldset>
  )
}
