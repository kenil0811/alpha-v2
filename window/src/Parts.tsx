// Every part of the window on one page (#/parts, not in the rail), so a change to a part is seen in
// light and dark before a screen uses it: the shots take this page too.
import type { ModuleSummary, TableSummary } from '@alpha/core/api'
import { Bot, Mail } from 'lucide-react'
import { useState } from 'react'
import { Preview } from './Conversation.tsx'
import { childrenOf, tops } from './tree.ts'
import { Button, IconButton } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { Field, Select } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Kbd, Label, Pill, Topic } from './ui/pill.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { SidePanel } from './ui/side-panel.tsx'
import { Switch } from './ui/switch.tsx'

export function Parts() {
  const [view, setView] = useState<'table' | 'board'>('table')
  const [on, setOn] = useState(true)
  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 px-8 py-7">
          <h1 className="text-2xl text-ink">Parts</h1>
          <Section title="Buttons" about="Plain, primary, ghost, warn; two sizes; an icon button.">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Read now</Button>
              <Button variant="primary">Send it</Button>
              <Button variant="ghost">Decline</Button>
              <Button variant="warn">Disconnect</Button>
              <Button size="sm">Small</Button>
              <Button disabled>Disabled</Button>
              <IconButton label="Mail">
                <Mail className="size-4" />
              </IconButton>
            </div>
          </Section>
          <Section title="Pills, chips and labels" about="States only in green, amber and red.">
            <div className="flex flex-wrap items-center gap-2">
              <Pill>Paused</Pill>
              <Pill tone="good">Done</Pill>
              <Pill tone="warn">Waits on you</Pill>
              <Pill tone="bad">Didn't finish</Pill>
              <Pill tone="accent">You said</Pill>
              <Pill tone="faint">No model</Pill>
              <Topic>Deals</Topic>
              <Label>Leaves your world</Label>
              <Kbd>⌘K</Kbd>
            </div>
          </Section>
          <Section title="Controls">
            <div className="flex flex-wrap items-center gap-3">
              <Segmented
                label="View"
                value={view}
                onChange={setView}
                options={[
                  { value: 'table', label: 'Table' },
                  { value: 'board', label: 'Board' },
                ]}
              />
              <Switch checked={on} onChange={setOn} label="An agent" />
              <Field placeholder="A field" />
              <Select defaultValue="New">
                <option>New</option>
                <option>Passed</option>
              </Select>
            </div>
          </Section>
          <Section title="A list">
            <List>
              <Row
                lead={
                  <Tile>
                    <Mail className="size-4" />
                  </Tile>
                }
                title="Gmail"
                sub="you@example.com · last read 20 Oct at 09:12"
                actions={
                  <>
                    <Pill tone="good">Connected</Pill>
                    <Button size="sm">Read now</Button>
                  </>
                }
              />
              <Row
                indent
                lead={<Bot className="size-4 text-ink-3" />}
                title="An agent"
                sub="Runs every day at 07:00"
                actions={<Switch checked={on} onChange={setOn} label="An agent" />}
              />
            </List>
          </Section>
          <Section title="A card">
            <Card label="Leaves your world" waits="Waits for you">
              <div className="font-medium text-ink text-lg">Send the reply to the broker?</div>
              <Preview
                detail={
                  'To: broker@example.com\nSubject: The CIM\n\nThanks, please send the CIM once the NDA is signed.'
                }
              />
              <div className="text-ink-3 text-sm">
                Rests on your message: “ask the broker for the CIM”
              </div>
              <div className="flex gap-2">
                <Button variant="primary">Send it</Button>
                <Button>Decline</Button>
                <Button variant="ghost">Change something</Button>
              </div>
            </Card>
          </Section>
        </div>
      </div>
      <SidePanel title="A side panel" onClose={() => undefined}>
        <div className="flex flex-col gap-3 p-4.5">
          <div className="font-medium font-serif text-2xl text-ink">$810,000</div>
          <Pill tone="neutral" className="self-start">
            Computed
          </Pill>
          <p className="text-ink text-md">
            Asking price × (1 − down payment 10%) − seller note 0%.
          </p>
        </div>
      </SidePanel>
    </div>
  )
}

// Numbering (Vikas, 29 Oct): modules in the rail's order, depth-first (1, 2, 2.1), and a module's
// tables under its number: the main tables, then the setup ones, each followed by the tables that
// are part of its rows (DealPilot 2: Sources 2.1, Deals 2.2, Financials 2.2.1). Every table counted
// gets a number, so a count and its list always agree. The one place numbers are made; the rail,
// the Overview, the Second Brain and Agents and notes read them from here.
type Placed = Pick<ModuleSummary, 'id' | 'name' | 'parent'> & { alpha?: boolean }

export function moduleNumbers(modules: Placed[]): Map<string, string> {
  const out = new Map<string, string>()
  const shown = modules.filter((m) => !m.alpha) // Alpha's own module is not on the rail
  const walk = (list: Placed[], prefix: string) =>
    list.forEach((m, i) => {
      const n = `${prefix}${i + 1}`
      if (out.has(m.id)) return
      out.set(m.id, n)
      walk(childrenOf(shown, m.id), `${n}.`)
    })
  walk(tops(shown), '')
  return out
}

export type NumberedTable<T> = { table: T; n: string; depth: number }

export function numberTables<T extends Pick<TableSummary, 'id' | 'name' | 'place' | 'of'>>(
  tables: T[],
  prefix = '',
): NumberedTable<T>[] {
  const out: NumberedTable<T>[] = []
  const seen = new Set<string>()
  const partsOf = (t: T) => tables.filter((p) => p.of === t.name && p.id !== t.id)
  const walk = (list: T[], pre: string, depth: number, i = 0) => {
    for (const t of list) {
      if (seen.has(t.id)) continue
      seen.add(t.id)
      const n = `${pre}${++i}`
      out.push({ table: t, n, depth })
      walk(partsOf(t), `${n}.`, depth + 1)
    }
    return i
  }
  // the top: tables that are part of no table here, main ones first; a part whose chain loops
  // back on itself still gets a number, after them
  const top = tables.filter((t) => !t.of || !tables.some((o) => o.name === t.of))
  const rank = (t: T) => (t.place === 'main' ? 0 : t.place === 'part' ? 1 : 2)
  const pre = prefix ? `${prefix}.` : ''
  const last = walk(
    [...top].sort((a, b) => rank(a) - rank(b)),
    pre,
    0,
  )
  walk(
    tables.filter((t) => !seen.has(t.id)),
    pre,
    0,
    last,
  )
  return out
}
