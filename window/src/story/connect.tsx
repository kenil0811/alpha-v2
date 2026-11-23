// Set up Alpha's Connect: tiles that connect in place, without leaving the story (the redesign's
// calls 8 to 14), one compact row each. Each says what it reads before anything is connected,
// connects as Settings › Connections does (its own form, a provider's sign-in app set up on the
// tile, Alpha Bridge paired from it), and then shows what is landing, counted by the core.
import type {
  ComputersView,
  ConnectorsView,
  ConnectScreen,
  ConnectTile,
  SiteView,
  TileConnection,
} from '@alpha/core/api'
import { CalendarDays, Check, ExternalLink, FileUp, Laptop, LayoutGrid, X } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.ts'
import { Install, lendsWords, mine, Pairing } from '../Computers.tsx'
import { ConnectForm, ICONS } from '../Connections.tsx'
import { askFor, giveBuilder } from '../NewModule.tsx'
import { AppSetup, signInWith } from '../SignInApps.tsx'
import { useSiteSignIn } from '../Sites.tsx'
import { dayWords } from '../time.ts'
import { Refusal, useAct } from '../ui/act.tsx'
import { Button, IconButton } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { cutTip } from '../ui/cut-tip.ts'
import { carriesFiles, dropped } from '../ui/drop-zone.tsx'
import { FRAME } from '../ui/frame.tsx'
import { Info } from '../ui/info.tsx'
import { Tile } from '../ui/list.tsx'
import { Pill } from '../ui/pill.tsx'
import type { Next } from './chapters.tsx'

export function Connect({
  screen,
  reload,
  next,
}: {
  screen: ConnectScreen
  reload: () => void
  next: (n: Next) => void
}) {
  const [view, setView] = useState<ConnectorsView | null>(null)
  const loadView = useCallback(() => {
    api.get<ConnectorsView>('/api/connectors').then(setView, () => undefined)
  }, [])
  const again = useCallback(() => {
    loadView()
    reload()
  }, [loadView, reload])
  useEffect(loadView, [])
  // what lands is counted again while the chapter is open
  useEffect(() => {
    const t = setInterval(reload, 5000)
    return () => clearInterval(t)
  }, [reload])
  useEffect(() => next({ label: 'Continue', ready: true }), [next])
  return (
    <div className="flex flex-col gap-2">
      {screen.tiles.map((t) => (
        <TileBox key={t.key} tile={t} view={view} again={again} />
      ))}
    </div>
  )
}

const KIND_ICONS: Record<string, ReactNode> = {
  calendar: <CalendarDays className="size-4" />,
  computer: <Laptop className="size-4" />,
  apps: <LayoutGrid className="size-4" />,
  file: <FileUp className="size-4" />,
}

function TileBox({
  tile: t,
  view,
  again,
}: {
  tile: ConnectTile
  view: ConnectorsView | null
  again: () => void
}) {
  const icon =
    KIND_ICONS[t.kind] ??
    // a tile waiting on the owner has no connector to press, but keeps its own icon
    ICONS[view?.connectors.find((c) => c.name === (t.connectors[0] ?? t.key))?.icon ?? 'plug']
  const frame = { tile: t, icon }
  if (t.kind === 'computer' && t.server) return <BridgeTile {...frame} />
  if (t.kind === 'apps') return <AppsTile {...frame} view={view} again={again} />
  if (t.kind === 'file') return <FileTile {...frame} />
  return <ConnectorTile {...frame} view={view} again={again} />
}

