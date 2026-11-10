// The work on a task. On the task's page it is one line, saying how it stands and opening the work;
// the work itself has its own page: the same chat as anywhere else, to watch, write to or stop.
import type { Stream, TaskView } from '@alpha/core/api'
import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api, listen } from './api.ts'
import { Conversation } from './Conversation.tsx'
import { Button } from './ui/button.tsx'

const HOW: Record<string, string> = {
  todo: 'will start when a place comes free',
  doing: 'is working on this',
  waiting: 'is waiting on you',
  done: 'finished this',
  dropped: 'stopped when this was dropped',
}

export function TaskWorkLine({ task }: { task: TaskView }) {
  if (!task.agent) return null
  return (
    <a
      href={`#/tasks/${task.id}/work`}
      className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-md hover:bg-hover"
    >
      {task.state === 'doing' && (
        <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-ink-3" />
      )}
      <span className="min-w-0 flex-1 truncate text-ink">
        {task.agent.name} {HOW[task.state]}
      </span>
      <span className="shrink-0 text-ink-3">Open the work</span>
      <ChevronRight className="size-3.5 shrink-0 text-ink-3" />
    </a>
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
