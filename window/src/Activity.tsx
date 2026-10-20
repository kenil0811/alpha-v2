// Activity (design §11): every run of an agent or a reader, newest first, with its steps folded
// under it. A running one can be stopped.
import type { RunView } from '@alpha/core/api'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { when } from './Kits.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'

const STATE: Record<RunView['state'], string> = {
  running: 'Running',
  ok: 'Done',
  failed: 'Did not finish',
  stopped: 'Stopped',
}

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
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-6 py-8">
        <h1 className="text-xl text-ink">Activity</h1>
        {runs?.length === 0 && (
          <p className="text-base text-ink-2">
            Nothing has run on its own yet. Agents and readers show their runs here.
          </p>
        )}
        {runs?.map((r) => (
          <div key={r.id} className="rounded-lg border border-line px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={() => setOpen(open === r.id ? null : r.id)}
              >
                <div className="text-ink">
                  {r.agent ?? 'A try'}
                  {r.module ? <span className="text-ink-3"> · {r.module}</span> : null}
                </div>
                <div className={cn('text-sm', r.state === 'failed' ? 'text-warn' : 'text-ink-2')}>
                  {STATE[r.state]} · {when(r.startedAt)}
                  {r.steps.length ? ` · ${r.steps.length} steps` : ''}
                </div>
                {r.words && r.state !== 'running' && (
                  <div className="mt-1 text-base text-ink-2">{r.words}</div>
                )}
              </button>
              {r.state === 'running' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => api.post(`/api/runs/${r.id}/stop`).then(load, load)}
                >
                  Stop
                </Button>
              )}
            </div>
            {open === r.id && r.steps.length > 0 && (
              <ol className="mt-2 flex flex-col gap-1 border-t border-hair pt-2 text-base">
                {r.steps.map((s) => (
                  <li key={s.id} className="flex gap-3">
                    <span className="shrink-0 text-sm leading-5 text-ink-3">
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
          </div>
        ))}
      </div>
    </div>
  )
}
