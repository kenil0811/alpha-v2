// Settings › Connections › Your computers: each computer of the person's own that lends Alpha
// a folder through the Bridge, connected now or when it was last seen, with what it lends. Add
// this computer shows the Bridge's download for it and a one-time pairing link; the folder is lent
// on the computer itself, never named here.
import type { BridgeDownload, ComputersView, ComputerView } from '@alpha/core/api'
import { ChevronRight, Copy, Download, Laptop } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Frame } from './ui/frame.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill, type Tone } from './ui/pill.tsx'
import { Section } from './ui/section.tsx'
import { updatedWords } from './ui/update-now.tsx'

// The download for the computer this window is on, first.
export const mine = (d: BridgeDownload) =>
  /Windows/.test(navigator.userAgent)
    ? d.platform.startsWith('win')
    : d.platform.startsWith('darwin')

export function Computers({ version }: { version: number }) {
  const [view, setView] = useState<ComputersView | null>(null)
  const [made, setMade] = useState<{ link: string; open: string; until: string } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const load = () =>
    void api.get<ComputersView>('/api/computers').then(setView, (e) => setFailed(wordsOf(e)))
  const { busy, problem, act } = useAct(load)
  // read again whenever the world changes (a computer coming or going)
  useEffect(load, [version])
  if (!view) return <Refusal words={failed} />
  const downloads = [...view.downloads].sort((a, b) => Number(mine(b)) - Number(mine(a)))
  const add = () =>
    act(async () => {
      setMade(await api.post<{ link: string; open: string; until: string }>('/api/computers/link'))
    })
  return (
    <Section
      title="Your computers"
      about="A computer of your own lends Alpha a folder through Alpha Bridge, a small app you install there. Alpha reads it only while the computer is on and the app is not paused."
      action={
        <Button size="sm" disabled={busy} onClick={add}>
          Add this computer
        </Button>
      }
    >
      {view.computers.length > 0 && (
        <List>
          {view.computers.map((c) => (
            <ComputerLine key={c.id} computer={c} />
          ))}
        </List>
      )}
      {made &&
        (downloads.some((d) => d.kind === 'installer') ? (
          <Install link={made.link} open={made.open} downloads={downloads} />
        ) : (
          <Pairing link={made.link} downloads={downloads} />
        ))}
      <Refusal words={problem} />
    </Section>
  )
}

// The link, shown once, to copy into Alpha Bridge's own window.
function LinkLine({ link }: { link: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate text-ink text-sm">{link}</code>
      <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard?.writeText(link)}>
        <Copy className="size-3.5" />
        Copy
      </Button>
    </div>
  )
}

// On the computer being added: install the app, open the link in it, lend a folder.
export function Install({
  link,
  open,
  downloads,
}: {
  link: string
  open: string
  downloads: BridgeDownload[]
}) {
  return (
    <Frame className="flex flex-col gap-2.5 text-ink-2 text-md">
      <p>On the computer you are adding:</p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5">
        <li>
          <span className="inline-flex flex-wrap items-center gap-2">
            Install Alpha Bridge:
            {downloads.map((d) => (
              <a
                key={d.platform}
                href={d.url}
                className="inline-flex items-center gap-1 text-accent underline underline-offset-3"
              >
                <Download className="size-3.5" />
                {d.title}
              </a>
            ))}
          </span>
        </li>
        <li>
          <span className="inline-flex flex-wrap items-center gap-2">
            Then pair it:
            <a href={open}>
              <Button size="sm">Open in Alpha Bridge</Button>
            </a>
          </span>
          <p className="mt-1">
            Or copy this link and choose Pair with the link I copied in Alpha Bridge's menu. It
            works once, for 15 minutes, and you will not see it again.
          </p>
          <LinkLine link={link} />
        </li>
        <li>Lend a folder from Alpha Bridge's menu, or with Lend a folder on its row here.</li>
      </ol>
    </Frame>
  )
}

// Step 1's way, while this Alpha has only the zip: what to do on the computer, in a terminal.
export function Pairing({ link, downloads }: { link: string; downloads: BridgeDownload[] }) {
  return (
    <Frame className="flex flex-col gap-2.5 text-ink-2 text-md">
      <p>On the computer you are adding:</p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5">
        <li>
          {downloads.length ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              Download Alpha Bridge and unzip it:
              {downloads.map((d) => (
                <a
                  key={d.platform}
                  href={d.url}
                  className="inline-flex items-center gap-1 text-accent underline underline-offset-3"
                >
                  <Download className="size-3.5" />
                  {d.title}
                </a>
              ))}
            </span>
          ) : (
            'Alpha Bridge’s download is not on this Alpha yet.'
          )}
        </li>
        <li>
          In Terminal (Mac) or PowerShell (Windows), in the unzipped folder, run{' '}
          <code className="text-ink text-sm">./alpha-bridge pair</code> with this link. It works
          once, for 15 minutes, and you will not see it again.
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate text-ink text-sm">{link}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void navigator.clipboard?.writeText(link)}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
        </li>
        <li>
          Lend a folder with <code className="text-ink text-sm">./alpha-bridge lend</code> and its
          path, then leave <code className="text-ink text-sm">./alpha-bridge run</code> going.
        </li>
      </ol>
    </Frame>
  )
}

// How a computer stands, in a word and its tone: the pill on its row and its page.
export function computerState(c: ComputerView): [string, Tone] {
  if (c.here) return ['This computer', 'neutral']
  if (!c.online) return ['Offline', 'neutral']
  return c.paused ? ['Paused', 'warn'] : ['Online', 'good']
}

// What a computer lends, in a few words: "2 folders, Calendar and Contacts".
export function lendsWords(c: ComputerView): string {
  const lent = c.lends.filter((l) => l.state !== 'paused')
  const folders = lent.filter((l) => l.connector === 'folder').length
  const parts = [
    ...(folders ? [`${folders} folder${folders === 1 ? '' : 's'}`] : []),
    ...lent.filter((l) => l.connector !== 'folder').map((l) => l.title),
    ...(c.sites.length ? [`${c.sites.length} site${c.sites.length === 1 ? '' : 's'}`] : []),
  ]
  if (!parts.length) return c.here ? 'No folders added yet' : 'Lends nothing yet'
  const last = parts.pop()
  return parts.length ? `${parts.join(', ')} and ${last}` : (last ?? '')
}

// A computer as one short row: its name, what it lends, how it stands; a click opens its page.
function ComputerLine({ computer: c }: { computer: ComputerView }) {
  const [state, tone] = computerState(c)
  const seen = !c.online && c.lastSeenAt ? ` · Last seen ${updatedWords(c.lastSeenAt)}` : ''
  return (
    <Row
      className="relative hover:bg-canvas"
      lead={
        <Tile>
          <Laptop className="size-4" />
        </Tile>
      }
      title={
        <a href={`#/computer/${c.id}`} className="after:absolute after:inset-0">
          {c.name}
        </a>
      }
      sub={`${lendsWords(c)}${seen}`}
      actions={
        <>
          {!c.here && <Pill tone={tone}>{state}</Pill>}
          <ChevronRight className="size-4 text-ink-3" />
        </>
      }
    />
  )
}
