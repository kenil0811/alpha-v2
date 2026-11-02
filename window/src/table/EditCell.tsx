// A value changed in place, in the grid and in an opened row (T4): typed, a choice from Alpha's own
// dropdown (Batch D, 66.5), tags from a tick list (T15), or a related row or a person picked (Batch
// B, 14b; Pick.tsx). Out of Grid.tsx so that screen only shrinks (the window file wall).
import type { FieldView } from '@alpha/core/api'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { askForNew } from '../ask.ts'
import { cn } from '../ui/cn.ts'
import { Select } from '../ui/field.tsx'
import { Popover } from '../ui/popover.tsx'
import { useTableName } from './context.ts'
import { PickCell } from './Pick.tsx'
import { TagChips, TagPicker } from './Tags.tsx'
import { canPick, isTags, NUMERIC, readValue, typedOf } from './values.ts'

// A value being changed in place: Enter or leaving saves it as the person's word, Escape leaves it.
export function EditCell({
  field,
  value,
  onDone,
}: {
  field: FieldView
  value: unknown
  onDone: (value: unknown) => Promise<boolean> // undefined: left as it was
}) {
  const start = typedOf(field, value)
  const [typed, setTyped] = useState(start)
  const [problem, setProblem] = useState<string | null>(null)
  const done = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const anchor = useRef<HTMLSpanElement>(null)
  const table = useTableName()
  useEffect(() => {
    input.current?.focus()
    if (input.current && 'select' in input.current) input.current.select?.()
  }, [])
  const save = async () => {
    if (done.current) return
    if (typed === start) {
      done.current = true
      await onDone(undefined)
      return
    }
    const read = readValue(field, typed, value)
    if ('problem' in read) return setProblem(read.problem)
    done.current = true
    if (!(await onDone(read.value))) done.current = false
  }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void save()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      done.current = true
      void onDone(undefined)
    }
  }
  const box = cn(
    'h-9.5 w-full rounded-none border-0 bg-surface px-2.5 text-md text-ink outline-none ring-2 ring-accent ring-inset',
    problem && 'ring-bad',
  )
  // a related row or a person: picked from a list, never typed
  if (canPick(field)) return <PickCell field={field} value={value} box={box} onDone={onDone} />
  // tags: a tick list under the cell, saved when it closes
  if (isTags(field))
    return (
      <>
        <span ref={anchor} className={cn(box, 'flex items-center')} title={problem ?? undefined}>
          <TagChips field={field} value={typed.split(',').map((x) => x.trim())} />
        </span>
        <Popover anchor={anchor} open onClose={() => void save()}>
          {/* Escape leaves it as it was, as in every other cell; a click away keeps the ticks */}
          <TagPicker field={field} typed={typed} onTyped={setTyped} onKeyDown={key} />
        </Popover>
      </>
    )
  // a choice: the shared dropdown, open at once, saved on a pick; Escape or a click away leaves it
  if (field.kind === 'choice')
    return (
      <Select
        of={field}
        startOpen
        value={typed}
        aria-label={field.name}
        title={problem ?? undefined}
        className={cn(box, 'rounded-none border-0')}
        onChange={(e) => {
          const read = readValue(field, e.target.value, value)
          if ('problem' in read) return setProblem(read.problem)
          done.current = true
          void onDone(read.value).then((ok) => {
            if (!ok) done.current = false
          })
        }}
        onDismiss={() => {
          done.current = true
          void onDone(undefined)
        }}
        adds={
          table
            ? { what: 'choice', send: (w) => askForNew('choice', `${field.name} in ${table}`, w) }
            : undefined
        }
      >
        <option value="" />
        {field.choices.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>
    )
  return (
    <input
      ref={input}
      value={typed}
      aria-label={field.name}
      title={problem ?? undefined}
      type={field.kind === 'date' ? 'date' : 'text'}
      inputMode={NUMERIC.has(field.kind) ? 'decimal' : undefined}
      onChange={(e) => {
        setTyped(e.target.value)
        setProblem(null)
      }}
      onBlur={() => void save()}
      onKeyDown={key}
      className={cn(box, NUMERIC.has(field.kind) && 'text-right tabular-nums')}
    />
  )
}
