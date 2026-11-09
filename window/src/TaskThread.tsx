// A task's own thread with the agent that has it, on the task's page: the same chat as anywhere
// else, so you can watch it, write to it or stop it.
import type { Stream, TaskView } from '@alpha/core/api'
import { useCallback, useEffect, useState } from 'react'
import { api, listen } from './api.ts'
import { Conversation } from './Conversation.tsx'
import { Button } from './ui/button.tsx'

export function TaskThread({ task, onChange }: { task: TaskView; onChange: () => void }) {
  const [stream, setStream] = useState<Stream | null>(null)
  const [busyTurn, setBusyTurn] = useState<string | null>(null)
  const load = useCallback(async () => {
    const s = await api.get<Stream>(`/api/stream?task=${task.id}`)
    setStream(s)
    setBusyTurn((b) => (s.busy ? (b ?? s.lines.at(-1)?.turn ?? null) : null))
  }, [task.id])
  useEffect(() => {
    void load()
    return listen((e) => {
      if (e.type === 'busy' && e.task === task.id) setBusyTurn(e.turn)
      if (e.type === 'lines' || (e.type === 'idle' && e.task === task.id)) void load()
    })
  }, [task.id, load])
  if (!task.agent) return null
  const stuck =
    task.state === 'waiting' &&
    stream &&
    !stream.busy &&
    !stream.cards.some((c) => c.task === task.id)
  return (
    <div className="flex flex-col gap-2">
      {stuck && (
        <Button
          size="sm"
          className="self-start"
          onClick={() => void api.post(`/api/tasks/${task.id}/run`).then(onChange)}
        >
          Run again
        </Button>
      )}
      <div className="-mx-7 h-[min(620px,75vh)] border-hair border-t">
        <Conversation
          stream={stream}
          busyTurn={busyTurn}
          compact
          agent={task.agent}
          task={task.id}
        />
      </div>
    </div>
  )
}