// One row's height when nothing is open: its icon, name and one line of what it reads (more in
// its ⓘ), its act at the right; what landed and any form under it.
function Frame({
  tile: t,
  icon,
  head,
  children,
}: {
  tile: ConnectTile
  icon: ReactNode
  head?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className={cn(FRAME, 'flex min-w-0 flex-col gap-2.5 p-4')}>
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
        <Tile>{icon}</Tile>
        {/* on a phone its act goes under its name on every tile, never beside it */}
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1 font-medium text-ink text-md">
            <span className="truncate">{t.title}</span>
            {t.note && <Info help={t.note} />}
          </h2>
          <p className="truncate text-ink-3 text-sm" {...cutTip(t.reads)}>
            {t.reads}
          </p>
        </div>
        {head && (
          <div className="flex w-full items-center gap-1.5 pl-12 sm:w-auto sm:shrink-0 sm:pl-0">
            {head}
          </div>
        )}
      </div>
      {children}
    </section>
  )
}

function Landed({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((l) => (
        <Pill key={l} tone="good">
          {l}
        </Pill>
      ))}
    </span>
  )
}

// A connector's tile (mail, calendar and contacts, a system): Connect at the right, or its
// provider's sign-in app set up first, on the tile; its form opens under it.
function ConnectorTile({
  tile: t,
  icon,
  view,
  again,
}: {
  tile: ConnectTile
  icon: ReactNode
  view: ConnectorsView | null
  again: () => void
}) {
  const [open, setOpen] = useState<{ name: string; app: boolean } | null>(null)
  const shut = () => setOpen(null)
  const waiting = t.connectors.filter((n) => !t.connections.some((k) => k.connector === n))
  const on = t.connections.some((k) => k.state === 'connected')
  const c = open ? view?.connectors.find((x) => x.name === open.name) : undefined
  const app = c ? view?.signInApps.find((a) => a.provider === c.signsInWith?.provider) : undefined
  const acts =
    view && !open
      ? waiting.map((name) => {
          const w = view.connectors.find((x) => x.name === name)
          if (!w) return null
          const needs = view.signInApps.find((a) => a.provider === w.signsInWith?.provider)
          // a provider's sign-in app, set up once on the tile by the owner or their IT (call 10)
          if (needs && !needs.set)
            return (
              <Button key={name} size="sm" onClick={() => setOpen({ name, app: true })}>
                Set up {needs.title} sign-in
              </Button>
            )
          return (
            <Button key={name} size="sm" onClick={() => setOpen({ name, app: false })}>
              {w.auth === 'path'
                ? 'Add a folder'
                : waiting.length > 1
                  ? `Connect ${w.title}`
                  : 'Connect'}
            </Button>
          )
        })
      : []
  return (
    <Frame
      tile={t}
      icon={icon}
      head={
        acts.length ? (
          acts
        ) : on ? (
          <Pill tone="good">Connected</Pill>
        ) : t.waits && !t.landed.length ? (
          <Pill tone="faint">{t.waits}</Pill>
        ) : null
      }
    >
      {t.connections.map((k) => (
        <ConnectionRow key={k.id} k={k} />
      ))}
      <Landed items={t.landed} />
      {open && c && (
        <div className="flex flex-col gap-4 border-hair border-t pt-3">
          {t.steps.length > 0 && !open.app && <Steps steps={t.steps} />}
          {open.app && app ? (
            <AppSetup
              app={app}
              onSaved={() => {
                again()
                setOpen({ name: open.name, app: false })
              }}
              onCancel={shut}
            />
          ) : (
            <ConnectForm
              connector={c}
              appSet={app ? !!app.set : null}
              onDone={() => {
                shut()
                again()
              }}
              onCancel={shut}
            />
          )}
        </div>
      )}
    </Frame>
  )
}

// A connection on its tile: its account, whose it is, what it holds; Sign in again when it asks.
function ConnectionRow({ k }: { k: TileConnection }) {
  const { busy, problem, act } = useAct()
  return (
    <div className="flex flex-wrap items-center gap-2 text-md">
      <span className="min-w-0 truncate text-ink">{k.account}</span>
      {k.by !== 'You' && <span className="text-ink-3 text-sm">by {k.by}, for everyone</span>}
      <span className="flex-1" />
      {k.state === 'connected' ? (
        k.landed.map((l) => (
          <Pill key={l} tone="good">
            {l}
          </Pill>
        ))
      ) : k.state === 'needs_sign_in' ? (
        <Button size="sm" disabled={busy} onClick={() => void act(() => signInWith(k.id))}>
          Sign in again
        </Button>
      ) : (
        <Pill tone="warn">Not reading</Pill>
      )}
      <Refusal words={problem} />
    </div>
  )
}

