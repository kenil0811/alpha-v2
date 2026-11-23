// A task's line in a list: its state as a circle with its five states, its title, where it is and
// when it is due. Finishing it is saved at once; its tick draws, its line is struck through, and it
// folds away while it is held (ui/motion.ts), so a live update cannot take it early.
import type { TaskLineView } from '@alpha/core/api'
import { Check, Clock, Repeat2, X } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { api } from './api.ts'
import { dueWords } from './time.ts'
import { cn } from './ui/cn.ts'
import { FRAME } from './ui/frame.tsx'
import { Arrivals, useArrived } from './ui/list.tsx'
import { fold, leaveWith, pause, unfold, useLeaving } from './ui/motion.ts'
import { Pill } from './ui/pill.tsx'
import { MenuItem, Popover } from './ui/popover.tsx'

export const STATES: { value: TaskLineView['state']; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'In progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'done', label: 'Done' },
  { value: 'dropped', label: 'Dropped' },
]

const open = (t: TaskLineView) => t.state === 'todo' || t.state === 'doing' || t.state === 'waiting'

const setState = (id: string, state: TaskLineView['state']) =>
  api.post(`/api/tasks/${id}/state`, { state })

// A task's state as a circle; a click opens its five states, never closing it by itself.
function Tick({
  t,
  onChange,
  onFinish,
  finishing,
}: {
  t: TaskLineView
  onChange: () => void
  onFinish?: (() => void) | undefined // finishing it shows the tick and the line struck first
  finishing?: boolean | undefined
}) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [choosing, setChoosing] = useState(false)
  const label = STATES.find((x) => x.value === t.state)?.label ?? t.state
  const choose = (state: TaskLineView['state']) => {
    setChoosing(false)
    if (state === t.state) return
    if (state === 'done' && onFinish) return onFinish()
    setState(t.id, state).then(onChange, onChange)
  }
  const done = finishing || t.state === 'done'
  return (
    <>
      <button
        ref={anchor}
        type="button"
        data-tip={`${label}: change it`}
        aria-label={`${t.title}: ${label}. Change its state`}
        aria-haspopup="menu"
        onClick={() => setChoosing((c) => !c)}
        className={cn(
          'grid size-4.5 shrink-0 place-items-center rounded-full border transition-colors duration-200 hover:border-accent',
          done
            ? 'border-good bg-good text-surface'
            : t.state === 'doing'
              ? 'border-accent text-accent'
              : t.state === 'waiting'
                ? 'border-warn text-warn'
                : t.state === 'dropped'
                  ? 'border-line text-ink-3'
                  : 'border-line',
        )}
      >
        {done && <Check className={cn('size-3', finishing && 'tick-draw')} />}
        {!done && t.state === 'doing' && <span className="size-2 rounded-full bg-accent" />}
        {t.state === 'waiting' && <Clock className="size-2.75" />}
        {t.state === 'dropped' && <X className="size-2.75" />}
      </button>
      <Popover anchor={anchor} open={choosing} onClose={() => setChoosing(false)}>
        {STATES.map((x) => (
          <MenuItem key={x.value} checked={x.value === t.state} onClick={() => choose(x.value)}>
            {x.label}
          </MenuItem>
        ))}
      </Popover>
    </>
  )
}

function Meta({ t, place = true }: { t: TaskLineView; place?: boolean }) {
  const bits: ReactNode[] = []
  if (place && t.place.path.length)
    bits.push(
      <span key="p" className="truncate">
        {t.place.path.join(' › ')}
      </span>,
    )
  if (t.ownerKind !== 'person') bits.push(<span key="o">{t.owner}</span>)
  if (t.children) bits.push(<span key="c">{`${t.childrenDone} of ${t.children} done`}</span>)
  return bits.length ? (
    <span className="flex min-w-0 items-center gap-2 truncate text-ink-3 text-sm">{bits}</span>
  ) : null
}

function Due({ t }: { t: TaskLineView }) {
  if (!t.due) return null
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1 text-sm tabular-nums',
        t.overdue ? 'text-bad' : 'text-ink-3',
      )}
    >
      {t.repeat && <Repeat2 className="size-3" aria-label={t.repeat} />}
      {t.remindAt && <Clock className="size-3" aria-label="With a reminder" />}
      {dueWords(t.due)}
    </span>
  )
}

export function TaskLine({
  t,
  onChange,
  place,
}: {
  t: TaskLineView
  onChange: () => void
  place?: boolean
}) {
  // Finishing a task: saved at once, then its tick draws and its line is struck through, a beat to
  // see it, and it folds away so the list closes up. The line is held while it leaves (ui/motion.ts),
  // so a live update cannot take it early; if the save fails it comes back, with its problem.
  const row = useRef<HTMLDivElement>(null)
  const arrived = useArrived() // new to a list already drawn: it rises in once
  const [finishing, setFinishing] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const leaving = useRef(false)
  const finish = async () => {
    leaving.current = true
    setProblem(null)
    setFinishing(true)
    try {
      await leaveWith(
        t.id,
        () => setState(t.id, 'done'),
        async () => {
          await pause(550)
          await fold(row.current)
        },
        () => {
          unfold(row.current)
          setFinishing(false)
        },
      )
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'It was not saved.')
    } finally {
      leaving.current = false
      onChange()
    }
  }
  // a list that keeps finished ones shows it again once it has left
  useEffect(() => {
    if (leaving.current) return
    if (t.state === 'done') unfold(row.current)
    setFinishing(false)
  }, [t.state])
  return (
    <div
      ref={row}
      className={cn(
        'flex items-center gap-3 border-hair border-t px-4 py-2.5 first:border-t-0 hover:bg-hover',
        arrived && 'rise-in',
      )}
    >
      <Tick t={t} onChange={onChange} onFinish={finish} finishing={finishing} />
      <a href={`#/tasks/${t.id}`} className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-base',
            open(t) && !finishing ? 'text-ink' : 'text-ink-3',
          )}
        >
          {t.priority === 'high' && <span className="mr-1.5 text-warn">●</span>}
          <span className={cn('strike', (finishing || !open(t)) && 'strike-on')}>{t.title}</span>
        </span>
        <Meta t={t} place={place ?? true} />
      </a>
      {problem && <span className="text-bad text-sm">{problem}</span>}
      {t.state === 'doing' && <Pill tone="accent">In progress</Pill>}
      {t.state === 'waiting' && <Pill>Waiting</Pill>}
      <Due t={t} />
    </div>
  )
}

export function TaskList({ lines, onChange }: { lines: TaskLineView[]; onChange: () => void }) {
  const shown = useLeaving(lines, (t) => t.id)
  return (
    <div className={`${FRAME} overflow-hidden`}>
      <Arrivals>
        {shown.map((t) => (
          <TaskLine key={t.id} t={t} onChange={onChange} />
        ))}
      </Arrivals>
    </div>
  )
}
