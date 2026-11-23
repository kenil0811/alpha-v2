// Settings, a page of sections. Connections and Schedules are in their own files.
import type {
  ConnectorsView,
  DataPageView,
  Health,
  Me,
  ModelView,
  StoryView,
  UpdateView,
} from '@alpha/core/api'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { AccountsSection } from './Accounts.tsx'
import { api, Problem, wordsOf } from './api.ts'
import { startAsk } from './ask.ts'
import { Connections } from './Connections.tsx'
import { HowToWork } from './HowToWork.tsx'
import { KeptFiles } from './KeptFiles.tsx'
import { Logs } from './Logs.tsx'
import { when } from './Modules.tsx'
import { modelHelp } from './model-help.ts'
import { Standing } from './Rules.tsx'
import { Schedules } from './Schedules.tsx'
import { useSetup, useSignIn } from './SetupPanel.tsx'
import { InBar } from './Shell.tsx'
import { SET_UP } from './story/address.ts'
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
import { notify } from './ui/notice.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { SideItem, SideList } from './ui/side-list.tsx'
import { STATE_CARDS, StateCard } from './ui/state-card.tsx'
import { Switch } from './ui/switch.tsx'
import { Tabs } from './ui/tabs.tsx'
import { UpdateNow } from './ui/update-now.tsx'
import { Waiting } from './ui/waiting.tsx'
import { WaitingRules } from './WaitingRules.tsx'

