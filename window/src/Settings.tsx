// Settings (design §14): connections, folders, and modules with their schedules. Connecting is the
// person's own act here: what they type goes to the Keychain, never to the model.
import type {
  CardView,
  ConnectionView,
  ConnectorsView,
  ConnectorView,
  DataPageView,
  KeptTable,
  Me,
  ModelView,
} from '@alpha/core/api'
import {
  CalendarDays,
  Check,
  Folder,
  Mail,
  Network,
  Plug,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Unplug,
  UserRound,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react'
import { AccountsSection, Foot } from './Accounts.tsx'
import { Activity } from './Activity.tsx'
import { api, Problem, wordsOf } from './api.ts'
import { startAsk } from './ask.ts'
import { HowToWork } from './HowToWork.tsx'
import { ModulesAndSchedules, when } from './ModulesAndSchedules.tsx'
import { Reach } from './Reach.tsx'
import { SetupList, useSetup, useSignIn } from './SetupPanel.tsx'
import { InBar } from './Shell.tsx'
import { SignInApps, signInWith } from './SignInApps.tsx'
import { TableView } from './TableView.tsx'
import { applyTheme, savedTheme, type Theme } from './theme.ts'
import { MODEL_NAMES, UsageSection } from './Usage.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Confirm } from './ui/dialog.tsx'
import { Field } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { More } from './ui/more.tsx'
import { Pill, type Tone } from './ui/pill.tsx'
import { MenuItem } from './ui/popover.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { SideItem, SideList } from './ui/side-list.tsx'
import { Switch } from './ui/switch.tsx'
import { Tabs } from './ui/tabs.tsx'
import { UpdateNow } from './ui/update-now.tsx'
import { WaitingRules } from './WaitingRules.tsx'

const STATE: Record<ConnectionView['state'], [string, Tone]> = {
  connected: ['Connected', 'good'],
  needs_sign_in: ['Needs you to sign in', 'warn'],
  broken: ['Not working', 'bad'],
  paused: ['Paused', 'neutral'],
  waiting: ['Waiting for the customer', 'warn'],
}

// The pictures a connector can ask for (its manifest's icon).
const ICONS: Record<ConnectorView['icon'], ReactNode> = {
  mail: <Mail className="size-4" />,
  calendar: <CalendarDays className="size-4" />,
  people: <UserRound className="size-4" />,
  network: <Network className="size-4" />,
  folder: <Folder className="size-4" />,
  plug: <Plug className="size-4" />,
}

// Two pages share this file (proposal item 14, 15). Intelligence: what Alpha knows and does, as
// tabs. Settings: how Alpha runs, a list of sections on the left and one section at a time.
const PAGES = {
  intelligence: {
    icon: <Sparkles className="size-4" />,
    title: 'Intelligence',
    about: 'The accounts Alpha reads, its schedules and how you asked it to work.',
    tabs: [
      ['connections', 'Connections'],
      ['schedules', 'Schedules'],
      ['work', 'How to work'],
    ],
  },
  settings: {
    icon: <SlidersHorizontal className="size-4" />,
    title: 'Settings',
    about: 'How Alpha runs: its model, what it costs, its data, and what it did.',
    tabs: [
      ['model', 'Model'],
      ['usage', 'Usage'],
      ['data', 'Data'],
      ['appearance', 'Appearance'],
      ['permissions', 'Permissions'],
      ['activity', 'Activity'],
      ['people', 'People'],
      ['modules', 'Modules'],
    ],
  },
} as const

export function Settings({
  page,
  tab,
  open,
  version,
  cards,
}: {
  page: keyof typeof PAGES
  tab: string | null
  open: string | null
  version: number
  cards: CardView[]
}) {
  const [view, setView] = useState<ConnectorsView | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const load = useCallback(() => {
    api.get<ConnectorsView>('/api/connectors').then(setView, (e) => setProblem(wordsOf(e)))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])

  const p = PAGES[page]
  const [me, setMe] = useState<Me | null>(null)
  useEffect(() => {
    api.get<Me>('/api/me').then(setMe, () => undefined)
  }, [])
  // a member does not see the owner's sections; People only where people sign in
  const member = me?.user.role === 'member'
  const hidden = new Set(member ? ['model', 'data', 'people'] : me?.signIn ? [] : ['people'])
  const tabs = (p.tabs as readonly (readonly [string, string])[]).filter(([id]) => !hidden.has(id))
  const at = tabs.find(([id]) => id === tab)?.[0] ?? tabs[0]?.[0] ?? p.tabs[0][0]
  if (!view) return <p className="p-6 text-ink-3">{problem ?? 'Loading…'}</p>
  // a connector that names a place on this Mac (a folder) is a list under Folders; every other
  // is a tile under Connections
  const accounts = view.connectors.filter((c) => c.auth !== 'path')
  const places = view.connectors.filter((c) => c.auth === 'path')
  const folders = view.connections.filter((k) => places.some((c) => c.name === k.connector))
  // a connection whose connector is not loaded (its pack not added yet): shown, waiting
  const orphans = view.connections.filter((k) => !k.loaded)
  const body: Record<string, ReactNode> = {
    work: <HowToWork version={version} />,
    schedules: <Schedules version={version} />,
    connections: (
      <>
        <Section
          title="Connections"
          about="Your accounts, read by Alpha; what you type stays in the Keychain."
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {accounts.map((c) => (
              <ConnectorTile
                key={c.name}
                connector={c}
                connections={view.connections.filter((k) => k.connector === c.name)}
                startOpen={open === c.name}
                added={view.added.includes(c.name)}
                appSet={
                  c.signsInWith
                    ? !!view.signInApps.find((a) => a.provider === c.signsInWith?.provider)?.set
                    : null
                }
                onChange={load}
              />
            ))}
          </div>
          {orphans.length > 0 && (
            <List>
              {orphans.map((k) => (
                <ConnectionLine key={k.id} connection={k} onChange={load} />
              ))}
            </List>
          )}
          {view.failed.map((f) => (
            <div key={f.folder} className="text-bad text-md">
              The connector in {f.folder} did not load: {f.why}
            </div>
          ))}
        </Section>
        <SignInApps apps={view.signInApps} onChange={load} />
        <Section
          title="Folders"
          about="What you put in one is kept and read, as if you dropped it in. Alpha never writes to them."
        >
          {folders.length > 0 && (
            <List>
              {folders.map((k) => (
                <ConnectionLine key={k.id} connection={k} onChange={load} />
              ))}
            </List>
          )}
          {places.map((c) => (
            <FolderForm key={c.name} connector={c} onChange={load} startOpen={open === c.name} />
          ))}
        </Section>
      </>
    ),
    modules: <ModulesAndSchedules version={version} />,
    permissions: <Permissions version={version} owner={!member} />,
    model: <ModelSection />,
    usage: <UsageSection />,
    activity: <Activity version={version} cards={cards} />,
    people: <AccountsSection />,
    data: <DataSection />,
    appearance: <Appearance view={view} onChange={load} />,
  }
  // the bar holds Settings' icon tile, title and line; Intelligence has its tabs under the bar
  const head = (
    <InBar>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          {p.icon}
        </span>
        <h1 className="font-serif text-ink text-xl">{p.title}</h1>
        <p className="hidden truncate text-ink-3 text-sm @min-[900px]:block">{p.about}</p>
      </div>
    </InBar>
  )
  const go = (id: string) => {
    window.location.hash = `#/${page}/${id}`
  }
  if (page === 'intelligence')
    return (
      <div className="flex h-full min-h-0 flex-col">
        <Tabs
          label="Intelligence"
          tabs={PAGES.intelligence.tabs.map(([id, label]) => ({
            key: id,
            href: `#/intelligence/${id}`,
            label,
            sel: id === at,
          }))}
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex max-w-page flex-col gap-8 px-7 pt-6 pb-12">{body[at]}</div>
        </div>
      </div>
    )
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-page flex-col gap-6 px-8 pt-7 pb-12">
        {head}
        <div className="grid grid-cols-[170px_1fr] gap-7 max-md:grid-cols-1">
          <SideList
            label={page === 'settings' ? 'Settings' : 'Intelligence'}
            className="max-md:flex-row max-md:flex-wrap"
          >
            {tabs.map(([id, name]) => (
              <SideItem key={id} on={id === at} onClick={() => go(id)}>
                {name}
              </SideItem>
            ))}
          </SideList>
          <div className="flex min-w-0 flex-col gap-8">{body[at]}</div>
        </div>
        <Foot me={me} />
      </div>
    </div>
  )
}

