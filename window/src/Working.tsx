// Who works on a module, by what rules, on which tables: one card with a pill switch in its head
// (Agents · Governance · Tables), not three blocks down the column (Vikas, 3 Nov). The first part
// shows first; the person's pick holds while the window is open and is never kept. Every part
// stays drawn, the others hidden, so a switch asks the core nothing.
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Card } from './ui/card.tsx'
import { PillSwitch } from './ui/pill-switch.tsx'

export type Part = { key: string; label: string; sub: string; node: ReactNode }

let picked = '' // the last pick, for as long as the window is open

export function Working({ label, parts }: { label: string; parts: Part[] }) {
  const [tab, setTab] = useState(picked)
  const shown = parts.find((p) => p.key === tab) ?? parts[0]
  return (
    <Card
      label={label}
      head={
        <PillSwitch
          label={label}
          tabs={parts.map((p) => ({ key: p.key, label: p.label, sel: p === shown }))}
          onPick={(key) => {
            picked = key
            setTab(key)
          }}
        />
      }
    >
      {parts.map((p) => (
        <div key={p.key} hidden={p !== shown} className="flex flex-col gap-2.5">
          <p className="text-ink-3 text-sm">{p.sub}</p>
          {p.node}
        </div>
      ))}
    </Card>
  )
}
