// Settings (design §14): connections, folders, and modules with their agents. Connecting is the
// person's own act here: what they type goes to the Keychain, never to the model.
import type {
  ConnectionView,
  ConnectorsView,
  ConnectorView,
  DataPageView,
  InstructionView,
  ModelView,
  ModuleSummary,
  PermissionView,
  TableView as TableData,
  WorkingModuleView,
} from '@alpha/core/api'
import {
  BookmarkCheck,
  Bot,
  CalendarDays,
  Folder,
  Mail,
  Network,
  Plug,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { api, Problem, wordsOf } from './api.ts'
import { EXPERIMENTS, setExperiment, useExperiment } from './experiments.ts'
import { PillSwitch } from './Module.tsx'
import { ModulesAndAgents, when } from './ModulesAndAgents.tsx'
import { Reports } from './Reports.tsx'
import { SetupList, useSetup } from './SetupPanel.tsx'
import { InBar } from './Shell.tsx'
import { TableView } from './TableView.tsx'
import { agentsTable, permissionsTable } from './table/kept.ts'
import { applyTheme, savedTheme, type Theme } from './theme.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Confirm, Dialog } from './ui/dialog.tsx'
import { Field } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill, type Tone } from './ui/pill.tsx'
import { Empty, Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { Switch } from './ui/switch.tsx'

const STATE: Record<ConnectionView['state'], [string, Tone]> = {
  connected: ['Connected', 'good'],
  needs_sign_in: ['Needs you to sign in again', 'warn'],
  broken: ['Not working', 'bad'],
  paused: ['Paused', 'neutral'],
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
    about: 'The accounts Alpha reads, its agents and what it knows.',
    tabs: [
      ['connections', 'Connections', <Plug key="i" className="size-3.5" />],
      ['agents', 'Agents', <Bot key="i" className="size-3.5" />],
      ['brain', 'Second Brain', <BookmarkCheck key="i" className="size-3.5" />],
    ],
  },
  settings: {
    icon: <SlidersHorizontal className="size-4" />,
    title: 'Settings',
    about: 'How Alpha runs on this Mac: its model, modules, permissions, data and how it looks.',
    tabs: [
      ['model', 'Model', null],
      ['modules', 'Modules', null],
      ['permissions', 'Permissions', null],
      ['data', 'Data', null],
      ['reports', 'Reports', null],
      ['appearance', 'Appearance', null],
      ['experimental', 'Experimental', null],
    ],
  },
} as const

export function Settings({
  page,
  tab,
  open,
  version,
}: {
  page: keyof typeof PAGES
  tab: string | null
  open: string | null
  version: number
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
  const at = p.tabs.find(([id]) => id === tab)?.[0] ?? p.tabs[0][0]
  if (!view) return <p className="p-6 text-ink-3">{problem ?? 'Loading…'}</p>
  // a connector that names a place on this Mac (a folder) is a list under Folders; every other
  // is a tile under Connections
  const accounts = view.connectors.filter((c) => c.auth !== 'path')
  const places = view.connectors.filter((c) => c.auth === 'path')
  const folders = view.connections.filter((k) => places.some((c) => c.name === k.connector))
  // a connection whose connector is not loaded (its pack not added yet): shown, waiting
  const orphans = view.connections.filter((k) => !k.loaded)
  const body: Record<string, ReactNode> = {
    brain: <SecondBrain version={version} />,
    agents: <Agents version={version} />,
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
          <AddConnector view={view} onChange={load} />
        </Section>
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
    modules: <ModulesAndAgents version={version} />,
    permissions: <Permissions version={version} />,
    model: <ModelSection />,
    data: <DataSection />,
    reports: <Reports />,
    appearance: <Appearance view={view} onChange={load} />,
    experimental: <Experimental />,
  }
  // the bar holds Intelligence's tabs, or Settings' icon tile, title and line
  const head = (
    <InBar>
      {page === 'intelligence' ? (
        <PillSwitch
          label="Intelligence"
          tabs={PAGES.intelligence.tabs.map(([id, label, icon]) => ({
            key: id,
            href: `#/intelligence/${id}`,
            label,
            icon,
            sel: id === at,
          }))}
        />
      ) : (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
            {p.icon}
          </span>
          <h1 className="font-serif text-ink text-xl">{p.title}</h1>
          <p className="hidden truncate text-ink-3 text-sm @min-[900px]:block">{p.about}</p>
        </div>
      )}
    </InBar>
  )
  const go = (id: string) => {
    window.location.hash = `#/${page}/${id}`
  }
  if (page === 'intelligence')
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-page flex-col gap-6 px-8 pt-7 pb-12">
          {head}
          <div className="flex min-w-0 flex-col gap-8">{body[at]}</div>
        </div>
      </div>
    )
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-page flex-col gap-6 px-8 pt-7 pb-12">
        {head}
        <div className="grid grid-cols-[170px_1fr] gap-7 max-md:grid-cols-1">
          <nav className="flex flex-col gap-px self-start max-md:flex-row max-md:flex-wrap">
            {p.tabs.map(([id, name]) => (
              <button
                key={id}
                type="button"
                aria-current={id === at ? 'page' : undefined}
                onClick={() => go(id)}
                className={cn(
                  'flex h-7 items-center gap-2 truncate whitespace-nowrap rounded-md px-2.5 text-left text-ink-2 text-md hover:bg-hover hover:text-ink',
                  id === at &&
                    'bg-accent-soft font-medium text-accent hover:bg-accent-soft hover:text-accent',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    id === at ? 'bg-accent' : 'bg-transparent',
                  )}
                />
                {name}
              </button>
            ))}
          </nav>
          <div className="flex min-w-0 flex-col gap-8">{body[at]}</div>
        </div>
      </div>
    </div>
  )
}

