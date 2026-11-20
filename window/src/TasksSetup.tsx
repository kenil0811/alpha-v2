// Tasks' Setup, as a module's: the schedules that make tasks, the agents holding them and the
// properties a task has, each a part in the module Setup's own look.
import type { FieldView, ScheduleView, WorkingModuleView } from '@alpha/core/api'
import { useCallback, useEffect, useState } from 'react'
import { useAgents } from './Agents.tsx'
import { api } from './api.ts'
import { OneSchedule, Part } from './ModuleSetup.tsx'
import { List, Row } from './ui/list.tsx'

export function TasksSetup({ version, fields }: { version: number; fields: FieldView[] }) {
  const [modules, setModules] = useState<WorkingModuleView[]>([])
  const load = useCallback(() => {
    api.get<WorkingModuleView[]>('/api/working').then(setModules, () => undefined)
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const agents = useAgents(version)
  // a schedule that wakes an agent hands it a task each time it runs
  const making: ScheduleView[] = modules.flatMap((m) => m.schedules).filter((s) => s.wakes)
  const held = agents.filter((a) => making.some((s) => s.wakes?.id === a.id))
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex max-w-page flex-col gap-7 px-7 py-6">
        <Part title="Schedules" about="The schedules that hand an agent a task each time they run.">
          {making.length ? (
            <List>
              {making.map((s) => (
                <OneSchedule key={s.id} a={s} agents={agents} onChange={load} />
              ))}
            </List>
          ) : (
            <p className="text-ink-2 text-md">No schedule makes tasks yet.</p>
          )}
        </Part>
        <Part title="Agents" about="The agents a schedule gives tasks to.">
          {held.length ? (
            <List>
              {held.map((a) => {
                const n = making.filter((s) => s.wakes?.id === a.id).length
                return (
                  <Row
                    key={a.id}
                    className="relative hover:bg-canvas"
                    title={
                      <a href={`#/agent/${a.id}`} className="after:absolute after:inset-0">
                        {a.name}
                      </a>
                    }
                    sub={`${a.title} · ${n} schedule${n === 1 ? '' : 's'}`}
                  />
                )
              })}
            </List>
          ) : (
            <p className="text-ink-2 text-md">No agent holds a task yet.</p>
          )}
        </Part>
        <Part title="Properties" about="What every task has.">
          <List>
            {fields.map((f) => (
              <Row
                key={f.id}
                title={f.name}
                sub={f.choices.length ? f.choices.join(', ') : f.kind}
              />
            ))}
          </List>
        </Part>
      </div>
    </div>
  )
}
