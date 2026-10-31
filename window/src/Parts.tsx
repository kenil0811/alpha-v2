// Every part of the window on one page (#/parts, not in the rail), so a change to a part is seen in
// light and dark before a screen uses it: the shots take this page too.
import { Bot, Home, Mail } from 'lucide-react'
import { useState } from 'react'
import { Preview } from './Conversation.tsx'
import { Back } from './ui/back.tsx'
import { Button, IconButton } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { Cut } from './ui/cut.tsx'
import { Dot } from './ui/dot.tsx'
import { Field, Select } from './ui/field.tsx'
import { IconTile, IconTiles } from './ui/icon-tile.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Kbd, Label, Pill, Topic } from './ui/pill.tsx'
import { PillSwitch, SwitchPill } from './ui/pill-switch.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { SidePanel } from './ui/side-panel.tsx'
import { Switch } from './ui/switch.tsx'

export function Parts() {
  const [view, setView] = useState<'table' | 'board'>('table')
  const [on, setOn] = useState(true)
  const [cut, setCut] = useState('today')
  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 px-8 py-7">
          <h1 className="text-2xl text-ink">Parts</h1>
          <Section
            title="Buttons"
            about="Plain, primary, soft, ghost, warn; two sizes; an icon button. Each changes colour under the pointer."
          >
            <div className="flex flex-wrap items-center gap-2">
              <Button>Read now</Button>
              <Button variant="primary">Send it</Button>
              <Button variant="soft">Open page</Button>
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
              <Dot s="now" />
              <Dot s="yes" />
              <Dot s="opt" />
              <Dot s="done" />
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
          <Section title="Switches">
            <div className="flex flex-col items-start gap-4">
              <Back to="Home" onClick={() => undefined} />
              <PillSwitch label="A module">
                <SwitchPill tab={{ key: 'o', href: '#/parts', label: 'Overview', sel: false }} />
                <SwitchPill
                  tab={{ key: 'd', href: '#/parts', label: 'Deals', sel: true, count: 42 }}
                />
                <SwitchPill tab={{ key: 's', href: '#/parts', label: 'Sources', sel: false }} />
              </PillSwitch>
              <div className="flex gap-1.5">
                {(
                  [
                    ['today', 'Today', 4],
                    ['week', 'This week', 11],
                    ['all', 'All', 30],
                  ] as const
                ).map(([k, l, n]) => (
                  <Cut key={k} sel={cut === k} count={n} onClick={() => setCut(k)}>
                    {l}
                  </Cut>
                ))}
              </div>
              <div className="w-48">
                <IconTiles>
                  <IconTile label="Home" onClick={() => undefined}>
                    <Home />
                  </IconTile>
                  <IconTile label="Mail" onClick={() => undefined} current>
                    <Mail />
                  </IconTile>
                </IconTiles>
              </div>
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
