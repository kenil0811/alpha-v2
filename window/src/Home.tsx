// Home (Kenil, 20 Oct: "Home should be about all important things, the space in home is very
// precious"): no conversation here. One line to ask Alpha, whose answer opens on the right; then
// what needs the person (cards answered right here), what changed since they last looked (kept
// until they clear it), what is running and what is coming up; the modules are in the rail, not
// here (Kenil, 26 Oct). The conversation has its own place in the rail, each module's tab, and Ask
// (⌘J) on any screen.
import type {
  CardView,
  ConnectorsView,
  ModuleSummary,
  Stream,
  TasksView,
  TodayView,
  WorkingModuleView,
} from '@alpha/core/api'
import { ArrowUp, Bot, Check, ChevronRight, KeyRound, LoaderCircle } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { api, Problem } from './api.ts'
import { Arranged } from './arrange.tsx'
import { CardBox } from './Conversation.tsx'
import { SetupList, unready, useSetup } from './SetupPanel.tsx'
import { signInWith } from './SignInApps.tsx'
import { TaskList } from './Tasks.tsx'
import { clock, dayWords, sinceWords } from './time.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Group, Line, Quiet } from './ui/groups.tsx'
import { Label } from './ui/pill.tsx'

// A part of Home whose load failed: said in its place, with the way to try again.
function NotLoaded({ onTry }: { onTry: () => void }) {
  return (
    <p className="flex items-center gap-2 text-md text-warn">
      This didn't load.
      <Button size="sm" variant="ghost" onClick={onTry}>
        Try again
      </Button>
    </p>
  )
}

function greeting(name: string): string {
  const h = new Date().getHours()
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return name ? `${part}, ${name}` : part
}

