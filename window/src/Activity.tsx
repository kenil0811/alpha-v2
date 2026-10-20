// Activity (design §11): every run of an agent or a reader, newest first, with its steps folded
// under it. A running one can be stopped. (Step 6 of the redesign groups them by day.)
import type { RunView } from '@alpha/core/api'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { when } from './Kits.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { List, Row } from './ui/list.tsx'
import { Pill, type Tone } from './ui/pill.tsx'

const STATE: Record<RunView['state'], [string, Tone]> = {
  running: ['Running', 'accent'],
  ok: ['Done', 'good'],
  failed: ["Didn't finish", 'bad'],
  stopped: ['Stopped', 'neutral'],
}

// a run's time in the mono column: 24-hour, so it never wraps
const time = (at: string) =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })

export function Activity({ version }: { version: number }) {
  const [runs, setRuns] = useState<RunView[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const load = useCallback(() => {
    api.get<RunView[]>('/api/activity').then(setRuns, () => setRuns([]))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-215 flex-col gap-4 px-8 py-7">
        <h1 className="text-2xl text-ink">Activity</h1>
        {runs?.length === 0 && (
          <p className="text-ink-2 text-md">
            Nothing has run on its own yet. Agents and readers show their runs here.
          </p>
        )}
        {runs && runs.length > 0 && (
          <List>
            {runs.map((r) => {
              const [state, tone] = STATE[r.state]
              return (
                <Row
                  key={r.id}
                  className="cursor-pointer hover:bg-hover"
                  lead={
                    <span className="w-12 shrink-0 font-mono text-ink-3 text-sm">
                      {time(r.startedAt)}
                    </span>
                  }
                  title={
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setOpen(open === r.id ? null : r.id)}
                    >
                      {r.agent ?? 'A try'}
                      {r.module && <span className="font-normal text-ink-3"> · {r.module}</span>}
                    </button>
                  }
                  sub={
                    <span className={cn(r.state === 'failed' && 'text-warn')}>
                      {r.words && r.state !== 'running' ? r.words : when(r.startedAt)}
                      {r.steps.length ? ` · ${r.steps.length} steps` : ''}
                    </span>
                  }
                  actions={
                    <>
                      <Pill tone={tone}>{state}</Pill>
                      {r.state === 'running' && (
                        <Button
                          size="sm"
                          onClick={() => api.post(`/api/runs/${r.id}/stop`).then(load, load)}
                        >
                          Stop
                        </Button>
                      )}
                    </>
                  }
                >
                  {open === r.id && r.steps.length > 0 && (
                    <ol className="mx-4 mb-3 ml-19 flex flex-col gap-1.5 border-line border-t border-dashed pt-2.5">
                      {r.steps.map((s) => (
                        <li
                          key={s.id}
                          className="grid grid-cols-[4rem_1fr] gap-2.5 text-ink-2 text-md"
                        >
                          <span className="pt-0.5 font-mono text-ink-3 text-xs">
                            {new Date(s.at).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                          <span className={cn(s.kind === 'told' && 'text-ink')}>{s.words}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </Row>
              )
            })}
          </List>
        )}
      </div>
    </div>
  )
}