// Second Brain: how to work (the standing instructions), and the Alpha module's two tables, Decisions
// and Noticed, which are shown here instead of as a module on the rail.
function SecondBrain({ version }: { version: number }) {
  const [part, setPart] = useState<'work' | 'Decisions' | 'Noticed'>('work')
  return (
    <>
      <div className="self-start">
        <Segmented
          label="Second Brain"
          value={part}
          onChange={setPart}
          options={[
            { value: 'work', label: 'How to work' },
            { value: 'Decisions', label: 'Decisions' },
            { value: 'Noticed', label: 'Noticed' },
          ]}
        />
      </div>
      {part === 'work' ? (
        <HowToWork version={version} />
      ) : (
        <AlphaTable key={part} name={part} version={version} />
      )}
    </>
  )
}

const ABOUT_ALPHA = {
  Decisions: 'What Alpha decided, and the rules you approved for it.',
  Noticed: 'What Alpha noticed while it worked.',
}

// One of the Alpha module's tables, found by its name, drawn with the shared table.
function AlphaTable({ name, version }: { name: keyof typeof ABOUT_ALPHA; version: number }) {
  const [data, setData] = useState<TableData | null | undefined>(undefined)
  useEffect(() => {
    if (version < 0) return
    api
      .get<ModuleSummary[]>('/api/modules')
      .then((ms) => {
        const id = alphaOf(ms)?.tables.find((t) => t.name === name)?.id
        return id ? api.get<TableData>(`/api/tables/${id}`) : null
      })
      .then(setData, () => setData(null))
  }, [name, version])
  return (
    <Section title={name} about={ABOUT_ALPHA[name]}>
      {data === null && <Empty>Nothing here yet.</Empty>}
      {data && (
        <div className="h-[min(520px,70vh)] overflow-hidden rounded-lg border border-line bg-surface">
          <TableView data={data} />
        </div>
      )}
    </Section>
  )
}

// The Alpha module: the top-level module named Alpha.
export const alphaOf = (modules: ModuleSummary[]) =>
  modules.find((m) => m.name === 'Alpha' && !m.parent)

