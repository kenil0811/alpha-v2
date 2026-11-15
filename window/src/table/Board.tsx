import type { FieldView, RowView, TableView as TableData } from '@alpha/core/api'
import { type DragEvent, useEffect, useRef, useState } from 'react'
import { api } from '../api.ts'
import { askForNew } from '../ask.ts'
import { Refusal, useAct } from '../ui/act.tsx'
import { cn } from '../ui/cn.ts'
import { Select } from '../ui/field.tsx'
import { Choice } from '../ui/pill.tsx'
import { show } from './values.ts'

// The board: a column per choice, each row a card with its name and a few of its values, moved
// by setting its choice (the person's own word): dragged onto any other column, or picked below
// it. A card dragged near the board's left or right edge scrolls it, so a column out of sight
// takes it too.
// A card's name opens the row, as a row's first cell does in the table. New sits in the toolbar
// above it, as for every layout (TableView).
// how near the board's edge a dragged card scrolls it, in pixels
const EDGE = 96
// how far a frame scrolls the board with a card held at its very edge
const SCROLL_PX = 16

export function Board({
  data,
  by,
  rowsAt = `/api/tables/${data.id}/rows`,
  onOpen,
}: {
  data: TableData
  by: FieldView
  rowsAt?: string // where a moved card's change goes: a kept list's rows when it is one
  onOpen: (row: string) => void
}) {
  const { busy, on, problem, act } = useAct()
  const [over, setOver] = useState<string | null>(null) // the column a card is dragged over
  const name = data.fields.find((f) => f.kind === 'text')
  // on a card: up to two amounts, then up to two other choices, each only when it has a value
  const others = data.fields.filter((f) => f !== name && f !== by)
  const cardFields = (r: RowView) => [
    ...others.filter((f) => f.kind === 'money' && r.values[f.slug] != null).slice(0, 2),
    ...others.filter((f) => f.kind === 'choice' && r.values[f.slug] != null).slice(0, 2),
  ]
  const move = (row: string, value: string) =>
    act(() => api.post(`${rowsAt}/${row}`, { field: by.name, value }), row)
  const columns = [...by.choices, '']
  const strip = useRef<HTMLDivElement>(null)
  // the scroll under a card held near an edge: its speed (-1 to 1) and the frame that moves it. A
  // card held still is not heard from again, so the scroll goes on by itself until the card leaves
  // the edge or the board, the drag ends, or the board can go no further.
  const scroll = useRef({ speed: 0, frame: 0 })
  const stop = () => {
    scroll.current.speed = 0
    cancelAnimationFrame(scroll.current.frame)
    scroll.current.frame = 0
  }
  useEffect(() => stop, [])
  const edge = (e: DragEvent<HTMLDivElement>) => {
    const el = strip.current
    if (!el || !e.dataTransfer.types.includes('text/x-alpha-row')) return
    const box = el.getBoundingClientRect()
    const s = scroll.current
    s.speed =
      e.clientX > box.right - EDGE
        ? Math.min(1, (e.clientX - (box.right - EDGE)) / EDGE)
        : e.clientX < box.left + EDGE
          ? -Math.min(1, (box.left + EDGE - e.clientX) / EDGE)
          : 0
    if (!s.speed || s.frame) return
    const step = () => {
      const at = strip.current
      if (!s.speed || !at) return stop()
      const was = at.scrollLeft
      at.scrollLeft += s.speed * SCROLL_PX
      if (at.scrollLeft === was) return stop()
      s.frame = requestAnimationFrame(step)
    }
    s.frame = requestAnimationFrame(step)
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto px-7 pb-3">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a dragged card near an edge scrolls the board; each card's own picker moves it by keyboard */}
      <div
        ref={strip}
        onDragOver={edge}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) stop()
        }}
        className="flex gap-3 overflow-x-auto pb-2"
      >
        {columns.map((choice) => {
          const rows = data.rows.filter((r) => (r.values[by.slug] ?? '') === choice)
          if (choice === '' && rows.length === 0) return null
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: a card dropped here takes this choice; each card's own picker does it by keyboard
            <div
              key={choice || 'none'}
              onDragOver={(e) => {
                if (!choice || !e.dataTransfer.types.includes('text/x-alpha-row')) return
                e.preventDefault()
                setOver(choice)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null)
              }}
              onDrop={(e) => {
                setOver(null)
                stop()
                const [row, from] = e.dataTransfer.getData('text/x-alpha-row').split('\n')
                if (row && from !== choice) move(row, choice)
              }}
              className={cn(
                'flex w-56 shrink-0 flex-col gap-2 rounded-lg p-1',
                over === choice && 'bg-accent-soft',
              )}
            >
              <div className="flex justify-between px-1 text-sm text-ink-2">
                {choice ? (
                  <Choice of={by} value={choice} />
                ) : (
                  <span>No {by.name.toLowerCase()}</span>
                )}
                <span className="text-ink-3">{rows.length}</span>
              </div>
              {rows.map((r) => (
                // biome-ignore lint/a11y/noStaticElementInteractions: dragged by the pointer; the picker below moves it by keyboard
                <div
                  key={r.id}
                  id={`row-${r.id}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/x-alpha-row', `${r.id}\n${choice}`)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    setOver(null)
                    stop()
                  }}
                  title={`Drag to another ${by.name.toLowerCase()}`}
                  className="flex cursor-grab flex-col gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-base active:cursor-grabbing"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(r.id)}
                    className="cursor-pointer self-start text-left text-ink hover:underline"
                  >
                    {name ? show(name, r.values[name.slug]) || 'Untitled' : 'Untitled'}
                  </button>
                  {cardFields(r).map((f) => {
                    const v = show(f, r.values[f.slug], data.names)
                    return v ? (
                      <div key={f.id} className="text-sm text-ink-2">
                        {f.name}: {v}
                      </div>
                    ) : null
                  })}
                  <Select
                    of={by}
                    className="mt-1 h-6.5 text-sm"
                    value={choice}
                    disabled={busy && on === r.id}
                    aria-label={`Move to another ${by.name.toLowerCase()}`}
                    onChange={(e) => move(r.id, e.target.value)}
                    adds={{
                      what: 'choice',
                      send: (w) => askForNew('choice', `${by.name} in ${data.name}`, w),
                    }}
                  >
                    {choice === '' && <option value="">Move to</option>}
                    {by.choices.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                  {on === r.id && <Refusal words={problem} />}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