function Steps({ steps }: { steps: ConnectTile['steps'] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map((s, i) => (
        <li key={s.words} className="flex gap-3 text-md">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent text-xs">
            {i + 1}
          </span>
          <span className="flex flex-wrap items-center gap-2 text-ink-2">
            {s.words}
            {s.url && (
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-accent underline underline-offset-3"
              >
                Open <ExternalLink className="size-3" />
              </a>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

// A computer of the person's own, through Alpha Bridge: download it for this computer, pair it
// with a one-time link, and the tile ticks once the computer connects.
function BridgeTile({ tile: t, icon }: { tile: ConnectTile; icon: ReactNode }) {
  const [view, setView] = useState<ComputersView | null>(null)
  const [made, setMade] = useState<{ link: string; open: string } | null>(null)
  const load = useCallback(() => {
    api.get<ComputersView>('/api/computers').then(setView, () => undefined)
  }, [])
  const { busy, problem, act } = useAct(load)
  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [load])
  const theirs = (view?.computers ?? []).filter((c) => !c.here)
  const downloads = [...(view?.downloads ?? [])].sort((a, b) => Number(mine(b)) - Number(mine(a)))
  const windows = /Windows/.test(navigator.userAgent)
  return (
    <Frame
      tile={t}
      icon={icon}
      head={
        made ? null : (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                setMade(await api.post<{ link: string; open: string }>('/api/computers/link'))
              })
            }
          >
            {theirs.length ? 'Pair another' : 'Pair this computer'}
          </Button>
        )
      }
    >
      {theirs.map((c) => (
        <div key={c.id} className="flex items-center gap-2 text-md">
          <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
          <span className="truncate text-ink-3 text-sm">{lendsWords(c)}</span>
          <Pill tone={c.online ? 'good' : 'neutral'}>{c.online ? 'Online' : 'Offline'}</Pill>
        </div>
      ))}
      <Refusal words={problem} />
      {made && (
        <>
          {downloads.some((d) => d.kind === 'installer') ? (
            <Install link={made.link} open={made.open} downloads={downloads} />
          ) : (
            <Pairing link={made.link} downloads={downloads} />
          )}
          {windows && (
            <p className="text-ink-3 text-sm">
              Windows may say it protected your computer: press More info, then Run anyway.
            </p>
          )}
        </>
      )}
    </Frame>
  )
}

// The apps the person uses, on their computer (Alpha Bridge's Apps reader) and among their mail's
// senders, as one list, each with what it was seen by: connected where a connector ships, or
// signed in to at its site in Alpha's browser.
function AppsTile({
  tile: t,
  icon,
  view,
  again,
}: {
  tile: ConnectTile
  icon: ReactNode
  view: ConnectorsView | null
  again: () => void
}) {
  const [sites, setSites] = useState<SiteView[]>([])
  const loadSites = useCallback(() => {
    api.get<SiteView[]>('/api/sites').then(setSites, () => undefined)
  }, [])
  useEffect(loadSites, [])
  const { busy, problem, act } = useAct(again)
  const site = useSiteSignIn(loadSites)
  const [connecting, setConnecting] = useState<string | null>(null)
  const signedIn = (s: string) => sites.some((x) => x.site === s || s.endsWith(`.${x.site}`))
  const open = connecting ? view?.connectors.find((c) => c.name === connecting) : undefined
  const app = open
    ? view?.signInApps.find((a) => a.provider === open.signsInWith?.provider)
    : undefined
  const done = () => {
    setConnecting(null)
    again()
  }
  // the computer's Apps reader: turned on in Alpha Bridge, then read once on the person's press
  const reader = t.reader
  const id = reader?.id
  const head =
    reader && !id ? (
      <Pill tone="faint">Turn on Apps in Alpha Bridge</Pill>
    ) : reader && id && !reader.read ? (
      <Button
        size="sm"
        disabled={busy}
        onClick={() => void act(() => api.post(`/api/connections/${id}/sync`))}
      >
        Read now
      </Button>
    ) : t.apps.length ? null : (
      <Pill tone="faint">None found yet</Pill>
    )
  return (
    <Frame tile={t} icon={icon} head={head}>
      {t.apps.length > 0 && (
        <ul className="flex flex-col">
          {t.apps.map((a) => (
            <li
              key={a.name}
              className="group flex items-center gap-2 border-hair border-t py-1.5 text-md first:border-t-0"
            >
              <span className="min-w-0 flex-1 truncate text-ink">{a.name}</span>
              <span className="text-ink-3 text-sm">
                {[
                  a.times ? `used ${a.times} times` : null,
                  a.last ? dayWords(a.last) : null,
                  a.mails ? `${a.mails} mails` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {a.connected || (a.site && signedIn(a.site)) ? (
                <Pill tone="good">
                  <Check className="size-3" /> {a.connected ? 'Connected' : 'Signed in'}
                </Pill>
              ) : a.connector ? (
                <Button size="sm" onClick={() => setConnecting(a.connector)}>
                  Connect
                </Button>
              ) : a.site ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void act(() => site.signIn(`https://${a.site}`))}
                >
                  Sign in
                </Button>
              ) : null}
              {/* left out of the list for good, as a short list's ✕ (ui-rules R8) */}
              <IconButton
                label={`Leave ${a.name} out`}
                disabled={busy}
                className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                onClick={() => void act(() => api.post('/api/story/apps/remove', { name: a.name }))}
              >
                <X className="size-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {open &&
        view &&
        (app && !app.set ? (
          <AppSetup app={app} onSaved={again} onCancel={done} />
        ) : (
          <ConnectForm
            connector={open}
            appSet={app ? !!app.set : null}
            onDone={done}
            onCancel={done}
          />
        ))}
      <Refusal words={problem} />
      {site.shown}
    </Frame>
  )
}

// Something the work runs on, chosen or dropped on the tile: the Module builder starts a module
// from it while the story carries on, and Done says it is under way.
function FileTile({ tile: t, icon }: { tile: ConnectTile; icon: ReactNode }) {
  const [started, setStarted] = useState<string[]>([])
  const { busy, problem, act } = useAct()
  const pick = useRef<HTMLInputElement>(null)
  const bring = (files: File[]) =>
    void act(async () => {
      const kept: { name: string; hash: string }[] = []
      for (const f of files) kept.push(await api.upload(f))
      await giveBuilder(
        askFor(
          'Make a module from what I work from: the file I brought in is what my work runs on.',
          kept,
        ),
      )
      setStarted((s) => [...s, ...kept.map((k) => k.name)])
    })
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a place to drop a file; Choose a file is the keyboard's way
    <div
      className="contents"
      onDragOver={(e) => {
        if (carriesFiles(e)) e.preventDefault()
      }}
      onDrop={(e) => {
        const files = dropped(e)
        if (!files.length) return
        e.preventDefault()
        e.stopPropagation()
        bring(files)
      }}
    >
      <Frame
        tile={t}
        icon={icon}
        head={
          <Button size="sm" disabled={busy} onClick={() => pick.current?.click()}>
            Choose a file
          </Button>
        }
      >
        {started.map((name) => (
          <span key={name} className="text-ink-2 text-md">
            Under way: a module from {name}
          </span>
        ))}
        <Refusal words={problem} />
        <input
          ref={pick}
          type="file"
          hidden
          onChange={(e) => {
            if (e.target.files?.length) bring([...e.target.files])
            e.target.value = ''
          }}
        />
      </Frame>
    </div>
  )
}