// How to work: the standing instructions the person gave, each one forgotten on a yes.
function HowToWork({ version }: { version: number }) {
  const [lines, setLines] = useState<InstructionView[] | null>(null)
  const load = useCallback(() => {
    api.get<InstructionView[]>('/api/instructions').then(setLines, () => setLines([]))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const { busy, on, problem, act } = useAct(load)
  const [forgetting, setForgetting] = useState<string | null>(null)
  const keyOf = (l: InstructionView) => `${l.for}${l.words}`
  const asked = lines?.find((l) => keyOf(l) === forgetting)
  const forget = (l: InstructionView) => {
    setForgetting(null)
    void act(() => api.post('/api/instructions/remove', { for: l.for, words: l.words }), keyOf(l))
  }
  return (
    <Section
      title="How to work"
      about="How you asked things to be done from now on. Tell Alpha in a sentence to add one."
    >
      {lines?.length === 0 && (
        <Empty>Nothing configured yet. Say “from now on…” to Alpha to add one.</Empty>
      )}
      {lines && lines.length > 0 && (
        <List>
          {lines.map((l) => (
            <Row
              key={keyOf(l)}
              lead={
                <Tile>
                  <BookmarkCheck className="size-4" />
                </Tile>
              }
              title={<span className="whitespace-normal font-normal">{l.words}</span>}
              sub={l.for === 'me' ? 'For you' : 'For everyone here'}
              actions={
                <>
                  {on === keyOf(l) && <Refusal words={problem} />}
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => setForgetting(keyOf(l))}
                  >
                    Forget
                  </Button>
                </>
              }
            ></Row>
          ))}
        </List>
      )}
      <Confirm
        open={!!asked}
        title="Forget this?"
        yes="Forget it"
        busy={busy}
        onClose={() => setForgetting(null)}
        onYes={() => asked && forget(asked)}
      >
        Alpha stops doing it from now on: “{asked?.words}”
      </Confirm>
    </Section>
  )
}

// Permissions: what Alpha has on this Mac (Claude's sign-in, the readers' downloads, Contacts and
// Calendar, Chrome), then what it does without asking because the person said Always.
function Permissions({ version }: { version: number }) {
  const [view, reload] = useSetup()
  return (
    <Section
      title="Permissions"
      about="What Alpha may reach on this Mac, and what it does without asking because you said Always on a card."
    >
      <h3 className="font-medium text-ink">On this Mac</h3>
      {view ? (
        <SetupList view={view} onChange={reload} />
      ) : (
        <p className="text-ink-2 text-md">This core does not say.</p>
      )}
      <h3 className="pt-2 font-medium text-ink">Always allowed</h3>
      <Standing version={version} />
    </Section>
  )
}

// The person's own data (decision 12): what the world holds, its backups, a backup now, going
// back, taking it as one archive, bringing one in, a copy in a folder, and deleting it all.
const mb = (n: number) => (n < 1e6 ? `${Math.round(n / 1e3)} KB` : `${(n / 1e6).toFixed(1)} MB`)

function DataSection() {
  const [view, setView] = useState<DataPageView | null>(null)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [restarting, setRestarting] = useState(false)
  const [folder, setFolder] = useState('')
  const [archive, setArchive] = useState('')
  const [removing, setRemoving] = useState(false)
  const [typed, setTyped] = useState('')
  const [goingBack, setGoingBack] = useState<string | null>(null) // the backup asked about
  const [bringing, setBringing] = useState(false)
  const [setup] = useSetup()
  const load = useCallback(() => {
    api.get<DataPageView>('/api/data').then(
      (v) => {
        setView(v)
        setFolder(v.copyTo ?? '')
      },
      () => setView(null),
    )
  }, [])
  useEffect(() => {
    load()
  }, [load])
  // after a restore, a bring-in or a removal the core goes and comes back: wait for it, then reload
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
  const act = async (
    fn: () => Promise<{ restarting?: boolean; file?: string; copyTo?: string | null }>,
    words?: string,
  ) => {
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
        setSaid(out.file ? `Your data is in ${out.file}.` : (words ?? null))
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
      <Section title="Data" about="Your world, its backups, and where it goes.">
        <p className="text-ink-2 text-md">{problem ?? 'Loading…'}</p>
      </Section>
    )
  return (
    <Section
      title="Data"
      about="Your world, its backups, and where it goes. Everything here is yours to take or delete."
    >
      {setup && (
        <p className="text-ink-2 text-md">
          Alpha for {setup.install.owner}, on port {setup.install.port}. Its data is in{' '}
          {setup.install.home}; a report goes to{' '}
          {setup.install.reportTo ?? 'whoever gave you Alpha'}.
        </p>
      )}
      <p className="text-ink-2 text-md">
        The world holds {view.world.rows.toLocaleString()} rows and{' '}
        {view.world.lines.toLocaleString()} lines of Activity ({mb(view.world.size)}, shape version{' '}
        {view.world.version}); {view.files.count.toLocaleString()} files ({mb(view.files.size)});
        the modules {mb(view.modules.size)}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy || restarting}
          onClick={() => act(() => api.post('/api/data/backup'), 'Backed up now.')}
        >
          Back up now
        </Button>
        <Button
          size="sm"
          disabled={busy || restarting}
          onClick={() => act(() => api.post('/api/data/export'))}
        >
          Take my data
        </Button>
      </div>
      {view.backups.length > 0 && (
        <List>
          {view.backups.map((b) => (
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
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void act(
            () => api.post('/api/data/copy', { folder: folder.trim() }),
            folder.trim()
              ? `A copy of the newest backup goes to ${folder.trim()} each day.`
              : 'No copy goes anywhere now.',
          )
        }}
      >
        <Field
          className="flex-1"
          value={folder}
          placeholder="Keep a copy of the newest backup in a folder, like /Users/you/Library/Mobile Documents/com~apple~CloudDocs/Alpha"
          onChange={(e) => setFolder(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={busy || restarting}>
          {folder.trim() ? 'Keep a copy there' : 'Keep no copy'}
        </Button>
      </form>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setBringing(true)
        }}
      >
        <Field
          className="flex-1"
          value={archive}
          placeholder="Bring data in from an archive, like /Users/you/Desktop/alpha-data-2026-10-23.tar.gz (a fresh install only)"
          onChange={(e) => setArchive(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={busy || restarting || !archive.trim()}>
          Bring data in
        </Button>
      </form>
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
      <Confirm
        open={bringing}
        title="Bring this data in?"
        yes="Bring it in and restart"
        busy={busy || restarting}
        onClose={() => setBringing(false)}
        onYes={() => {
          setBringing(false)
          void act(() => api.post('/api/data/import', { archive: archive.trim() }))
        }}
      >
        Alpha restarts on the data in {archive.trim()}. This works on a fresh install only.
      </Confirm>
      {said && <div className="text-ink-2 text-md">{said}</div>}
      {problem && <div className="text-bad text-md">{problem}</div>}
      <div>
        <Button
          size="sm"
          variant="danger"
          disabled={busy || restarting}
          onClick={() => setRemoving(true)}
        >
          Delete my data
        </Button>
      </div>
      <Dialog
        open={removing}
        title="Delete all your data?"
        onClose={() => setRemoving(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setRemoving(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy || restarting || !typed.trim()}
              onClick={() => void act(() => api.post('/api/data/remove', { name: typed }))}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p>
            Every world, file, module, backup and sign-in Alpha keeps for you goes to the Trash, and
            Alpha goes back to its first open. Type your name as Alpha knows it to go on.
          </p>
          <Field value={typed} placeholder="Your name" onChange={(e) => setTyped(e.target.value)} />
        </div>
      </Dialog>
    </Section>
  )
}

// Standing permissions (design §7): each as its sentence, who gave it and how often it has been
// used, with Revoke; a revoked one stays listed, greyed, as history. Shown under Permissions.
function Standing({ version }: { version: number }) {
  const [list, setList] = useState<PermissionView[] | null>(null)
  const load = useCallback(() => {
    api.get<PermissionView[]>('/api/permissions').then(setList, () => setList([]))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  if (!list) return null
  return (
    <Embedded
      data={permissionsTable(list)}
      why="A permission is revoked on its own page. Open one to revoke it."
      open={(id) => {
        window.location.hash = `#/permission/${id}`
      }}
    />
  )
}

const MODEL_NAMES: Record<string, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
  'claude-haiku-5-5': 'Claude Haiku 5.5',
}

// The route (design §5): the person's own Claude subscription, signed in with Claude's own sign-in
// on this Mac, or the firm's API key, kept in the Keychain. The choice is this install's.
function ModelSection() {
  const [model, setModel] = useState<ModelView | null>(null)
  const [key, setKey] = useState('')
  const [asking, setAsking] = useState<'key' | 'api' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    api.get<ModelView>('/api/model').then(setModel, () => setModel(null))
  }, [])
  const choose = (route: 'subscription' | 'key' | 'api', given?: string) =>
    api.post<ModelView>('/api/model', { route, ...(given ? { key: given } : {}) }).then(
      (m) => {
        setModel(m)
        setKey('')
        setAsking(null)
        setProblem(null)
      },
      (err: unknown) => setProblem(err instanceof Problem ? err.message : 'That did not go in.'),
    )
  return (
    <Section
      title="Model"
      about={`What Alpha thinks with (${model ? (MODEL_NAMES[model.desk] ?? model.desk) : '…'}), and how it reaches it. Each way says what it can do; the key stays in the Keychain.`}
    >
      {model && (
        <List>
          {model.providers.map((p) => (
            <Row
              key={p.route}
              lead={
                <Tile>
                  <Sparkles className="size-4" />
                </Tile>
              }
              title={p.title}
              sub={
                <>
                  <div>{p.can}</div>
                  {p.cannot && <div className="text-warn">{p.cannot}</div>}
                </>
              }
              actions={
                p.chosen ? (
                  <Pill tone="good">In use</Pill>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (p.route === 'subscription' || model.hasKey) void choose(p.route)
                      else setAsking(p.route)
                    }}
                  >
                    Use this
                  </Button>
                )
              }
            />
          ))}
        </List>
      )}
      {asking && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void choose(asking, key)
          }}
        >
          <Field
            className="flex-1"
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={model?.hasKey ? 'The key kept in the Keychain, or a new one' : 'sk-ant-…'}
          />
          <Button type="submit" variant="primary" disabled={!key.trim() && !model?.hasKey}>
            Use it
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
            Cancel
          </Button>
        </form>
      )}
      {model?.hasKey && model.route !== 'subscription' && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setAsking(model.route === 'api' ? 'api' : 'key')}
        >
          Change the key
        </Button>
      )}
      {problem && <p className="text-bad text-sm">{problem}</p>}
    </Section>
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
          sub="Match Mac follows your Mac's light or dark setting."
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
                { value: 'mac', label: 'Match Mac' },
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
      <span>Last read {when(k.lastSyncAt)}</span>
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
          <Button
            size="sm"
            disabled={busy}
            onClick={() => act(() => api.post(`/api/connections/${k.id}/sync`))}
          >
            Read now
          </Button>
        </>
      ) : k.state === 'needs_sign_in' ? (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            // a site read as the person opens in Chrome; a password goes in Alpha's own form
            if (k.inBrowser) void act(() => api.post(`/api/connections/${k.id}/sign-in`))
            else window.location.hash = `#/settings?connect=${k.connector}`
          }}
        >
          {k.inBrowser ? 'Sign in with Chrome' : 'Sign in'}
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => act(() => api.post(`/api/connections/${k.id}/sync`))}
        >
          Read now
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setLeaving(true)}>
        Disconnect
      </Button>
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
      <div className="flex flex-col gap-2 border-hair border-t pt-3">
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
  onChange,
}: {
  connector: ConnectorView
  connections: ConnectionView[]
  startOpen: boolean
  added: boolean // loaded from Alpha's own connectors/: it can be removed again
  onChange: () => void
}) {
  const system = c.auth === 'system'
  const inBrowser = c.auth === 'browser'
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
      // a site read as the person: they sign in themselves, in its own window of Chrome
      if (inBrowser && made.state === 'needs_sign_in')
        await api.post(`/api/connections/${made.id}/sign-in`)
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
        'flex flex-col gap-3 rounded-lg border border-line bg-surface p-4',
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
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRemoving(true)}>
            Delete
          </Button>
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
          The connector you added goes, with its folder.
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
              disabled={busy || !account.trim() || (!!c.secret && !secret.trim())}
            >
              {busy ? 'Connecting…' : inBrowser ? 'Sign in with Chrome' : 'Connect'}
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

