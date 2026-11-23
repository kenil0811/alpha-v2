// The work on a task. On the task's page it is one line, saying how it stands and opening the work;
// the work itself has its own page: the same chat as anywhere else, to watch, write to or stop.
import type { Stream, TaskView } from '@alpha/core/api'
import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api, listen } from './api.ts'
import { Conversation } from './Conversation.tsx'
import { dayWords, toLocalInput } from './time.ts'
import { Busy } from './ui/busy.tsx'
import { Button } from './ui/button.tsx'
import { Field } from './ui/field.tsx'
import { FRAME } from './ui/frame.tsx'
import { Info } from './ui/info.tsx'

const HOW: Record<string, string> = {
  todo: 'starts when its agent finishes one of its tasks',
  doing: 'is working on this',
  waiting: 'is waiting on you',
  done: 'finished this',
  dropped: 'stopped when this was dropped',
}

// When an agent given this task begins; empty is as soon as it is given.
function StartsAt({ task }: { task: TaskView }) {
  return (
    <div className="flex items-center gap-2 text-ink-3 text-sm">
      Starts
      {!task.agent && <Info help="It starts then, once it is given to an agent." />}
      <Field
        type="datetime-local"
        aria-label="Starts"
        defaultValue={task.startsAt ? toLocalInput(task.startsAt) : ''}
        onChange={(e) =>
          void api.post(`/api/tasks/${task.id}`, { startsAt: e.target.value || null })
        }
      />
    </div>
  )
}

export function TaskWorkLine({ task }: { task: TaskView }) {
  const waits = task.state === 'todo' && !task.schedule
  if (!task.agent) return waits ? <StartsAt task={task} /> : null
  const later =
    task.state === 'todo' && task.beginsAt && Date.parse(task.beginsAt) > Date.now()
      ? `will start ${dayWords(task.beginsAt)}`
      : null
  return (
    <>
      <a
        href={`#/tasks/${task.id}/work`}
        className={`${FRAME} flex items-center gap-2 px-4 py-3 text-md hover:bg-hover`}
      >
        <span className="min-w-0 flex-1 truncate text-ink">
          {task.state === 'doing' ? (
            <Busy>
              {task.agent.name} {later ?? HOW[task.state]}
            </Busy>
          ) : (
            <>
              {task.agent.name} {later ?? HOW[task.state]}
            </>
          )}
        </span>
        <span className="shrink-0 text-ink-3">See what it did</span>
        <ChevronRight className="size-3.5 shrink-0 text-ink-3" />
      </a>
      {task.schedule && (
        <a href={`#/schedule/${task.schedule.id}`} className="text-ink-3 text-sm hover:text-ink">
          From {task.schedule.name}
        </a>
      )}
      {waits && <StartsAt task={task} />}
    </>
  )
}

export function TaskWork({
  id,
  version,
  onName,
}: {
  id: string
  version: number
  onName: (name: string) => void
}) {
  const [task, setTask] = useState<TaskView | null>(null)
  const [stream, setStream] = useState<Stream | null>(null)
  const [busyTurn, setBusyTurn] = useState<string | null>(null)
  const load = useCallback(async () => {
    const [t, s] = await Promise.all([
      api.get<TaskView>(`/api/tasks/${id}`),
      api.get<Stream>(`/api/stream?task=${id}`),
    ])
    setTask(t)
    onName(t.title)
    setStream(s)
    setBusyTurn((b) => (s.busy ? (b ?? s.lines.at(-1)?.turn ?? null) : null))
  }, [id, onName])
  useEffect(() => {
    if (version >= 0) void load()
  }, [load, version])
  useEffect(
    () =>
      listen((e) => {
        if (e.type === 'busy' && e.task === id) setBusyTurn(e.turn)
        if (e.type === 'idle' && e.task === id) void load()
      }),
    [id, load],
  )
  if (!task?.agent) return null
  const stuck =
    task.state === 'waiting' && stream && !stream.busy && !stream.cards.some((c) => c.task === id)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-stream items-center justify-between gap-3 px-8 pt-3">
        <a href={`#/tasks/${id}`} className="text-ink-3 text-sm hover:text-ink">
          Back to the task
        </a>
        {stuck && (
          <Button size="sm" onClick={() => void api.post(`/api/tasks/${id}/run`).then(load)}>
            Run again
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <Conversation stream={stream} busyTurn={busyTurn} agent={task.agent} task={id} />
      </div>
    </div>
  )
}
