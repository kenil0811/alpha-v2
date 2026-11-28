// Tasks' Setup, as a module's: the schedules that make tasks, the agents holding them and the
// properties a task has, each a part in the module Setup's own look.
import type { FieldView, ScheduleView, TasksView, WorkingModuleView } from '@alpha/core/api'
import { useCallback, useEffect, useState } from 'react'
import { useAgents } from './Agents.tsx'
import { api } from './api.ts'
import { OneSchedule } from './ModuleSetup.tsx'
import { List, Row } from './ui/list.tsx'
import { Part } from './ui/part.tsx'

export function TasksSetup({ version, fields }: { version: number; fields: FieldView[] }) {
  const [modules, setModules] = useState<WorkingModuleView[]>([])
  const load = useCallback(() => {
    api.get<WorkingModuleView[]>('/api/working').then(setModules, () => undefined)
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const agents = useAgents(version)
  // the open tasks, to count what each agent holds now
  const [open, setOpen] = useState<TasksView['lines']>([])
  useEffect(() => {
    if (version >= 0)
      api.get<TasksView>('/api/tasks?list=open').then(
        (v) => setOpen(v.lines),
        () => undefined,
      )
  }, [version])
  // every agent with an open task, the Chief of staff too, named by the agents list else by the
  // task's own owner words
  const held = [
    ...Map.groupBy(
      open.filter((t) => t.ownerId),
      (t) => t.ownerId as string,
    ),
  ]
    .map(([id, ts]) => {
      const a = agents.find((x) => x.id === id)
      return { id, name: a?.name ?? ts[0]?.owner ?? id, title: a?.title, n: ts.length }
    })
    .sort((x, y) => y.n - x.n)
  // a schedule that wakes an agent hands it a task each time it runs
  const making: ScheduleView[] = modules.flatMap((m) => m.schedules).filter((s) => s.wakes)
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
        <Part title="Agents" about="The agents that hold open tasks now.">
          {held.length ? (
            <List>
              {held.map((a) => {
                const n = a.n
                return (
                  <Row
                    key={a.id}
                    className="relative hover:bg-canvas"
                    title={
                      <a href={`#/agent/${a.id}`} className="after:absolute after:inset-0">
                        {a.name}
                      </a>
                    }
                    sub={`${a.title ? `${a.title} · ` : ''}${n} open task${n === 1 ? '' : 's'}`}
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
