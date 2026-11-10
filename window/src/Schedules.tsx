import type { KeptTable } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { Embedded } from './Rules.tsx'
import { useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Section } from './ui/section.tsx'

// Intelligence's Schedules: every schedule in one shared table, each opening its page.
export function Schedules({ version }: { version: number }) {
  // every module's schedules as one table from the core: On or Paused changes in its cell
  const [data, setData] = useState<KeptTable | null>(null)
  useEffect(() => {
    if (version >= 0) api.get<KeptTable>('/api/kept/schedules').then(setData, () => setData(null))
  }, [version])
  return (
    <Section title="Schedules" about="Every schedule, what it does and when it last ran.">
      {data && (
        <Embedded
          data={data}
          open={(id) => {
            window.location.hash = `#/schedule/${id}`
          }}
          rowAction={(r) => <RunNow id={r.id} />}
        />
      )}
    </Section>
  )
}

// A schedule run from the list (Kenil, 10 Nov); one already running says so beside it.
function RunNow({ id }: { id: string }) {
  const { busy, problem, act } = useAct()
  return (
    <span data-tip={problem ?? undefined} className="flex items-center">
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        className={problem ? 'text-warn' : undefined}
        onClick={(e) => {
          e.stopPropagation()
          void act(() => api.post(`/api/schedules/${id}/run`))
        }}
      >
        Run now
      </Button>
    </span>
  )
}
