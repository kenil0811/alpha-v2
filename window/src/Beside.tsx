// Beside the conversation on a wide window (Kenil, 20 Oct: the chat's empty sides): what waits on
// the person, each jumping to its card in the stream; what is running; and each agent's next run.
// What changed since they last looked stays on Home.
import type { TodayView } from '@alpha/core/api'
import { KeyRound, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import type { Stream } from './coming.ts'
import type { Module } from './stream.ts'
import { dayWords } from './time.ts'
import { Button } from './ui/button.tsx'
import { Group, Line, Quiet } from './ui/groups.tsx'
import { NEEDS_YOU } from './vocabulary.ts'

export function Beside({
  stream,
  lens,
  gate,
  onCard,
}: {
  stream: Stream | null
  lens: Module
  gate: (g: string | null) => string
  onCard: (id: string) => void
}) {
  const [today, setToday] = useState<TodayView | null>(null)
  const last = stream?.lastId
  const load = useCallback(() => {
    api.get<TodayView>('/api/today').then(setToday, () => undefined)
  }, [])
  useEffect(() => {
    if (last !== undefined) load()
  }, [load, last])
  const inLens = (module: string | null) =>
    !lens || (module !== null && (lens.ids ?? [lens.id]).includes(module))
  const cards = (stream?.cards ?? []).filter((c) => inLens(c.module))
  const signIns = lens ? [] : (stream?.attention ?? [])
  const running = (stream?.running ?? []).filter((r) => inLens(r.module))
  const coming = (today?.coming ?? []).filter((c) => inLens(c.module))
  return (
    <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-hair border-l @min-[1100px]:flex">
      <div className="flex flex-col gap-6 px-5 pt-7 pb-6">
        <Group title={NEEDS_YOU} count={cards.length + signIns.length}>
          {cards.map((c) => (
            <Line
              key={c.id}
              icon={<TriangleAlert className="size-3.5 text-warn" />}
              head={gate(c.gate)}
              words={c.words}
              onClick={() => onCard(c.id)}
            />
          ))}
          {signIns.map((a) => (
            <Line
              key={a.connector}
              icon={<KeyRound className="size-3.5 text-warn" />}
              head="Sign-in"
              words={`${a.title} needs you to sign in again`}
              href={`#/settings?connect=${a.connector}`}
            />
          ))}
        </Group>
        {running.length > 0 && (
          <Group title="Running">
            {running.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 text-md">
                <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
                <span className="min-w-0 flex-1 truncate text-ink">{r.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => api.post(`/api/runs/${r.id}/stop`)}
                >
                  Stop
                </Button>
              </div>
            ))}
          </Group>
        )}
        <Group title="Coming up">
          {today && coming.length === 0 && <Quiet>No agent runs on the clock.</Quiet>}
          {coming.map((c) => (
            <div key={c.agent} className="flex items-baseline gap-2 text-md">
              <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
              <span className="shrink-0 text-ink-3 text-sm">{dayWords(c.at)}</span>
            </div>
          ))}
        </Group>
      </div>
    </aside>
  )
}