export function Home({
  stream,
  modules,
  name,
  onAsked,
}: {
  stream: Stream | null
  modules: ModuleSummary[]
  name: string
  onAsked: () => void // the answer opens on the right
}) {
  const [today, setToday] = useState<TodayView | null>(null)
  const [setup, reloadSetup] = useSetup()
  const [tasks, setTasks] = useState<TasksView | null>(null)
  // a load that failed is said, with Try again, never shown as a quiet day (item 30, 25 Oct)
  const [failed, setFailed] = useState<{ today: boolean; tasks: boolean }>({
    today: false,
    tasks: false,
  })
  const [words, setWords] = useState('')
  const [allComing, setAllComing] = useState(false)
  const ask = useRef<HTMLInputElement>(null)
  const last = stream?.lastId
  const load = useCallback(() => {
    api.get<TodayView>('/api/today').then(
      (t) => {
        setToday(t)
        setFailed((f) => (f.today ? { ...f, today: false } : f))
      },
      () => setFailed((f) => ({ ...f, today: true })),
    )
    api.get<TasksView>('/api/tasks?list=today').then(
      (t) => {
        setTasks(t)
        setFailed((f) => (f.tasks ? { ...f, tasks: false } : f))
      },
      () => setFailed((f) => ({ ...f, tasks: true })),
    )
  }, [])
  // on opening, and at each new journal line, Home looks again
  useEffect(() => {
    void last
    load()
  }, [load, last])

  const cards = stream?.cards ?? []
  const signIns = stream?.attention ?? []
  const running = stream?.running ?? []
  const reading = stream?.reading ?? []
  const changed = today?.changed ?? []
  const coming = today?.coming ?? []
  // a card that waits is never hidden behind the welcome
  const firstOpen =
    stream !== null &&
    modules.length === 0 &&
    stream.lines.length === 0 &&
    cards.length + signIns.length === 0
  const changeCard = (card: CardView) => {
    setWords(`About “${card.words.replace(/\?$/, '')}”: `)
    ask.current?.focus()
  }

  return (
    <div className="@container h-full overflow-y-auto">
      <div className="mx-auto flex max-w-page flex-col gap-7 px-8 pt-8 pb-12">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-ink-3 text-sm">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <h1 className="mt-1 font-serif text-2xl text-ink">{greeting(name)}</h1>
            <p className="mt-1 text-ink-2 text-md">What needs you and what changed.</p>
          </div>
          <AskBox area={ask} words={words} setWords={setWords} onAsked={onAsked} />
        </div>

        {stream?.settingUp && (
          <p className="flex items-center gap-2 text-ink-2 text-md">
            <LoaderCircle className="size-3.5 animate-spin text-ink-3" />
            Setting up {stream.settingUp}; Alpha works meanwhile, and they appear as they go in.
          </p>
        )}

        {setup && unready(setup) && (
          <Group
            title="Getting this Mac ready"
            sub="Alpha works meanwhile; these finish setting it up"
          >
            <SetupList view={setup} onChange={reloadSetup} />
          </Group>
        )}

        {firstOpen ? (
          <Welcome
            onTry={(w) => {
              setWords(w)
              ask.current?.focus()
            }}
          />
        ) : (
          // what waits on the person, their day and what Alpha did, each a block the person
          // drags beside, above or below another and resizes from its corner (Vikas, 29–30 Oct)
          <Arranged
            page="home"
            start={[['needs', 'tasks'], ['changed', 'coming'], ['running']]}
            blocks={[
              {
                key: 'needs',
                name: 'Needs you',
                node: (
                  <Group title="Needs you" count={cards.length + signIns.length}>
                    {stream && cards.length + signIns.length === 0 && (
                      <Quiet>Nothing waits on you.</Quiet>
                    )}
                    {cards.map((c) => (
                      <CardBox key={c.id} id={c.id} card={c} onChange={changeCard} />
                    ))}
                    {signIns.map((a) => (
                      <Line
                        key={a.connector}
                        icon={<KeyRound className="size-3.5 text-warn" />}
                        head={a.waiting ? 'Waiting for the customer' : 'Sign-in'}
                        words={
                          a.waiting
                            ? `${a.title}: ${a.waiting}`
                            : a.inBrowser
                              ? `${a.title} needs you to sign in: it opens in Chrome`
                              : a.signsInWith
                                ? `${a.title} needs you to sign in with ${a.signsInWith}: it opens in your browser`
                                : `${a.title} needs you to sign in again`
                        }
                        {...(a.waiting
                          ? { href: '#/intelligence/connections' }
                          : a.inBrowser
                            ? {
                                onClick: () => {
                                  void api.post(`/api/connections/${a.connection}/sign-in`)
                                },
                              }
                            : a.signsInWith
                              ? {
                                  onClick: () => {
                                    void signInWith(a.connection)
                                  },
                                }
                              : { href: `#/settings?connect=${a.connector}` })}
                      />
                    ))}
                  </Group>
                ),
              },
              {
                key: 'changed',
                name: 'Since you last looked',
                node: (
                  <Group
                    title="Since you last looked"
                    sub={today ? sinceWords(today.since) : undefined}
                    action={
                      changed.length > 0 && (
                        <button
                          type="button"
                          className="text-ink-3 text-xs underline underline-offset-3 hover:text-ink"
                          onClick={() => api.post('/api/today/seen').then(load, load)}
                        >
                          Clear
                        </button>
                      )
                    }
                  >
                    {failed.today && <NotLoaded onTry={load} />}
                    {today && !failed.today && changed.length === 0 && (
                      <Quiet>Nothing changed.</Quiet>
                    )}
                    {changed.length > 0 && (
                      <div className="overflow-hidden rounded-lg border border-line bg-surface">
                        {changed.slice(0, 10).map((r) => {
                          const said = r.words?.startsWith(`${r.name}: `)
                            ? r.words.slice(r.name.length + 2)
                            : r.words
                          return (
                            <Line
                              key={r.id}
                              boxed
                              icon={<Bot className="size-3.5 text-ink-3" />}
                              head={`${r.name}${r.module ? ` · ${r.module}` : ''} · ${clock(new Date(r.startedAt))}`}
                              words={said ?? ''}
                              warn={r.state === 'failed'}
                              href="#/activity"
                            />
                          )
                        })}
                      </div>
                    )}
                    {changed.length > 10 && (
                      <a
                        className="text-accent text-sm underline underline-offset-3"
                        href="#/activity"
                      >
                        {changed.length - 10} more in Activity
                      </a>
                    )}
                  </Group>
                ),
              },
              {
                key: 'tasks',
                name: "Today's tasks",
                node: (
                  <Group
                    title="Today's tasks"
                    count={tasks?.lines.filter((t) => t.overdue).length}
                    action={
                      <a
                        className="text-ink-3 text-xs underline underline-offset-3 hover:text-ink"
                        href="#/tasks"
                      >
                        All tasks
                      </a>
                    }
                  >
                    {tasks && (
                      <div className="grid grid-cols-3 gap-2">
                        <TaskTile
                          label="Overdue"
                          n={tasks.counts.overdue ?? 0}
                          list="overdue"
                          bad
                        />
                        <TaskTile label="Due today" n={tasks.counts.today ?? 0} list="today" />
                        <TaskTile label="This week" n={tasks.counts.week ?? 0} list="week" />
                      </div>
                    )}
                    {failed.tasks && <NotLoaded onTry={load} />}
                    {tasks && !failed.tasks && tasks.lines.length === 0 && (
                      <Quiet>Nothing due today. Say a task, or add one in Tasks.</Quiet>
                    )}
                    {tasks && tasks.lines.length > 0 && (
                      <TaskList lines={tasks.lines} onChange={load} />
                    )}
                  </Group>
                ),
              },
              ...(running.length > 0 || reading.length > 0
                ? [
                    {
                      key: 'running',
                      name: 'Running',
                      node: (
                        <Group title="Running">
                          <div className="overflow-hidden rounded-lg border border-line bg-surface">
                            {reading.map((r) => (
                              <div
                                key={r.connection}
                                className="flex items-center gap-2.5 border-hair border-t px-4 py-2.5 text-md first:border-t-0"
                              >
                                <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
                                <span className="min-w-0 flex-1 truncate text-ink">
                                  Reading {r.title}
                                  <span className="text-ink-3"> · {r.account}</span>
                                </span>
                              </div>
                            ))}
                            {running.map((r) => (
                              <div
                                key={r.id}
                                className="flex items-center gap-2.5 border-hair border-t px-4 py-2.5 text-md first:border-t-0"
                              >
                                <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
                                <span className="min-w-0 flex-1 truncate text-ink">{r.name}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => api.post(`/api/runs/${r.id}/stop`)}
                                >
                                  Stop
                                </Button>
                              </div>
                            ))}
                          </div>
                        </Group>
                      ),
                    },
                  ]
                : []),
              {
                key: 'coming',
                name: 'Coming up',
                node: (
                  <Group title="Coming up">
                    {failed.today && <NotLoaded onTry={load} />}
                    {today && !failed.today && coming.length === 0 && (
                      <Quiet>No agent runs on the clock.</Quiet>
                    )}
                    {coming.length > 0 && (
                      <div className="overflow-hidden rounded-lg border border-line bg-surface">
                        {/* opened out, the rows scroll inside their box, not the whole screen (Kenil,
                        21 Oct) */}
                        <div className={allComing ? 'max-h-80 overflow-y-auto' : undefined}>
                          {(allComing ? coming : coming.slice(0, 3)).map((c) => (
                            <a
                              key={c.agent}
                              href={`#/module/${c.module}/agents`}
                              className="flex items-baseline gap-2 border-hair border-t px-4 py-2.5 text-md first:border-t-0 hover:bg-hover"
                            >
                              <span className="min-w-0 flex-1 truncate text-ink">
                                {c.name}
                                <span className="text-ink-3"> · {c.moduleName}</span>
                              </span>
                              <span className="shrink-0 text-ink-3 text-sm">{dayWords(c.at)}</span>
                            </a>
                          ))}
                        </div>
                        {coming.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setAllComing((a) => !a)}
                            className="w-full border-hair border-t px-4 py-2 text-left text-accent text-sm hover:bg-hover"
                          >
                            {allComing ? 'Fewer' : `${coming.length - 3} more`}
                          </button>
                        )}
                      </div>
                    )}
                  </Group>
                ),
              },
            ]}
          />
        )}
      </div>
    </div>
  )
}