// Permissions: what Alpha has on this Mac (Claude's sign-in, the readers' downloads, Contacts and
// Calendar, Chrome), then what it does without asking because the person said Always.
function Permissions({ version, owner }: { version: number; owner: boolean }) {
  const [view, reload] = useSetup()
  return (
    <>
      {owner && (
        <Section title="On this computer" about="What Alpha may reach on this computer.">
          {view ? (
            <SetupList view={view} onChange={reload} />
          ) : (
            <p className="text-ink-2 text-md">This core does not say.</p>
          )}
        </Section>
      )}
      <Section
        title="Rules"
        about="What Alpha may and may not do, yours and what it noticed. New starts the conversation; a rule holds once you save it on its card."
      >
        <WaitingRules version={version} />
        <Standing version={version} />
      </Section>
    </>
  )
}

// The person's own data (Kenil's 12.3, 6 Nov): the last ten backups, going back to any, a backup
// now. Taking it, bringing it in and deleting it are the `alpha` command's.
const mb = (n: number) => (n < 1e6 ? `${Math.round(n / 1e3)} KB` : `${(n / 1e6).toFixed(1)} MB`)

function DataSection() {
  const [view, setView] = useState<DataPageView | null>(null)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [restarting, setRestarting] = useState(false)
  const [goingBack, setGoingBack] = useState<string | null>(null) // the backup asked about
  const load = useCallback(() => {
    api.get<DataPageView>('/api/data').then(setView, () => setView(null))
  }, [])
  useEffect(() => {
    load()
  }, [load])
  // after a restore the core goes and comes back: wait for it, then reload
  useEffect(() => {
    if (!restarting) return
    const t = setInterval(() => {
      fetch('/api/health').then(
        (r) => {
          if (r.ok) window.location.reload()
        },
        () => undefined,
      )
    }, 2000)
    return () => clearInterval(t)
  }, [restarting])
  const act = async (fn: () => Promise<{ restarting?: boolean }>, words?: string) => {
    setBusy(true)
    setProblem(null)
    setSaid(null)
    try {
      const out = await fn()
      if (out.restarting) {
        setRestarting(true)
        setSaid(
          'Alpha is restarting; this page comes back when it does. If it does not within a minute, start Alpha again.',
        )
      } else {
        setSaid(words ?? null)
        load()
      }
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not go through.')
    } finally {
      setBusy(false)
    }
  }
  if (!view)
    return (
      <Section title="Data" about="Your backups.">
        <p className="text-ink-2 text-md">{problem ?? 'Loading…'}</p>
      </Section>
    )
  return (
    <Section title="Data" about="Your last ten backups. Go back to any of them, or take one now.">
      <div>
        <Button
          size="sm"
          disabled={busy || restarting}
          onClick={() => act(() => api.post('/api/data/backup'), 'Backed up now.')}
        >
          Back up now
        </Button>
      </div>
      {view.backups.length > 0 && (
        <List>
          {view.backups.slice(0, 10).map((b) => (
            <Row
              key={b.name}
              title={`${when(b.at)} · ${mb(b.size)}`}
              sub={
                b.kind === 'daily'
                  ? 'The day’s backup'
                  : b.kind === 'now'
                    ? 'Taken on asking'
                    : b.kind === 'before'
                      ? 'Taken before going back'
                      : 'Taken before a shape change'
              }
              actions={
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || restarting}
                  onClick={() => setGoingBack(b.name)}
                >
                  Go back to this
                </Button>
              }
            />
          ))}
        </List>
      )}
      <Confirm
        open={!!goingBack}
        title="Go back to this backup?"
        yes="Go back to it"
        busy={busy || restarting}
        onClose={() => setGoingBack(null)}
        onYes={() => {
          const name = goingBack
          setGoingBack(null)
          void act(() => api.post('/api/data/restore', { name }))
        }}
      >
        Alpha backs up now first, then restarts on this one.
      </Confirm>
      {said && <div className="text-ink-2 text-md">{said}</div>}
      {problem && <div className="text-bad text-md">{problem}</div>}
    </Section>
  )
}

