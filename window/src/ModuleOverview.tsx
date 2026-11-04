import type { ModuleView } from '@alpha/core/api'
import { Briefcase } from 'lucide-react'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'

// The modules inside this one, a row each: its name, where it comes from, and what goes on in
// it right now (agents on and running, open tasks); what waits on the person stands out.
export function Overview({ m }: { m: ModuleView }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-page px-7 py-6">
        <List>
          {m.modules.map((c) => {
            const quiet = !c.agents && !c.running && !c.needs && !c.tasks
            const sub = [
              c.kit ? `From ${c.kit}` : 'Made in a conversation',
              c.agents
                ? `${c.agents} agent${c.agents === 1 ? '' : 's'} on${c.running ? `, ${c.running} running` : ''}`
                : c.running
                  ? `${c.running} running`
                  : '',
              c.tasks ? `${c.tasks} open task${c.tasks === 1 ? '' : 's'}` : '',
              quiet ? 'Quiet right now' : '',
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <Row
                key={c.id}
                className="relative hover:bg-canvas"
                lead={
                  <Tile>
                    <Briefcase className="size-4" />
                  </Tile>
                }
                title={
                  <a href={`#/module/${c.id}`} className="after:absolute after:inset-0">
                    {c.name}
                  </a>
                }
                sub={sub}
                actions={
                  c.needs > 0 && (
                    <Pill tone="warn">
                      {c.needs} need{c.needs === 1 ? 's' : ''} you
                    </Pill>
                  )
                }
              />
            )
          })}
        </List>
      </div>
    </div>
  )
}
