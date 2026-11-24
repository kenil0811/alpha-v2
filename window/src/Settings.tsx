// Settings: four groups of parts in a side list on the left, one part at a time on the right.
// Connections, Automations, Logs, Files and the rest are in their own files.
import type { ConnectorsView, DataPageView, Health, Me, ModelView } from '@alpha/core/api'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { Fragment, type ReactNode, useCallback, useEffect, useState } from 'react'
import { AccountsSection } from './Accounts.tsx'
import { api, Problem, wordsOf } from './api.ts'
import { startAsk } from './ask.ts'
import { Connections } from './Connections.tsx'
import { HowToWork } from './HowToWork.tsx'
import { KeptFiles } from './KeptFiles.tsx'
import { Logs } from './Logs.tsx'
import { when } from './Modules.tsx'
import { modelHelp } from './model-help.ts'
import { ReadReport } from './ReadReport.tsx'
import { AskSites, Standing } from './Rules.tsx'
import { Schedules } from './Schedules.tsx'
import { useSetup, useSignIn } from './SetupPanel.tsx'
import { InBar } from './Shell.tsx'
import { SetUpPart } from './story/StoryCard.tsx'
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
import { Confirm } from './ui/dialog.tsx'
import { pastedKey, SecretField } from './ui/field.tsx'
import { List, Row } from './ui/list.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { SideHead, SideItem, SideList } from './ui/side-list.tsx'
import { STATE_CARDS, StateCard } from './ui/state-card.tsx'
import { Switch } from './ui/switch.tsx'
import { Waiting } from './ui/waiting.tsx'
import { WaitingRules } from './WaitingRules.tsx'

// Settings' parts under four headings; a part's id is its address (#/settings/connections). A
// group of one part is its line alone. Agents have their own screen and modules the rail.
const GROUPS: { name: string; parts: [string, string][] }[] = [
  {
    name: 'General',
    parts: [
      ['appearance', 'Appearance'],
      ['people', 'Members'],
      ['setup', 'Set up Alpha'],
      ['alpha', 'Alpha'],
    ],
  },
  {
    name: 'Intelligence',
    parts: [
      ['usage', 'Usage'],
      ['model', 'Models'],
      ['schedules', 'Automations'],
      ['connections', 'Connections'],
    ],
  },
  { name: 'Rules', parts: [['rules', 'Rules']] },
  {
    name: 'Data',
    parts: [
      ['logs', 'Logs'],
      ['read', 'What Alpha read'],
      ['backup', 'Backup and restore'],
      ['files', 'Files'],
    ],
  },
]

// Old addresses (bookmarks, links in cards) and the part they mean now.
const MOVED: Record<string, string> = {
  llm: 'model',
  permissions: 'rules',
  work: 'rules',
  data: 'backup',
  activity: 'logs',
}

export function Settings({
  tab,
  open,
  version,
}: {
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

  const [me, setMe] = useState<Me | null>(null)
  useEffect(() => {
    api.get<Me>('/api/me').then(setMe, () => undefined)
  }, [])
  // a member does not see the owner's backups, and sees only their own password in Members;
  // Members only where people sign in
  const member = me?.user.role === 'member'
  const hidden = new Set([...(member ? ['backup'] : []), ...(me?.signIn ? [] : ['people'])])
  const groups = GROUPS.map((g) => ({
    ...g,
    parts: g.parts.filter(([id]) => !hidden.has(id)),
  })).filter((g) => g.parts.length > 0)
  const parts = groups.flatMap((g) => g.parts)
  const asked = MOVED[tab ?? ''] ?? tab
  const at = parts.find(([id]) => id === asked)?.[0] ?? parts[0]?.[0] ?? 'appearance'
  if (!view) return problem ? <p className="p-6 text-ink-3">{problem}</p> : <Waiting />
  const body: Record<string, ReactNode> = {
    appearance: <Appearance view={view} onChange={load} />,
    people: <AccountsSection owner={!member} />,
    setup: <SetUpPart />,
    alpha: <AlphaPart me={me} />,
    usage: <UsageSection />,
    model: <ModelSection />,
    schedules: <Schedules version={version} />,
    connections: (
      <Connections view={view} open={open} version={version} owner={!member} onChange={load} />
    ),
    rules: <RulesPart version={version} owner={!member} />,
    logs: <Logs version={version} />,
    read: <ReadReport version={version} />,
    backup: <DataSection />,
    files: <KeptFiles version={version} module={open} />,
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
            {groups.map((g) => (
              <Fragment key={g.name}>
                {g.parts.length > 1 ? (
                  <SideHead>{g.name}</SideHead>
                ) : (
                  <div className="h-3 max-md:hidden" />
                )}
                {g.parts.map(([id, name]) => (
                  <SideItem key={id} on={id === at} onClick={() => go(id)}>
                    {name}
                  </SideItem>
                ))}
              </Fragment>
            ))}
          </SideList>
          <div className="flex min-w-0 flex-col gap-8">{body[at]}</div>
        </div>
      </div>
    </div>
  )
}

// Alpha itself: the version running and, where people sign in, who is with Sign out. No Check for
// updates until an install has a feed to ask.
function AlphaPart({ me }: { me: Me | null }) {
  const [health, setHealth] = useState<Health | null>(null)
  useEffect(() => {
    api.get<Health>('/api/health').then(setHealth, () => undefined)
  }, [])
  return (
    <Section title="Alpha">
      <List>
        <Row
          title={health ? `Alpha ${health.version}` : 'Alpha'}
          sub={health?.build ? `Version ${health.build}` : undefined}
        />
        {me?.signIn && (
          <Row
            title={`Signed in as ${me.user.name}`}
            actions={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void api.post('/api/session/out').finally(() => window.location.replace('/'))
                }}
              >
                Sign out
              </Button>
            }
          />
        )}
      </List>
    </Section>
  )
}

