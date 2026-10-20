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
        <h1 className="text-lg text-neutral-900">Activity</h1>
        {runs?.length === 0 && (
          <p className="text-sm text-neutral-500">
            Nothing has run on its own yet. Agents and readers show their runs here.
          </p>
        )}
        {runs?.map((r) => (
          <div key={r.id} className="rounded-lg border border-neutral-200 px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={() => setOpen(open === r.id ? null : r.id)}
              >
                <div className="text-neutral-900">
                  {r.agent ?? 'A try'}
                  {r.module ? <span className="text-neutral-400"> · {r.module}</span> : null}
                </div>
                <div
                  className={cn(
                    'text-xs',
                    r.state === 'failed' ? 'text-amber-700' : 'text-neutral-500',
                  )}
                >
                  {STATE[r.state]} · {when(r.startedAt)}
                  {r.steps.length ? ` · ${r.steps.length} steps` : ''}
                </div>
                {r.words && r.state !== 'running' && (
                  <div className="mt-1 text-sm text-neutral-700">{r.words}</div>
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
              <ol className="mt-2 flex flex-col gap-1 border-t border-neutral-100 pt-2 text-sm">
                {r.steps.map((s) => (
                  <li key={s.id} className="flex gap-3">
                    <span className="shrink-0 text-xs leading-5 text-neutral-400">
                      {new Date(s.at).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <span className={cn(s.kind === 'told' && 'text-neutral-900')}>{s.words}</span>
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
