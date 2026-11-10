// Intelligence and Settings, each a page of tabs or sections. Connections and Schedules are in
// their own files.
import type { CardView, ConnectorsView, DataPageView, Me, ModelView } from '@alpha/core/api'
import { Check, SlidersHorizontal, Sparkles } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { AccountsSection, Foot } from './Accounts.tsx'
import { Activity } from './Activity.tsx'
import { AgentsSection } from './Agents.tsx'
import { api, Problem, wordsOf } from './api.ts'
import { Connections } from './Connections.tsx'
import { HowToWork } from './HowToWork.tsx'
import { Modules, when } from './Modules.tsx'
import { AnySite, Standing } from './Rules.tsx'
import { Schedules } from './Schedules.tsx'
import { SetupList, useSetup, useSignIn } from './SetupPanel.tsx'
import { InBar } from './Shell.tsx'
import { TokenForm } from './TokenForm.tsx'
import { applyTheme, savedTheme, type Theme } from './theme.ts'
import { MODEL_NAMES, UsageSection } from './Usage.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Confirm } from './ui/dialog.tsx'
import { Field } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { SideItem, SideList } from './ui/side-list.tsx'
import { Switch } from './ui/switch.tsx'
import { Tabs } from './ui/tabs.tsx'
import { Waiting } from './ui/waiting.tsx'
import { WaitingRules } from './WaitingRules.tsx'

// Two pages share this file. Intelligence: what Alpha knows and does, as
// tabs. Settings: how Alpha runs, a list of sections on the left and one section at a time.
const PAGES = {
  intelligence: {
    icon: <Sparkles className="size-4" />,
    title: 'Intelligence',
    about: 'Your agents, modules, schedules and connections, and how to work.',
    tabs: [
      ['agents', 'Agents'],
      ['modules', 'Modules'],
      ['schedules', 'Schedules'],
      ['connections', 'Connections'],
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
  if (!view) return problem ? <p className="p-6 text-ink-3">{problem}</p> : <Waiting />
  const body: Record<string, ReactNode> = {
    work: <HowToWork version={version} />,
    agents: <AgentsSection version={version} />,
    schedules: <Schedules version={version} />,
    connections: <Connections view={view} open={open} onChange={load} />,
    modules: <Modules version={version} owner={!member} developer={!!me?.developer} />,
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
        {owner && <AnySite />}
        <WaitingRules version={version} />
        <Standing version={version} />
      </Section>
    </>
  )
}

// The person's own data: the last ten backups, going back to any, a backup now. Taking it,
// bringing it in and deleting it are the `alpha` command's.
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
        {problem ? <p className="text-ink-2 text-md">{problem}</p> : <Waiting className="p-0" />}
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

// The route: the person's own Claude subscription, signed in with Claude's own sign-in
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
                    {subscription && setup && !setup.claude.signedIn && model.token === null && (
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
                {subscription && model.token !== null && (
                  <TokenForm has={model.token} onSaved={setModel} />
                )}
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