// The rules (core step 2): every allow and deny across Alpha, yours and what Alpha noticed, each
// with where it holds and how often it was used; a revoked one stays listed as history. A rule's
// page revokes it, or approves or dismisses what Alpha noticed. Shown under Permissions.
function Standing({ version }: { version: number }) {
  const [data, setData] = useState<KeptTable | null>(null)
  const load = useCallback(() => {
    api.get<KeptTable>('/api/kept/rules').then(setData, () => setData(null))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  if (!data) return null
  return (
    <Embedded
      data={data}
      open={(id) => {
        window.location.hash = `#/rule/${id}`
      }}
      onNew={() => startAsk('From now on, ')}
    />
  )
}

// The route (design §5): the person's own Claude subscription, signed in with Claude's own sign-in
// on this Mac, or the firm's API key, kept in the Keychain. The choice is this install's. Each way
// says its state and acts on its own row.
function ModelSection() {
  const [model, setModel] = useState<ModelView | null>(null)
  const [setup, loadSetup] = useSetup()
  const [waiting, signIn] = useSignIn(loadSetup)
  const { busy, on, problem, act } = useAct()
  useEffect(() => {
    api.get<ModelView>('/api/model').then(setModel, () => setModel(null))
  }, [])
  const choose = (route: ModelView['route'], key?: string) =>
    act(
      async () =>
        setModel(await api.post<ModelView>('/api/model', { route, ...(key ? { key } : {}) })),
      route,
    )
  const kept = model?.hasKey ? 'Key kept in the Keychain' : 'No key yet'
  return (
    <Section
      title="Model"
      about={`Alpha thinks with ${model ? (MODEL_NAMES[model.desk] ?? model.desk) : '…'}.`}
    >
      {model && (
        <List>
          {model.providers.map((p) => {
            const subscription = p.route === 'subscription'
            const state = subscription
              ? setup &&
                (setup.claude.signedIn
                  ? `Signed in${setup.claude.email ? ` as ${setup.claude.email}` : ''}`
                  : 'Not signed in')
              : kept
            return (
              <Row
                key={p.route}
                className={cn(
                  p.chosen && 'bg-accent-soft/40 shadow-[inset_3px_0_0_var(--color-accent)]',
                )}
                lead={
                  <Tile>
                    {p.chosen ? (
                      <Check className="size-4 text-accent" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                  </Tile>
                }
                title={
                  <span className="flex items-center gap-2">
                    {p.title}
                    {p.chosen && <Pill tone="accent">In use</Pill>}
                  </span>
                }
                sub={
                  <>
                    <div className="text-ink-2">{state}</div>
                    <div>{p.can}</div>
                    {p.cannot && <div className="text-warn">{p.cannot}</div>}
                    {on === p.route && <Refusal words={problem} />}
                  </>
                }
                actions={
                  <>
                    {subscription && setup && !setup.claude.signedIn && (
                      <Button size="sm" variant="primary" disabled={waiting} onClick={signIn}>
                        {waiting ? 'Waiting for the browser…' : 'Sign in'}
                      </Button>
                    )}
                    {!p.chosen && (subscription || model.hasKey) && (
                      <Button size="sm" disabled={busy} onClick={() => choose(p.route)}>
                        Use this
                      </Button>
                    )}
                  </>
                }
              >
                {p.needsKey && (
                  <KeyForm
                    busy={busy}
                    title={p.chosen ? undefined : 'Saves the key and uses this way'}
                    onSave={(key) => choose(p.route, key)}
                  />
                )}
              </Row>
            )
          })}
        </List>
      )}
    </Section>
  )
}

// A key route's own key: typed on its row, saved to the Keychain on Save.
function KeyForm({
  busy,
  title,
  onSave,
}: {
  busy: boolean
  title: string | undefined
  onSave: (key: string) => Promise<boolean>
}) {
  const [key, setKey] = useState('')
  return (
    <form
      className="flex items-center gap-2 px-4 pb-3 pl-15"
      onSubmit={(e) => {
        e.preventDefault()
        void onSave(key.trim()).then((ok) => ok && setKey(''))
      }}
    >
      <Field
        className="w-72"
        type="password"
        autoComplete="off"
        aria-label="API key"
        placeholder="sk-ant-…"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      <Button size="sm" type="submit" disabled={busy || !key.trim()} data-tip={title}>
        Save
      </Button>
    </form>
  )
}

function Appearance({ view, onChange }: { view: ConnectorsView; onChange: () => void }) {
  const [theme, setTheme] = useState<Theme>(savedTheme)
  const tables = view.connections.flatMap((k) => k.tables)
  const shown = tables.some((t) => !t.hidden)
  const { busy, problem, act } = useAct(onChange)
  const showTables = (on: boolean) =>
    act(async () => {
      for (const t of tables) await api.post(`/api/tables/${t.id}/sidebar`, { shown: on })
    })
  return (
    <Section title="Appearance">
      <Refusal words={problem} />
      <List>
        <Row
          title="Look"
          sub="Match system follows this computer's light or dark setting."
          actions={
            <Segmented
              label="Look"
              value={theme}
              onChange={(t) => {
                setTheme(t)
                applyTheme(t)
                void act(() => api.post('/api/appearance', { theme: t }))
              }}
              options={[
                { value: 'mac', label: 'Match system' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          }
        />
        {tables.length > 0 && (
          <Row
            title="Connection tables in the sidebar"
            sub="Mail, events and contacts that connections keep, shown with your own tables."
            actions={
              <Switch
                checked={shown}
                disabled={busy}
                label="Connection tables in the sidebar"
                onChange={showTables}
              />
            }
          />
        )}
      </List>
    </Section>
  )
}

// A connection: a row in the folders' list, or a block in its connector's tile.
function ConnectionLine({
  connection: k,
  onChange,
  inTile,
}: {
  connection: ConnectionView
  onChange: () => void
  inTile?: boolean
}) {
  const { busy, problem, act } = useAct(onChange)
  const [leaving, setLeaving] = useState(false)
  const [state, tone] = STATE[k.state]
  const about = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>Set up by {k.owner}</span>
      {k.tables.map((t) => (
        <span key={t.id}>
          Kept in{' '}
          <a className="text-accent underline underline-offset-3" href={`#/table/${t.id}`}>
            {t.name}
          </a>
          {' · '}
          <button
            type="button"
            className="underline underline-offset-3"
            disabled={busy}
            onClick={() => act(() => api.post(`/api/tables/${t.id}/sidebar`, { shown: t.hidden }))}
          >
            {t.hidden ? 'Show in the sidebar' : 'Take out of the sidebar'}
          </button>
        </span>
      ))}
      {k.health && <Pill tone="warn">{k.health}</Pill>}
      <Reach connection={k} busy={busy} act={act} />
    </span>
  )
  const buttons = (
    <>
      {k.settings ? (
        // the one switch macOS keeps outside Alpha: System Settings opened at its pane
        <>
          <Button
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => act(() => api.post('/api/setup/settings', { pane: k.settings }))}
          >
            Open System Settings
          </Button>
          <UpdateNow
            label="Read now"
            at={k.lastSyncAt}
            busy={busy}
            onClick={() => act(() => api.post(`/api/connections/${k.id}/sync`))}
          />
        </>
      ) : k.state === 'needs_sign_in' ? (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            // a site read as the person opens in Chrome; a provider's sign-in opens its own page
            // in the browser; a password goes in Alpha's own form
            if (k.inBrowser) void act(() => api.post(`/api/connections/${k.id}/sign-in`))
            else if (k.signsInWith) void act(() => signInWith(k.id))
            else window.location.hash = `#/intelligence/connections?connect=${k.connector}`
          }}
        >
          {k.inBrowser
            ? 'Sign in with Chrome'
            : k.signsInWith
              ? `Sign in with ${k.signsInWith}`
              : 'Sign in'}
        </Button>
      ) : k.state === 'waiting' ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => act(() => api.post(`/api/connections/${k.id}/sync`))}
        >
          Try again
        </Button>
      ) : (
        <UpdateNow
          label="Read now"
          at={k.lastSyncAt}
          busy={busy}
          onClick={() => act(() => api.post(`/api/connections/${k.id}/sync`))}
        />
      )}
      <More label="More" disabled={busy}>
        {(close) => (
          <MenuItem
            danger
            onClick={() => {
              close()
              setLeaving(true)
            }}
          >
            <Unplug className="size-3.5" />
            Disconnect
          </MenuItem>
        )}
      </More>
      <Refusal words={problem} />
    </>
  )
  // Disconnect asks first, naming what goes (item 28, 25 Oct)
  const confirm = (
    <Confirm
      open={leaving}
      title={`Disconnect ${k.title}?`}
      yes="Disconnect"
      busy={busy}
      onClose={() => setLeaving(false)}
      onYes={() => {
        setLeaving(false)
        void act(() => api.delete(`/api/connections/${k.id}`))
      }}
    >
      Alpha stops reading {k.account}. What it read stays, and connecting again starts from scratch.
    </Confirm>
  )
  if (inTile)
    return (
      <div className="group/row flex flex-col gap-2 border-hair border-t pt-3">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{k.account}</span>
          <Pill tone={tone}>{state}</Pill>
        </div>
        <div className="text-ink-3 text-sm">{about}</div>
        <div className="flex flex-wrap gap-2">{buttons}</div>
        {confirm}
      </div>
    )
  return (
    <Row
      lead={
        <Tile>
          <Folder className="size-4" />
        </Tile>
      }
      title={k.account}
      sub={about}
      actions={
        <>
          <Pill tone={tone}>{state}</Pill>
          {buttons}
        </>
      }
    >
      {confirm}
    </Row>
  )
}

// A connector as a tile: its accounts, each with its state and buttons, or Connect.
function ConnectorTile({
  connector: c,
  connections,
  startOpen,
  added,
  appSet,
  onChange,
}: {
  connector: ConnectorView
  connections: ConnectionView[]
  startOpen: boolean
  added: boolean // loaded from Alpha's own connectors/: it can be removed again
  appSet: boolean | null // signed in as the person: whether the organisation's sign-in app is set
  onChange: () => void
}) {
  const system = c.auth === 'system'
  const inBrowser = c.auth === 'browser'
  const asPerson = c.signsInWith ?? null
  const [open, setOpen] = useState(startOpen)
  const [account, setAccount] = useState(
    system
      ? (c.account.placeholder ?? c.account.label)
      : inBrowser
        ? (c.account.placeholder ?? c.name)
        : '',
  )
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  useEffect(() => setOpen(startOpen), [startOpen])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem(null)
    try {
      const made = await api.post<{ id: string; state: string }>('/api/connections', {
        connector: c.name,
        account,
        ...(c.secret ? { secret } : {}),
      })
      // a site read as the person: they sign in themselves, in its own window of Chrome; signed
      // in as the person: on the provider's own page, in their browser
      if (inBrowser && made.state === 'needs_sign_in')
        await api.post(`/api/connections/${made.id}/sign-in`)
      if (asPerson && made.state === 'needs_sign_in') await signInWith(made.id)
      setSecret('')
      setOpen(false)
      onChange()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not connect.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'group/row flex flex-col gap-3 rounded-lg border border-line bg-surface p-4',
        open && 'col-span-full',
      )}
    >
      <div className="flex items-center gap-3">
        <Tile>{ICONS[c.icon] ?? ICONS.plug}</Tile>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-base text-ink">{c.title}</div>
          {connections.length === 0 && <div className="text-ink-3 text-sm">Not connected</div>}
        </div>
        {!open && (connections.length === 0 || !system) && (
          <Button
            size="sm"
            variant={connections.length ? 'ghost' : 'default'}
            onClick={() => setOpen(true)}
          >
            {connections.length ? 'Add another' : 'Connect'}
          </Button>
        )}
        {!open && added && connections.length === 0 && (
          <More label="More" disabled={busy}>
            {(close) => (
              <MenuItem
                danger
                onClick={() => {
                  close()
                  setRemoving(true)
                }}
              >
                <Trash2 className="size-3.5" />
                Delete
              </MenuItem>
            )}
          </More>
        )}
        <Confirm
          open={removing}
          title={`Delete ${c.title}?`}
          yes="Delete it"
          busy={busy}
          onClose={() => setRemoving(false)}
          onYes={async () => {
            setBusy(true)
            setProblem(null)
            try {
              await api.delete(`/api/connectors/${c.name}`)
              setRemoving(false)
            } catch (err) {
              setProblem(wordsOf(err))
            }
            setBusy(false)
            onChange()
          }}
        >
          The connector you added goes, with its folder. It can’t be brought back.
        </Confirm>
      </div>
      {open && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          {system ? (
            <p className="text-ink-2 text-md">
              Your Mac will ask whether Alpha may read your {c.title.toLowerCase()}. Alpha only
              reads it.
            </p>
          ) : inBrowser ? (
            <p className="text-ink-2 text-md">
              {c.warning ??
                `${c.title} opens in its own window of Google Chrome: sign in there yourself, then quit that Chrome. Alpha reads it as you would and never writes to it.`}
            </p>
          ) : (
            <label className="flex flex-col gap-1 text-md" htmlFor={`${c.name}-account`}>
              <span className="text-ink-2">{c.account.label}</span>
              <Field
                id={`${c.name}-account`}
                value={account}
                placeholder={c.account.placeholder}
                onChange={(e) => setAccount(e.target.value)}
                autoComplete="username"
              />
            </label>
          )}
          {asPerson && (
            <p className="text-ink-3 text-sm">
              {appSet
                ? `${asPerson.title}’s sign-in page opens in your browser. Sign in there as this address; Alpha never sees your password.`
                : `Set up ${asPerson.title}’s sign-in app under Sign-in apps first, with your IT if you are not its admin.`}
            </p>
          )}
          {c.secret && (
            <label className="flex flex-col gap-1 text-md" htmlFor={`${c.name}-secret`}>
              <span className="text-ink-2">{c.secret.label}</span>
              <Field
                id={`${c.name}-secret`}
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="off"
              />
              <span className="text-ink-3 text-sm">
                {c.secret.help}{' '}
                {c.secret.url && (
                  <a
                    className="text-accent underline underline-offset-3"
                    href={c.secret.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Make one
                  </a>
                )}
              </span>
            </label>
          )}
          {problem && (
            <div className="flex flex-wrap items-center gap-2 text-bad text-md">
              <span>{problem}</span>
              {c.system && problem.includes('System Settings') && (
                <Button
                  size="sm"
                  onClick={() => api.post('/api/setup/settings', { pane: c.system?.pane })}
                >
                  Open System Settings
                </Button>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={
                busy || !account.trim() || (!!c.secret && !secret.trim()) || appSet === false
              }
            >
              {busy
                ? 'Connecting…'
                : inBrowser
                  ? 'Sign in with Chrome'
                  : asPerson
                    ? `Sign in with ${asPerson.title}`
                    : 'Connect'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {connections.map((k) => (
        <ConnectionLine key={k.id} connection={k} onChange={onChange} inTile />
      ))}
    </div>
  )
}

function FolderForm({
  connector: c,
  onChange,
  startOpen,
}: {
  connector: ConnectorView
  onChange: () => void
  startOpen: boolean
}) {
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem(null)
    try {
      await api.post('/api/connections', { connector: c.name, account: path.trim() })
      setPath('')
      onChange()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That folder was not added.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Field
          className="flex-1"
          value={path}
          autoFocus={startOpen}
          placeholder={c.account.placeholder}
          onChange={(e) => setPath(e.target.value)}
        />
        <Button type="submit" disabled={busy || !path.trim()}>
          Add {c.title.toLowerCase()}
        </Button>
      </div>
      {problem && <div className="text-bad text-md">{problem}</div>}
    </form>
  )
}

// A shared table inside a page that scrolls: a fixed height, its own frame and nothing around it,
// its edges in line with the section's title.
function Embedded({
  data,
  open,
  onNew,
}: {
  data: KeptTable
  open: (id: string) => void
  onNew?: () => void
}) {
  return (
    <div className="-mx-7 h-[min(520px,70vh)]">
      <TableView data={data} kept={onNew ? { open, onNew } : { open }} />
    </div>
  )
}

// Intelligence's Schedules: every schedule in one shared table, each opening its page; then the modules
// they come from, to install, update and pack.
function Schedules({ version }: { version: number }) {
  // every module's schedules as one table from the core: On or Paused changes in its cell
  const [data, setData] = useState<KeptTable | null>(null)
  useEffect(() => {
    if (version >= 0) api.get<KeptTable>('/api/kept/schedules').then(setData, () => setData(null))
  }, [version])
  return (
    <Section title="Schedules" about="Every schedule, what it does and when it last ran.">
      {data && (
        <Embedded
          data={data}
          open={(id) => {
            window.location.hash = `#/schedule/${id}`
          }}
        />
      )}
    </Section>
  )
}