// One line to ask Alpha; the answer opens on the right, in the conversation.
function AskBox({
  area,
  words,
  setWords,
  onAsked,
}: {
  area: React.RefObject<HTMLInputElement | null>
  words: string
  setWords: (w: string) => void
  onAsked: () => void
}) {
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const send = async (e: FormEvent) => {
    e.preventDefault()
    const w = words.trim()
    if (!w || busy) return
    setBusy(true)
    setProblem(null)
    try {
      await api.post('/api/say', { words: w })
      setWords('')
      onAsked()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not reach Alpha.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={send} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pr-1.5 pl-4 shadow-pop focus-within:border-accent-line focus-within:ring-3 focus-within:ring-accent-soft">
        <input
          ref={area}
          value={words}
          onChange={(e) => setWords(e.target.value)}
          placeholder="Ask Alpha, or tell it what to keep"
          aria-label="Ask Alpha"
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!words.trim() || busy}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-35"
        >
          <ArrowUp className="size-4" />
        </button>
      </div>
      {problem && <div className="text-bad text-sm">{problem}</div>}
    </form>
  )
}

// First open: a few ways to start, and three setup rows, none of which stands in the way.
function Welcome({ onTry }: { onTry: (words: string) => void }) {
  // the connectors that ask for a place here (their manifests), and the one that takes a folder
  const [view, setView] = useState<{
    steps: { name: string; words: string; sub: string; done: boolean }[]
    kit: boolean
  } | null>(null)
  useEffect(() => {
    Promise.all([
      api.get<ConnectorsView>('/api/connectors'),
      api.get<WorkingModuleView[]>('/api/working'),
    ]).then(
      ([c, w]) =>
        setView({
          steps: c.connectors
            .filter((k) => k.setup || k.auth === 'path')
            .map((k) => ({
              name: k.name,
              words: k.auth === 'path' ? `Add a ${k.title.toLowerCase()}` : `Connect ${k.title}`,
              sub:
                k.auth === 'path'
                  ? 'Documents and downloaded files, read where they are'
                  : (k.setup?.sub ?? ''),
              done: c.connections.some((x) => x.connector === k.name),
            })),
          kit: w.some((m) => m.kit),
        }),
      () => setView(null),
    )
  }, [])
  const TRIES = [
    'Track something for me',
    'Read the files in a folder',
    'Watch a website’s listings',
    'Who emailed me this week?',
  ]
  const setup = [
    ...(view?.steps ?? []).map((s) => ({
      done: s.done,
      words: s.words,
      sub: s.sub,
      href: `#/settings?connect=${s.name}`,
    })),
    {
      done: view?.kit,
      words: 'Install a module',
      sub: 'A module made for your work, like a deal tracker or a client report',
      href: '#/settings/modules',
    },
  ]
  return (
    <div className="flex max-w-stream flex-col gap-4.5">
      <p className="text-ink-2">
        What should Alpha keep for you? Say it in a sentence above. Alpha makes the tables, reads
        what you point it at, and asks before anything leaves your Mac.
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Label className="mr-1">Or start with</Label>
        {TRIES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTry(t)}
            className="h-7 rounded-full border border-line bg-surface px-2.75 text-ink-2 text-sm transition-colors hover:border-accent-line hover:text-accent"
          >
            {t}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {setup.map((s) => (
          <a
            key={s.words}
            href={s.href}
            className="flex items-center gap-3 border-hair border-t px-4 py-3 first:border-t-0 hover:bg-hover"
          >
            <span
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-full border',
                s.done ? 'border-good bg-good text-surface' : 'border-line',
              )}
            >
              {s.done && <Check className="size-3" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink">{s.words}</span>
              <span className="block text-ink-3 text-sm">{s.sub}</span>
            </span>
            <ChevronRight className="size-4 text-ink-3" />
          </a>
        ))}
      </div>
    </div>
  )
}

// A tile of Today: a count of tasks, opening their list. Overdue turns red only when it has some.
function TaskTile({
  label,
  n,
  list,
  bad,
}: {
  label: string
  n: number
  list: string
  bad?: boolean
}) {
  return (
    <a
      href={`#/tasks?list=${list}`}
      className={cn(
        'flex flex-col gap-0.5 rounded-lg border px-3.5 py-2.5 hover:bg-hover',
        bad && n > 0 ? 'border-bad/40 bg-bad-soft' : 'border-line bg-surface',
      )}
    >
      <span className={cn('text-sm', bad && n > 0 ? 'text-bad' : 'text-ink-3')}>{label}</span>
      <span
        className={cn('font-serif text-2xl tabular-nums', bad && n > 0 ? 'text-bad' : 'text-ink')}
      >
        {n}
      </span>
    </a>
  )
}