// A connector added without a restart: from a folder, from a pack sent as a file, or one of the
// packs that came with Alpha (LinkedIn), with its warning shown before the first connection.
function AddConnector({ view, onChange }: { view: ConnectorsView; onChange: () => void }) {
  const [folder, setFolder] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const loaded = new Set(view.connectors.map((c) => c.name))
  const offered = view.available.filter((p) => !loaded.has(p.name))
  const act = async (fn: () => Promise<{ title: string }>) => {
    setBusy(true)
    setProblem(null)
    setSaid(null)
    try {
      const out = await fn()
      setSaid(`Added ${out.title}. Connect it above.`)
      setFolder('')
      onChange()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That connector was not added.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-2">
      {offered.length > 0 && (
        <List>
          {offered.map((p) => (
            <Row
              key={p.name}
              lead={
                <Tile>
                  <Plug className="size-4" />
                </Tile>
              }
              title={p.title}
              sub={`Came with Alpha, not loaded until you add it (${p.version})`}
              actions={
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    act(() =>
                      api.post<{ title: string }>('/api/connectors/available', { name: p.name }),
                    )
                  }
                >
                  Add {p.title}
                </Button>
              }
            />
          ))}
        </List>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void act(() => api.post<{ title: string }>('/api/connectors', { folder: folder.trim() }))
        }}
        className="flex gap-2"
      >
        <Field
          className="flex-1"
          value={folder}
          placeholder="A connector's folder, like /Users/you/dev/connectors/outlook"
          onChange={(e) => setFolder(e.target.value)}
        />
        <Button type="submit" disabled={busy || !folder.trim()}>
          {busy ? 'Adding…' : 'Add a connector'}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => picker.current?.click()}>
          Add from a file
        </Button>
        <input
          ref={picker}
          type="file"
          accept=".alphaconnector"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void act(() => api.uploadTo<{ title: string }>('/api/connectors/pack', file))
            e.target.value = ''
          }}
        />
      </form>
      {said && <div className="text-ink-2 text-md">{said}</div>}
      {problem && <div className="text-bad text-md">{problem}</div>}
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