// Rules: New rule at the head, starting the sentence with Alpha; the website switch above the
// list (the owner's), what waits for a Save, every rule; then how the person asked things done.
function RulesPart({ version, owner }: { version: number; owner: boolean }) {
  return (
    <>
      <Section
        title="Rules"
        about="What Alpha may and may not do, yours and what it noticed. New rule starts the conversation; a rule applies once you save it on its card."
        action={
          <Button size="sm" onClick={() => startAsk('From now on, ')}>
            <Plus className="size-3.5" />
            New rule
          </Button>
        }
      >
        {owner && <AskSites />}
        <WaitingRules version={version} />
        <Standing version={version} />
      </Section>
      <HowToWork version={version} />
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
  // true once the core did it
  const act = async (
    fn: () => Promise<{ restarting?: boolean }>,
    words?: string,
  ): Promise<boolean> => {
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
      return true
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not go through.')
      return false
    } finally {
      setBusy(false)
    }
  }
  if (!view)
    return (
      <Section title="Backup and restore" about="Your backups.">
        {problem ? <p className="text-ink-2 text-md">{problem}</p> : <Waiting className="p-0" />}
      </Section>
    )
  return (
    <Section
      title="Backup and restore"
      about="Your last ten backups. Go back to any of them, or take one now."
    >
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
        done={{ words: 'Going back to that backup. Alpha restarts in a moment.' }}
        busy={busy || restarting}
        onClose={() => setGoingBack(null)}
        onYes={() => {
          const name = goingBack
          setGoingBack(null)
          return act(() => api.post('/api/data/restore', { name }))
        }}
      >
        Alpha backs up now first, then restarts on this one.
      </Confirm>
      {said && <div className="text-ink-2 text-md">{said}</div>}
      {problem && <div className="text-bad text-md">{problem}</div>}
    </Section>
  )
}

// The ways to the model, a small card each: the person's own Claude subscription, signed in with
// Claude's own sign-in on this Mac, or the firm's API key, kept in the Keychain. The choice is this
// install's. Each card's dot says whether it is the one in use and ready.
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
  return (
    <Section
      title="Models"
      about={`Alpha thinks with ${model ? (MODEL_NAMES[model.desk] ?? model.desk) : '…'}.`}
    >
      {model && (
        <div className={STATE_CARDS}>
          {model.providers.map((p) => {
            const subscription = p.route === 'subscription'
            const signedIn = !!setup?.claude.signedIn
            const ready = subscription ? signedIn || !!model.token : model.hasKey
            return (
              <StateCard
                key={p.route}
                state={!p.chosen ? 'off' : ready ? 'good' : 'warn'}
                says={!p.chosen ? 'Not in use' : ready ? 'In use' : 'In use, not ready'}
                title={p.title}
                about={[modelHelp(p.route, onServer), `It reaches ${p.can}.`, p.cannot]
                  .filter(Boolean)
                  .join('\n\n')}
                sub={
                  subscription
                    ? signedIn && setup?.claude.email
                    : model.hasKey &&
                      (onServer ? 'Key saved on this server' : "Key saved in this Mac's Keychain")
                }
                act={
                  <>
                    {subscription && setup && !signedIn && model.token === null && (
                      <Button size="sm" variant="primary" disabled={waiting} onClick={signIn}>
                        {waiting ? 'Waiting…' : 'Sign in'}
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
                {on === p.route && <Refusal words={problem} />}
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
              </StateCard>
            )
          })}
        </div>
      )}
    </Section>
  )
}

// A key route's own key: typed on its card, saved to the Keychain on Save.
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
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void onSave(key.trim()).then((ok) => ok && setKey(''))
      }}
    >
      <SecretField
        className="min-w-0 flex-1"
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
