// Settings, a page of sections. Connections and Schedules are in their own files.
import type { CardView, ConnectorsView, DataPageView, Me, ModelView } from '@alpha/core/api'
import { Check, SlidersHorizontal, Sparkles } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { AccountsSection, Foot } from './Accounts.tsx'
import { Activity } from './Activity.tsx'
import { AgentsSection } from './Agents.tsx'
import { api, Problem, wordsOf } from './api.ts'
import { Connections } from './Connections.tsx'
import { HowToWork } from './HowToWork.tsx'
import { KeptFiles } from './KeptFiles.tsx'
import { Modules, when } from './Modules.tsx'
import { modelHelp } from './model-help.ts'
import { AskSites, Standing } from './Rules.tsx'
import { Schedules } from './Schedules.tsx'
import { SetupList, useSetup, useSignIn } from './SetupPanel.tsx'
import { InBar } from './Shell.tsx'
import { TokenForm } from './TokenForm.tsx'
import {
  applyTextSize,
  applyTheme,
  savedTextSize,
  savedTheme,
  type TextSize,
  type Theme,
} from './theme.ts'
import { MODEL_NAMES, UsageSection } from './Usage.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Confirm } from './ui/dialog.tsx'
import { pastedKey, SecretField } from './ui/field.tsx'
import { Info } from './ui/info.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { SideItem, SideList } from './ui/side-list.tsx'
import { Switch } from './ui/switch.tsx'
import { Waiting } from './ui/waiting.tsx'
import { WaitingRules } from './WaitingRules.tsx'

// Settings: how Alpha runs, a list of sections on the left and one section at a time. The tabs
// from Agents to How to work were Intelligence's; they sit here until their own homes (Governance,
// the agents) take them.
const TABS = [
  ['model', 'LLM'],
  ['data', 'Data'],
  ['appearance', 'Appearance'],
  ['permissions', 'Permissions'],
  ['activity', 'Activity'],
  ['people', 'People'],
  ['connections', 'Connections'],
  ['files', 'Files'],
  ['agents', 'Agents'],
  ['modules', 'Modules'],
  ['schedules', 'Schedules'],
  ['work', 'How to work'],
] as const

export function Settings({
  tab,
  open,
  version,
  cards,
}: {
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

  const [me, setMe] = useState<Me | null>(null)
  useEffect(() => {
    api.get<Me>('/api/me').then(setMe, () => undefined)
  }, [])
  // a member does not see the owner's Data, and sees only their own password in People; People
  // only where people sign in
  const member = me?.user.role === 'member'
  const hidden = new Set([...(member ? ['data'] : []), ...(me?.signIn ? [] : ['people'])])
  const tabs = (TABS as readonly (readonly [string, string])[]).filter(([id]) => !hidden.has(id))
  const at = tabs.find(([id]) => id === tab)?.[0] ?? tabs[0]?.[0] ?? TABS[0][0]
  if (!view) return problem ? <p className="p-6 text-ink-3">{problem}</p> : <Waiting />
  const body: Record<string, ReactNode> = {
    work: <HowToWork version={version} />,
    agents: <AgentsSection version={version} />,
    schedules: <Schedules version={version} />,
    connections: <Connections view={view} open={open} version={version} onChange={load} />,
    files: <KeptFiles version={version} module={open} />,
    modules: <Modules version={version} owner={!member} developer={!!me?.developer} />,
    permissions: <Permissions version={version} owner={!member} />,
    model: (
      <>
        <UsageSection />
        <ModelSection />
      </>
    ),
    activity: <Activity version={version} cards={cards} />,
    people: <AccountsSection owner={!member} />,
    data: <DataSection />,
    appearance: <Appearance view={view} onChange={load} />,
  }
  // the bar holds Settings' icon tile and title
  const head = (
    <InBar>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <SlidersHorizontal className="size-4" />
        </span>
        <h1 className="font-serif text-ink text-xl">Settings</h1>
      </div>
    </InBar>
  )
  const go = (id: string) => {
    window.location.hash = `#/settings/${id}`
  }
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-page flex-col gap-6 px-8 pt-7 pb-12">
        {head}
        <div className="grid grid-cols-[170px_1fr] gap-7 max-md:grid-cols-1">
          <SideList label="Settings" className="max-md:flex-row max-md:flex-wrap">
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
            <p className="text-ink-2 text-md">Not known on this Alpha.</p>
          )}
        </Section>
      )}
      <Section
        title="Rules"
        about="What Alpha may and may not do, yours and what it noticed. New starts the conversation; a rule applies once you save it on its card."
      >
        {owner && <AskSites />}
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
                    ? 'Taken when you asked'
                    : b.kind === 'before'
                      ? 'Taken before going back'
                      : 'Taken before tables changed'
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
  const onServer = model?.token !== null && model?.token !== undefined
  const kept = model?.hasKey
    ? onServer
      ? 'Key saved on this server'
      : "Key saved in this Mac's Keychain"
    : 'No key yet'
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
                    <Info
                      help={[modelHelp(p.route, onServer), `It reaches ${p.can}.`, p.cannot]
                        .filter(Boolean)
                        .join('\n\n')}
                    />
                    {p.chosen && <Pill tone="accent">In use</Pill>}
                  </span>
                }
                sub={
                  <>
                    <div className="text-ink-2">{state}</div>
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
      <SecretField
        className="w-72"
        aria-label="API key"
        placeholder="Paste the key"
        value={key}
        onChange={(e) => setKey(pastedKey(e.target.value))}
      />
      <Button size="sm" type="submit" disabled={busy || !key.trim()} data-tip={title}>
        Save
      </Button>
    </form>
  )
}

function Appearance({ view, onChange }: { view: ConnectorsView; onChange: () => void }) {
  const [theme, setTheme] = useState<Theme>(savedTheme)
  const [size, setSize] = useState<TextSize>(savedTextSize)
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
        <Row
          title="Text size"
          actions={
            <Segmented
              label="Text size"
              value={size}
              onChange={(t) => {
                setSize(t)
                applyTextSize(t)
                void act(() => api.post('/api/appearance', { textSize: t }))
              }}
              options={[
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
              ]}
            />
          }
        />
        {tables.length > 0 && (
          <Row
            title="Show mail, events and contacts in the sidebar"
            about="Mail, events and contacts that connections keep, shown with your own tables."
            actions={
              <Switch
                checked={shown}
                disabled={busy}
                label="Show mail, events and contacts in the sidebar"
                named
                onChange={showTables}
              />
            }
          />
        )}
      </List>
    </Section>
  )
}
