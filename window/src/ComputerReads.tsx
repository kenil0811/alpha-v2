// What else Alpha Bridge reads on a computer of the person's own (a Mac's Calendar and Contacts, a
// plugin's readers, its Browser), each turned on from here by its person: the Bridge does it and
// says so there, and keeps its switch to turn it off (docs/rules.md, B2). A folder is never turned
// on here: Lend a folder opens its picker on the computer. The Browser needs Google Chrome there:
// where its Bridge says Chrome is not, the line says so and offers Chrome's own download page.
import type { ComputerView } from '@alpha/core/api'
import { Check, ExternalLink } from 'lucide-react'
import { useState } from 'react'
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
  const [triedBrowser, setTriedBrowser] = useState(false)
  if (!reads.length) return null
  const why = !c.online
    ? `Open Alpha Bridge on ${c.name} to turn these on from here.`
    : !c.turnsOn
      ? `Alpha Bridge on ${c.name} updates itself when it starts again. Until then, turn these on in its menu there.`
      : null
  // Chrome's own page, opened outside Alpha
  const CHROME = 'https://www.google.com/chrome/'
  // a Bridge older than saying whether Chrome is there: a Browser still off after Turn on is said
  // the same way, as the likely why
  const noChrome = (r: ComputerView['reads'][number]) =>
    r.connector === 'browser' &&
    !r.on &&
    (c.chrome === false || (triedBrowser && c.chrome === null))
  const about = (r: ComputerView['reads'][number]) =>
    !noChrome(r)
      ? r.about
      : c.chrome === false
        ? `Google Chrome isn’t on ${c.name}. Get it there, then turn this on.`
        : `The Browser stayed off on ${c.name}. It needs Google Chrome there: get it, then turn this on again.`
  const act1 = (r: ComputerView['reads'][number]) =>
    noChrome(r) ? (
      <span className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => window.open(CHROME, '_blank', 'noopener')}>
          Get Chrome
          <ExternalLink className="size-3" />
        </Button>
        {turnOn(r)}
      </span>
    ) : r.on ? (
      <Pill tone="good">
        <Check className="size-3" /> On
      </Pill>
    ) : (
      turnOn(r)
    )
  function turnOn(r: ComputerView['reads'][number]) {
    return (
      <Button
        size="sm"
        disabled={busy || !!why}
        onClick={() =>
          void act(async () => {
            await api.post(`/api/computers/${c.id}/reader`, { connector: r.connector, on: true })
            // the Bridge turns it on, then tells Alpha: read again once it has
            await new Promise((done) => setTimeout(done, 1500))
            if (r.connector === 'browser') setTriedBrowser(true)
          })
        }
      >
        Turn on
      </Button>
    )
  }
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
              <span className="min-w-0 flex-1 truncate text-ink-3 text-sm" {...cutTip(about(r))}>
                {about(r)}
              </span>
              {act1(r)}
            </li>
          ))}
        </ul>
      ) : (
        <List>
          {reads.map((r) => (
            <Row key={r.connector} title={r.title} sub={about(r)} actions={act1(r)} />
          ))}
        </List>
      )}
      <Refusal words={problem} />
    </>
  )
}
