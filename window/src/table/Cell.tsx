// One cell of a table's grid: its value as the column shows it (a choice, tags, words that run
// on over the empty cells after it, wrap or are clipped), its mark where Alpha is not sure (R7), its
// open tasks, and a newer value kept beside it (D3). A click picks it, a double-click edits it.
import type { FieldView, RowView } from '@alpha/core/api'
import { ListChecks } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { cn } from '../ui/cn.ts'
import { Dot } from '../ui/dot.tsx'
import { Choice } from '../ui/pill.tsx'
import { tipNow } from '../ui/tooltip.tsx'
import type { Spill } from './layout.ts'
import { TagChips } from './Tags.tsx'
import {
  EMPTY_CELL,
  EMPTY_WORDS,
  INK,
  isTags,
  KIND_WORDS,
  MARK,
  NUMERIC,
  show,
  TINT,
} from './values.ts'

export function Cell({
  field: f,
  row: r,
  names,
  first,
  spill,
  room,
  under,
  tasks,
  tone,
  selected,
  inRange,
  onPick,
  onEdit,
  fixed,
}: {
  field: FieldView
  row: RowView
  names: Record<string, string>
  first: boolean
  spill: Spill
  room: number | undefined // how wide its words may run on over the empty cells after it
  under: boolean // an empty cell the one before runs on over: no dash
  tasks: number
  tone: string | null
  selected: boolean
  inRange: boolean // under the picked cell, in its ⇧↓ range
  onPick: () => void
  onEdit: (() => void) | undefined
  fixed: string | undefined // why it can't be changed here
}) {
  const value = r.values[f.slug]
  const source = r.sources[f.slug]
  const text = show(f, value, names)
  const mark = source ? MARK[source.kind] : undefined
  const empty = value === null || value === undefined || text === ''
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (onEdit && (e.key === 'Enter' || e.key === 'F2')) {
      e.preventDefault()
      onEdit()
    }
  }
  return (
    <div className="group/cell relative flex">
      <button
        type="button"
        // WebKit does not focus a button on a click; the cell needs it for Enter, F2 and a paste
        onClick={(e) => {
          e.currentTarget.focus({ preventScroll: true })
          onPick()
        }}
        onDoubleClick={(e) => (onEdit ? onEdit() : fixed && tipNow(e.currentTarget, fixed))}
        onKeyDown={key}
        className={cn(
          'group flex w-full min-w-0 items-center gap-0.75 px-2.5 text-left tabular-nums',
          first ? 'cursor-pointer' : 'cursor-default', // only the first cell opens its row
          spill === 'wrap' ? 'min-h-9.5 py-2' : 'h-9.5',
          NUMERIC.has(f.kind) && 'justify-end',
          // a value that meets its colour's rule fills its cell
          tone && !empty && TINT[tone],
          selected && 'bg-accent-soft ring-2 ring-accent ring-inset',
          inRange && 'bg-accent-soft',
        )}
      >
        {empty ? (
          !under && (
            <span className="text-ink-3" data-tip={EMPTY_WORDS}>
              {EMPTY_CELL}
            </span>
          )
        ) : isTags(f) ? (
          <TagChips field={f} value={value} />
        ) : f.kind === 'choice' ? (
          <Choice of={f} value={text} />
        ) : (
          <span
            // running on, it is drawn over the empty cells after it (relative, under a frozen column)
            style={room ? { maxWidth: room } : undefined}
            className={cn(
              spill === 'wrap'
                ? 'break-words'
                : spill === 'clip'
                  ? 'overflow-hidden'
                  : room
                    ? 'relative shrink-0 truncate'
                    : 'truncate',
              first && 'font-medium group-hover:underline',
              // an italic glyph leans past its box; the room keeps it whole
              mark && 'pr-0.5 text-ink-2 italic',
              tone && INK[tone],
            )}
            data-tip={text.length > 30 ? text : undefined}
          >
            {text}
          </span>
        )}
        {mark && !empty && source && (
          <span
            data-tip={KIND_WORDS[source.kind]}
            className="self-start pt-2 text-ink-3 text-xs leading-none"
          >
            {mark}
          </span>
        )}
        {tasks > 0 && (
          <span
            data-tip={tasks === 1 ? '1 open task' : `${tasks} open tasks`}
            className="ml-auto flex shrink-0 items-center gap-0.5 pl-1.5 text-ink-3 text-xs"
          >
            <ListChecks className="size-3" />
            {tasks}
          </span>
        )}
      </button>
      {/* a newer value kept beside theirs, or a script's figure (rules D3): its words on hover */}
      {source?.beside && (
        <Dot s="read" tip={source.beside.words} className="absolute top-1.5 right-1.5" />
      )}
    </div>
  )
}