// Experimental: features still being tried, each off until switched on on this computer.
function Experimental() {
  return (
    <Section
      title="Experimental"
      about="Features still being tried. Each is off until you switch it on, on this computer only."
    >
      {EXPERIMENTS.length === 0 ? (
        <p className="text-ink-2 text-md">Nothing to try right now.</p>
      ) : (
        <List>
          {EXPERIMENTS.map((e) => (
            <ExperimentLine key={e.name} name={e.name} title={e.title} about={e.about} />
          ))}
        </List>
      )}
    </Section>
  )
}

function ExperimentLine({ name, title, about }: { name: string; title: string; about: string }) {
  const on = useExperiment(name)
  return (
    <Row
      title={title}
      sub={about}
      actions={<Switch checked={on} label={title} onChange={(v) => setExperiment(name, v)} />}
    />
  )
}

// A shared table inside a page that scrolls: a fixed height, framed like a card.
function Embedded({
  data,
  why,
  open,
}: {
  data: TableData
  why: string
  open: (id: string) => void
}) {
  return (
    <div className="h-[min(520px,70vh)] overflow-hidden rounded-lg border border-line bg-surface">
      <TableView data={data} kept={{ why, open }} />
    </div>
  )
}

// Intelligence's Agents: every agent in one shared table, each opening its page; then the modules
// they come from, to install, update and pack.
function Agents({ version }: { version: number }) {
  const [modules, setModules] = useState<WorkingModuleView[] | null>(null)
  useEffect(() => {
    if (version >= 0)
      api.get<WorkingModuleView[]>('/api/working').then(setModules, () => setModules([]))
  }, [version])
  return (
    <Section title="Agents" about="Every agent, what it does and when it last ran.">
      {modules && (
        <Embedded
          data={agentsTable(modules)}
          why="An agent is turned on or paused on its own page. Open one to change it."
          open={(id) => {
            window.location.hash = `#/agent/${id}`
          }}
        />
      )}
    </Section>
  )
}
