// Picking a related row or a person: one of our dropdowns under
// the cell, with a search past five (T10); a relation holding several ticks rows from a list, as
// tags are (T15), kept when the list closes. No Add new…: a new related row is made on its own
// table. The core checks that each pick is there; files, and many rows at once, stay with Alpha.
import type { FieldView, Pick } from '@alpha/core/api'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { api } from '../api.ts'
import { cn } from '../ui/cn.ts'
import { SEARCH_PAST, SearchLine } from '../ui/field.tsx'
import { MenuItem, MenuLine, Popover } from '../ui/popover.tsx'

// how many lines a picker draws at once; typing finds the rest
export const SHOWN = 50

// Where a field's picks come from: the rows of the table it points at, or the person's people.
export const picksFrom = (f: FieldView) =>
  f.kind === 'person' ? '/api/people/names' : `/api/tables/${f.relatesTo}/names`

// The picks whose name or hint holds these words, the ones held first.
export function narrowed(picks: Pick[], words: string, held: string[]): Pick[] {
  const w = words.trim().toLowerCase()
  const hits = picks.filter(
    (p) => !w || p.name.toLowerCase().includes(w) || !!p.hint?.toLowerCase().includes(w),
  )
  return [...hits.filter((p) => held.includes(p.id)), ...hits.filter((p) => !held.includes(p.id))]
}

// What a pick sends: a list for a relation holding several, one id or none for the rest, or
// nothing at all when it is what was there.
export function pickedValue(field: FieldView, was: string[], now: string[]): unknown {
  if (now.length === was.length && now.every((x, i) => x === was[i])) return undefined
  return field.many ? now : (now[0] ?? null)
}

// A hint kept to one short line (a LinkedIn headline can run to a paragraph), whole on hover.
function Hint({ words }: { words: string }) {
  return (
    <span className="block max-w-48 truncate text-ink-3 text-sm" data-tip={words}>
      {words}
    </span>
  )
}

export function PickCell({
  field,
  value,
  box,
  onDone,
}: {
  field: FieldView
  value: unknown
  box: string // the cell's own edit look
  onDone: (value: unknown) => Promise<boolean> // undefined: left as it was
}) {
  const was = (Array.isArray(value) ? value : value == null ? [] : [value]).map(String)
  const [held, setHeld] = useState(was)
  const [picks, setPicks] = useState<Pick[] | null>(null)
  const [words, setWords] = useState('')
  const anchor = useRef<HTMLSpanElement>(null)
  const done = useRef(false)
  useEffect(() => {
    api.get<Pick[]>(picksFrom(field)).then(setPicks, () => setPicks([]))
  }, [field])
  const finish = async (now: string[] | null) => {
    if (done.current) return
    done.current = true
    // a refused pick keeps the list open, with what the core said beside the cell
    if (!(await onDone(now === null ? undefined : pickedValue(field, was, now))))
      done.current = false
  }
  // Escape leaves it as it was; a click away keeps a list's ticks
  const keys = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    void finish(null)
  }
  const name = (id: string) => picks?.find((p) => p.id === id)?.name ?? '…'
  const shown = picks ? narrowed(picks, words, held) : []
  return (
    <>
      <span ref={anchor} className={cn(box, 'flex items-center truncate')}>
        {held.map(name).join(', ')}
      </span>
      <Popover anchor={anchor} open onClose={() => void finish(field.many ? held : null)}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Escape inside the list leaves the value as it was */}
        <div className="flex max-h-80 min-w-56 flex-col p-1" onKeyDown={keys}>
          {(picks?.length ?? 0) > SEARCH_PAST && <SearchLine words={words} onWords={setWords} />}
          {picks === null && <p className="px-2.5 py-1.5 text-ink-3 text-md">Loading…</p>}
          {picks && shown.length === 0 && (
            <p className="px-2.5 py-1.5 text-ink-3 text-md">
              {picks.length ? 'No match.' : `Nothing to pick in ${field.name} yet.`}
            </p>
          )}
          <div role="menu" className="overflow-y-auto">
            {!field.many && held.length > 0 && (
              <>
                <MenuItem onClick={() => void finish([])}>
                  <span className="text-ink-3">None</span>
                </MenuItem>
                <MenuLine />
              </>
            )}
            {shown.slice(0, SHOWN).map((p) =>
              field.many ? (
                <label
                  key={p.id}
                  className="flex h-7.5 items-center gap-2 rounded-sm px-2.5 hover:bg-hover"
                >
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={held.includes(p.id)}
                    onChange={(e) =>
                      setHeld((h) =>
                        e.target.checked ? [...h, p.id] : h.filter((x) => x !== p.id),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                  {p.hint && <Hint words={p.hint} />}
                </label>
              ) : (
                <MenuItem
                  key={p.id}
                  checked={held[0] === p.id}
                  hint={p.hint ? <Hint words={p.hint} /> : undefined}
                  onClick={() => void finish([p.id])}
                >
                  <span className="truncate">{p.name}</span>
                </MenuItem>
              ),
            )}
            {shown.length > SHOWN && (
              <p className="px-2.5 py-1.5 text-ink-3 text-sm">
                {shown.length - SHOWN} more: type to find them.
              </p>
            )}
          </div>
        </div>
      </Popover>
    </>
  )
}
