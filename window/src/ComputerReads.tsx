// What else Alpha Bridge reads on a computer of the person's own (a Mac's Calendar and Contacts, a
// plugin's readers, its Browser), each turned on from here by its person: the Bridge does it and
// says so there, and keeps its switch to turn it off (docs/rules.md, B2). A folder is never turned
// on here: Lend a folder opens its picker on the computer.
import type { ComputerView } from '@alpha/core/api'
import { Check } from 'lucide-react'
import { api } from './api.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cutTip } from './ui/cut-tip.ts'
import { List, Row } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'

export function ComputerReads({
  computer: c,
  reads = c.reads,
  plain = false,
  onChange,
}: {
  computer: ComputerView
  reads?: ComputerView['reads'] // only some of them (the computer's page: those still off)
  plain?: boolean // on a tile: one line each, as the apps found there are, never a box in a box
  onChange: () => void
}) {
  const { busy, problem, act } = useAct(onChange)
  if (!reads.length) return null
  const why = !c.online
    ? `Open Alpha Bridge on ${c.name} to turn these on from here.`
    : !c.turnsOn
      ? `Alpha Bridge on ${c.name} updates itself when it starts again. Until then, turn these on in its menu there.`
      : null
  const act1 = (r: ComputerView['reads'][number]) =>
    r.on ? (
      <Pill tone="good">
        <Check className="size-3" /> On
      </Pill>
    ) : (
      <Button
        size="sm"
        disabled={busy || !!why}
        onClick={() =>
          void act(async () => {
            await api.post(`/api/computers/${c.id}/reader`, { connector: r.connector, on: true })
            // the Bridge turns it on, then tells Alpha: read again once it has
            await new Promise((done) => setTimeout(done, 1500))
          })
        }
      >
        Turn on
      </Button>
    )
  return (
    <>
      {why && <p className="text-ink-3 text-sm">{why}</p>}
      {plain ? (
        <ul className="flex flex-col">
          {reads.map((r) => (
            <li
              key={r.connector}
              className="flex items-center gap-2 border-hair border-t py-1.5 text-md first:border-t-0"
            >
              <span className="shrink-0 text-ink">{r.title}</span>
              <span className="min-w-0 flex-1 truncate text-ink-3 text-sm" {...cutTip(r.about)}>
                {r.about}
              </span>
              {act1(r)}
            </li>
          ))}
        </ul>
      ) : (
        <List>
          {reads.map((r) => (
            <Row key={r.connector} title={r.title} sub={r.about} actions={act1(r)} />
          ))}
        </List>
      )}
      <Refusal words={problem} />
    </>
  )
}
