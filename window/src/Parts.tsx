// Every part of the window on one page (#/parts, not in the rail), so a change to a part is seen in
// light and dark before a screen uses it: the shots take this page too.
import { Bot, Mail } from 'lucide-react'
import { useState } from 'react'
import { Preview } from './CardBox.tsx'
import { RUN_STATE } from './runState.ts'
import { Button, IconButton } from './ui/button.tsx'
import { Actions, Card } from './ui/card.tsx'
import { Cut, Cuts } from './ui/cut.tsx'
import { Dot, SIGNAL_WORDS } from './ui/dot.tsx'
import { DropZone } from './ui/drop-zone.tsx'
import { Field, Select } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Choice, Kbd, Label, Pill, Topic } from './ui/pill.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { SideItem, SideList } from './ui/side-list.tsx'
import { SidePanel } from './ui/side-panel.tsx'
import { Switch } from './ui/switch.tsx'
import { UpdateNow } from './ui/update-now.tsx'

// a field's choices, as the parts page shows them (Batch E, 66.9)
const CHOICES = {
  choices: [
    'Clients',
    'Leads',
    'Insurers',
    'Brokers',
    'Lenders',
    'Partners',
    'Vendors',
    'Staff',
    'Won',
    'Lost',
  ],
  tones: { Won: 'good', Lost: 'bad' },
}

export function Parts() {
  const [view, setView] = useState<'table' | 'board'>('table')
  const [on, setOn] = useState(true)
  const [cut, setCut] = useState<'all' | 'failed'>('all')
  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 px-8 py-7">
          <h1 className="text-2xl text-ink">Parts</h1>
          <Section
            title="Buttons"
            about="Plain, primary, soft, ghost, warn; two sizes; an icon button. Each tints under the pointer."
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
              <Pill tone="bad">{RUN_STATE.failed[0]}</Pill>
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
              <Switch checked={on} onChange={setOn} label="A schedule" />
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
                title="A schedule"
                sub="Runs every day at 07:00"
                actions={<Switch checked={on} onChange={setOn} label="A schedule" />}
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
              <Actions>
                <Button variant="primary">Send it</Button>
                <Button>Decline</Button>
                <Button variant="ghost">Change something</Button>
              </Actions>
            </Card>
          </Section>
          {/* the parts Batch D brought (66.27) */}
          <Section
            title="Choices"
            about="Each choice in its own colour by its place; a state keeps its tone."
          >
            <div className="flex flex-wrap items-center gap-2">
              {CHOICES.choices.map((c) => (
                <Choice key={c} of={CHOICES} value={c} />
              ))}
            </div>
          </Section>
          <Section title="Signals" about="One dot for what a place holds; its words on hover.">
            <div className="flex flex-wrap items-center gap-4 text-md text-ink-2">
              {(['now', 'yes', 'read', 'running'] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-2">
                  <Dot s={s} />
                  {SIGNAL_WORDS[s]}
                </span>
              ))}
            </div>
          </Section>
          <Section title="Cuts" about="Cuts of one list, each with its count, one picked.">
            <Cuts label="Show">
              <Cut on={cut === 'all'} count={42} onClick={() => setCut('all')}>
                All
              </Cut>
              <Cut on={cut === 'failed'} count={3} onClick={() => setCut('failed')}>
                {RUN_STATE.failed[0]}
              </Cut>
            </Cuts>
          </Section>
          <Section
            title="A drop zone"
            about="Drop files on it or click to choose; what is there sits inside."
          >
            <DropZone onFiles={() => undefined} />
          </Section>
          <Section
            title="A side list"
            about="A list on the left, the chosen one's page on the right."
          >
            <div className="grid grid-cols-[170px_1fr] gap-7">
              <SideList label="Sections">
                <SideItem on onClick={() => undefined}>
                  Model
                </SideItem>
                <SideItem on={false} onClick={() => undefined}>
                  Modules
                </SideItem>
              </SideList>
              <p className="text-ink-2 text-md">The chosen one's page.</p>
            </div>
          </Section>
          <Section
            title="Read now, Run now"
            about="When it last happened just before the button; the full time on hover."
          >
            <UpdateNow
              label="Read now"
              at={new Date(Date.now() - 12 * 60_000).toISOString()}
              busy={false}
              onClick={() => undefined}
            />
          </Section>
          <Section
            title="Where a link goes"
            about="Rest the pointer on a link: a line at the window's foot names where it goes."
          >
            <div className="flex gap-4 text-md">
              <a className="text-accent underline underline-offset-3" href="#/settings/usage">
                Usage
              </a>
              <a
                className="text-accent underline underline-offset-3"
                href="https://example.com/"
                target="_blank"
                rel="noreferrer"
              >
                An outside page
              </a>
            </div>
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