// Settings: four pages on the left; a page's parts run one under another in one scroll, their
// names a row of tabs pinned at its top, following the scroll, a click on one scrolling to it
// (Vikas, 23 Nov). A part's id is its address (#/settings/connections). Agents and modules have
// their own Setup.
const PAGES: { name: string; parts: [string, string][] }[] = [
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

// how far below the scroll's top a part counts as the one in view: under the pinned tabs
const UNDER_TABS = 64

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
  // a member does not see the owner's parts (backups, members); Members only where people sign in
  const member = me?.user.role === 'member'
  const hidden = new Set(member ? ['backup', 'people'] : me?.signIn ? [] : ['people'])
  const pages = PAGES.map((p) => ({ ...p, parts: p.parts.filter(([id]) => !hidden.has(id)) }))
  const asked = MOVED[tab ?? ''] ?? tab
  const page = pages.find((p) => p.parts.some(([id]) => id === asked)) ?? pages[0]
  const parts = page?.parts ?? []
  const first = parts[0]?.[0] ?? ''
  const askedPart = parts.some(([id]) => id === asked) ? (asked ?? first) : first

  const scroller = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(askedPart) // the part in view, for the tabs
  // the tabs follow only the person's own scrolling: after a jump to a part (a tab, the address),
  // the part asked for stays chosen even where the page cannot scroll it to the top
  const byHand = useRef(false)
  // the part chosen, named in the address without a jump, so a reload lands on it
  const mark = useCallback((id: string) => {
    setSeen(id)
    history.replaceState(null, '', `#/settings/${id}`)
  }, [])
  const hand = () => {
    byHand.current = true
  }
  const target = useRef(askedPart) // the part last jumped to
  const scrollTo = useCallback(
    (id: string) => {
      target.current = id
      const box = scroller.current
      const el = document.getElementById(`settings-${id}`)
      mark(id)
      byHand.current = false
      if (box && el)
        box.scrollTop +=
          el.getBoundingClientRect().top - box.getBoundingClientRect().top - UNDER_TABS
    },
    [mark],
  )
  // the address's part once the page has drawn; and again as the parts above it load and grow,
  // until the person scrolls
  const column = useRef<HTMLDivElement>(null)
  const drawn = view !== null
  useEffect(() => {
    if (drawn) scrollTo(askedPart)
  }, [drawn, askedPart, scrollTo])
  useEffect(() => {
    const grown = new ResizeObserver(() => {
      if (!byHand.current) scrollTo(target.current)
    })
    if (column.current) grown.observe(column.current)
    return () => grown.disconnect()
  }, [drawn, scrollTo])
  // scrolling: the last part whose top has passed under the tabs, the last one at the foot
  const spy = () => {
    const box = scroller.current
    if (!box || !byHand.current) return
    const top = box.getBoundingClientRect().top + UNDER_TABS + 8
    let now = first
    for (const [id] of parts)
      if ((document.getElementById(`settings-${id}`)?.getBoundingClientRect().top ?? top) <= top)
        now = id
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4) now = parts.at(-1)?.[0] ?? now
    if (now !== seen) mark(now)
  }

  if (!view) return problem ? <p className="p-6 text-ink-3">{problem}</p> : <Waiting />
  const body: Record<string, ReactNode> = {
    appearance: <Appearance view={view} onChange={load} />,
    setup: <SetUpPart version={version} />,
    alpha: <AlphaPart me={me} />,
    people: <AccountsSection />,
    usage: <UsageSection />,
    model: <ModelSection />,
    schedules: <Schedules version={version} />,
    connections: (
      <Connections view={view} open={open} version={version} owner={!member} onChange={load} />
    ),
    rules: <RulesPart version={version} owner={!member} />,
    logs: <Logs version={version} />,
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
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: it only notes that the person scrolls
    <div
      ref={scroller}
      onScroll={spy}
      onWheel={hand}
      onTouchStart={hand}
      onPointerDown={hand}
      onKeyDown={hand}
      className="h-full overflow-y-auto"
    >
      {head}
      <div className="mx-auto grid max-w-page grid-cols-[170px_1fr] gap-7 px-8 pt-7 pb-12 max-md:grid-cols-1">
        <SideList
          label="Settings"
          className="sticky top-7 max-md:static max-md:flex-row max-md:flex-wrap"
        >
          {pages.map((p) => (
            <SideItem
              key={p.name}
              on={p === page}
              onClick={() => {
                const to = p.parts[0]?.[0]
                if (p === page && to) scrollTo(to)
                else if (to) window.location.hash = `#/settings/${to}`
              }}
            >
              {p.name}
            </SideItem>
          ))}
        </SideList>
        <div className="flex min-w-0 flex-col">
          {parts.length > 1 && (
            <div className="sticky top-0 z-2 bg-canvas">
              <Tabs
                label={page?.name ?? 'Settings'}
                under
                tabs={parts.map(([id, name]) => ({
                  key: id,
                  href: `#/settings/${id}`,
                  label: name,
                  sel: id === seen,
                  onPick: () => scrollTo(id),
                }))}
              />
            </div>
          )}
          <div ref={column} className="flex flex-col gap-12 pt-6">
            {parts.map(([id]) => (
              <div key={id} id={`settings-${id}`} className="flex flex-col gap-8">
                {body[id]}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Set up Alpha, to go through again or carry on (Vikas, 23 Nov; it was on the workspace tile's
// menu): how many steps are done, and the story opened where it is, or from the start once done.
function SetUpPart({ version }: { version: number }) {
  const [story, setStory] = useState<StoryView | null>(null)
  useEffect(() => {
    if (version >= 0) api.get<StoryView>('/api/story').then(setStory, () => undefined)
  }, [version])
  if (!story) return null
  const done = story.chapters.filter((c) => c.state === 'done').length
  return (
    <Section title="Set up Alpha">
      <List>
        <Row
          title={`${done} of ${story.chapters.length} steps done`}
          actions={
            <Button
              size="sm"
              onClick={() => {
                const go = () => {
                  window.location.hash = SET_UP
                }
                // a finished one starts again (the core's reopen); one under way carries on
                if (story.done)
                  void api
                    .post('/api/story/reopen')
                    .catch(() => undefined)
                    .finally(go)
                else go()
              }}
            >
              {story.done ? 'Set up again' : 'Carry on'}
            </Button>
          }
        />
      </List>
    </Section>
  )
}

// Alpha itself (Vikas, 23 Nov; the version was a line at Settings' foot): the version running and
// Check for updates against the install's feed, and, where people sign in, who is and Sign out.
function AlphaPart({ me }: { me: Me | null }) {
  const [version, setVersion] = useState<string | null>(null)
  const [update, setUpdate] = useState<UpdateView | null>(null)
  const { busy, problem, act } = useAct()
  useEffect(() => {
    api.get<Health>('/api/health').then(
      (h) => setVersion(h.version),
      () => undefined,
    )
  }, [])
  const said = !update
    ? null
    : !update.set
      ? 'Updates aren’t set up on this Alpha yet'
      : update.newest
        ? `Update available: ${update.newest}`
        : 'Up to date'
  return (
    <Section title="Alpha">
      <List>
        <Row
          title={`Alpha ${version ?? ''}`}
          sub={problem ?? said}
          actions={
            <>
              {update?.url && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => window.open(update.url, '_blank', 'noreferrer')}
                >
                  Update
                </Button>
              )}
              <UpdateNow
                label="Check for updates"
                at={null}
                busy={busy}
                words={false}
                onClick={() => act(async () => setUpdate(await api.get<UpdateView>('/api/update')))}
              />
            </>
          }
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

// Rules, one page (Vikas, 23 Nov): New rule, what waits for a yes, every rule in one list (the
// standing choice its first row), then how the person asked things to be done.
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
        <WaitingRules version={version} />
        <Standing version={version} owner={owner} />
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

// The ways to the model (Vikas, 23 Nov: a small card each): the person's own Claude subscription,
// signed in with Claude's own sign-in on this Mac, or the firm's API key, kept in the Keychain. The
// choice is this install's. Each card's dot says whether it is the one in use and ready.
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
  const showTables = async (on: boolean) => {
    const ok = await act(async () => {
      for (const t of tables) await api.post(`/api/tables/${t.id}/sidebar`, { shown: on })
    })
    if (ok && !on)
      notify({
        words: 'Mail, events and contacts are out of the sidebar. Show them again in',
        where: { label: 'Appearance', href: '#/settings/appearance' },
      })
  }
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
