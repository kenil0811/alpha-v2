// Home (Kenil, 20 Oct: "Home should be about all important things, the space in home is very
// precious"): no conversation here, Alpha is on the right. Find on top, one strip across every
// module, then what needs the person (cards answered right here) and what changed since they last
// looked (kept until they clear it); the modules are in the rail, not here (Kenil, 26 Oct). Beside
// it the standard column of an Overview, across every module (Vikas, 30 Oct).

import type {
  AgentView,
  CardView,
  ConnectorsView,
  FootprintView,
  ModuleSummary,
  ModuleView,
  SetupView,
  Stream,
  TasksView,
  TodayView,
  WorkingModuleView,
} from '@alpha/core/api'
import { Bot, Check, ChevronRight, LoaderCircle, MessageCircleQuestion } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { Arranged, type Block } from './arrange.tsx'
import { interviewMe, useInterview } from './ask.ts'
import { GovernanceSection } from './Governance.tsx'
import {
  Agents,
  Files,
  isQuestion,
  Strip,
  signalOf,
  Tables,
  type Tile,
  Working,
} from './Overview.tsx'
import { peek } from './Peek.tsx'
import { SetupList, unready, useSetup } from './SetupPanel.tsx'
import { InBar } from './Shell.tsx'
import { TaskList } from './Tasks.tsx'
import { clock, dueWords, sinceWords } from './time.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Cut } from './ui/cut.tsx'
import { type Signal, strongest } from './ui/dot.tsx'
import { FindBar } from './ui/find-bar.tsx'
import { Group, Line } from './ui/groups.tsx'
import { Label } from './ui/pill.tsx'
import { Approvals, needsCount } from './Waiting.tsx'

// Home's tasks come in three cuts of the Tasks lists: today and overdue, this week, and what
// waits on someone else (a client's "My work" filters, 29 Oct)
type TaskCut = 'today' | 'week' | 'waiting'
const CUTS: [TaskCut, string, string][] = [
  ['today', 'Today', 'Today and overdue'],
  ['week', 'This week', 'This week'],
  ['waiting', 'Waiting', 'Waiting'],
]

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

// How many of the Mac's steps are done: Claude, the two readers, Chrome and each connection.
const readyCount = (v: SetupView) =>
  [
    v.claude.signedIn,
    v.readers.browser === 'ready',
    v.readers.documents === 'ready',
    v.chrome,
    ...v.steps.map((x) => x.done),
  ].filter(Boolean).length

// no name: it is in the workspace's corner already (Vikas, 1 Nov)
function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function Home({
  stream,
  modules,
  onAsked,
}: {
  stream: Stream | null
  modules: ModuleSummary[]
  name?: string // ponytail: unused since 1 Nov; App.tsx can stop passing it
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
  const [agents, setAgents] = useState<AgentView[]>([])
  const [cut, setCut] = useState<TaskCut>('today')
  const [cutView, setCutView] = useState<TasksView | null>(null)
  // this week's tasks, for Next in the bar when nothing is due today
  const [week, setWeek] = useState<TasksView['lines']>([])
  const interview = useInterview(null)
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
    api.get<TasksView>('/api/tasks?list=week').then(
      (t) => setWeek(t.lines),
      () => setWeek([]),
    )
    api.get<WorkingModuleView[]>('/api/working').then(
      (w) => setAgents(w.flatMap((m) => m.agents)),
      () => setAgents([]),
    )
  }, [])
  // on opening, and at each new journal line, Home looks again
  useEffect(() => {
    void last
    load()
  }, [load, last])
  // the standard column across every module: each module's files and notes, and every rule
  // ponytail: one request a module; a workspace endpoint when a person keeps dozens
  const [views, setViews] = useState<ModuleView[]>([])
  useEffect(() => {
    void last
    Promise.all(modules.map((m) => api.get<ModuleView>(`/api/modules/${m.id}`))).then(
      setViews,
      () => setViews([]),
    )
  }, [modules, last])
  const unique = <T,>(xs: T[], key: (x: T) => string) => [
    ...new Map(xs.map((x) => [key(x), x])).values(),
  ]
  const workspace: ModuleView = {
    id: '',
    name: 'Workspace',
    people: false,
    kit: null,
    sites: 0,
    parent: null,
    pages: [],
    modules: [],
    agents,
    notes: views.map((v) => v.notes).join('\n'),
    tables: unique(
      views.flatMap((v) => v.tables),
      (t) => t.id,
    ),
    files: unique(
      views.flatMap((v) => v.files),
      (f) => `${f.hash}${f.row.id}`,
    ),
  }

  useEffect(() => {
    void last
    if (cut === 'today') setCutView(null)
    else api.get<TasksView>(`/api/tasks?list=${cut}`).then(setCutView, () => setCut('today'))
  }, [cut, last])
  const shown = cut === 'today' ? tasks : cutView
  // a cut with nothing in it is not offered; one cut alone is not a choice
  const cuts = CUTS.filter(([k]) => k === cut || (tasks?.counts[k] ?? 0) > 0)

  const cards = stream?.cards ?? []
  const signIns = stream?.attention ?? []
  const changed = today?.changed ?? []
  // the next event, at the bar's right: an event of the calendar once the core keeps them, until
  // then the soonest open task with a due day that is not past (Vikas, 1 Nov)
  const next = [...(tasks?.lines ?? []), ...week]
    .filter((t) => t.due && !t.overdue && t.state !== 'done' && t.state !== 'dropped')
    .sort((x, y) => (x.due ?? '').localeCompare(y.due ?? ''))[0]
  // a card that waits is never hidden behind the welcome
  const firstOpen =
    stream !== null &&
    modules.length === 0 &&
    stream.lines.length === 0 &&
    cards.length + signIns.length === 0

  // agent approvals, one compact card a page; not tasks (Vikas, 1 Nov)
  const needs: Block['node'] = (
    <Approvals
      id="home-needs"
      cards={cards}
      signIns={signIns}
      moduleName={(id) => modules.find((m) => m.id === id)?.name}
      onChange={load}
    />
  )
  const todayTasks: Block['node'] = (
    <Group
      id="home-tasks"
      title={CUTS.find(([k]) => k === cut)?.[2] ?? 'Today and overdue'}
      count={shown?.lines.length}
      action={
        <a
          href={`#/tasks?list=${cut}`}
          className="text-ink-3 text-xs underline underline-offset-3 hover:text-ink"
        >
          All tasks
        </a>
      }
    >
      {cuts.length > 1 && (
        <div className="flex flex-wrap gap-1.5 whitespace-nowrap">
          {cuts.map(([k, label]) => (
            <Cut
              key={k}
              sel={k === cut}
              count={tasks?.counts[k] || undefined}
              onClick={() => setCut(k)}
            >
              {label}
            </Cut>
          ))}
        </div>
      )}
      {failed.tasks && <NotLoaded onTry={load} />}
      {shown && shown.lines.length > 0 && (
        <TaskList lines={shown.lines.slice(0, 8)} cards={cards} onChange={load} />
      )}
    </Group>
  )
  const whatChanged: Block['node'] = (
    <Group
      id="home-changed"
      title="What changed"
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
        <a className="text-accent text-sm underline underline-offset-3" href="#/activity">
          {changed.length - 10} more in Activity
        </a>
      )}
    </Group>
  )

  // Interview me: a button at the head of the standard column, above Files (Vikas, 30 Oct)
  const start: Block['node'] = (
    <Button
      className="h-10 w-full min-w-0 justify-start text-left"
      onClick={() => interviewMe(null)}
      data-tip={interview.tip}
    >
      {interview.busy ? (
        <LoaderCircle className="size-4 shrink-0 animate-spin" />
      ) : (
        <MessageCircleQuestion className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1">Interview me</span>
    </Button>
  )
  // Getting this Mac ready: a card of its own in the work column, done once and gone when it is
  // (Vikas, 1 Nov: "it's one time thing")
  const mac: Block[] =
    setup && unready(setup)
      ? [
          {
            key: 'mac',
            name: 'Mac setup',
            node: (
              <Group
                id="home-mac"
                title="Mac setup"
                sub={`${readyCount(setup)} of ${4 + setup.steps.length} done`}
              >
                <SetupList view={setup} onChange={reloadSetup} />
              </Group>
            ),
          },
        ]
      : []
  // the standard column, across every module, in an Overview's order
  const standard: Block[] = [
    // the buttons on top, then Files, then Agents, Governance and Tables as one card; no Second
    // Brain here (Vikas, 3 Nov)
    { key: 'start', name: 'Interview me', node: start },
    {
      key: 'files',
      name: 'Files',
      node: <Files m={workspace} onChange={load} href="#/intelligence/brain" />,
    },
    {
      key: 'working',
      name: 'Agents, governance and tables',
      node: (
        <Working
          parts={{
            agents: (head) => (
              <Agents
                m={workspace}
                main={[]}
                onChange={load}
                href="#/intelligence/agents"
                byFunction
                onNew={() => (window.location.hash = '#/agent/new')}
                head={head}
              />
            ),
            governance: (head) => (
              <div
                id="ov-governance"
                className="rounded-lg border border-line bg-surface px-3 py-3"
              >
                <GovernanceSection title={head} version={last ?? 0} small />
              </div>
            ),
            tables: (head) => <Tables ms={modules} href="#/intelligence/brain" head={head} />,
          }}
        />
      ),
    },
  ]

  return (
    // every link on Home opens in the side panel first (Peek.tsx; Vikas, 28 Oct)
    <div data-peek-all className="@container h-full overflow-y-auto">
      <div className="mx-auto flex max-w-page flex-col gap-7 px-8 pt-8 pb-12">
        {/* the greeting and the day sit in the bar; Home opens on Find and one strip across every
            module (Vikas, 27 Oct): the assistant is on the right, so no box to ask here */}
        {/* two lines a side (Vikas, 1 Nov): the day over the greeting at the left, Next and its
            day over the next thing at the right */}
        <InBar>
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex flex-col whitespace-nowrap leading-tight">
              <span className="text-ink-3 text-xs">
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <h1 className="font-serif text-ink text-lg leading-tight">{greeting()}</h1>
            </span>
            {next && (
              <a
                href={`#/tasks/${next.id}`}
                className="ml-auto flex min-w-0 max-w-80 flex-col items-end leading-tight hover:text-accent"
              >
                <span className="text-ink-3 text-xs">
                  Next{next.due ? ` · ${dueWords(next.due)}` : ''}
                </span>
                <span className="max-w-full truncate text-ink text-md">{next.title}</span>
              </a>
            )}
          </span>
        </InBar>
        <FindBar />

        <Strip
          tiles={homeTiles({ cards, signIns: signIns.length, agents, tasks, changed })}
          onGo={(go) => {
            if (go === 'tasks') peek('#/tasks?list=today')
            else if (go === 'agents') peek('#/intelligence/agents')
            else
              document
                .getElementById(`home-${go}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />

        {stream?.settingUp && (
          <p className="flex items-center gap-2 text-ink-2 text-md">
            <LoaderCircle className="size-3.5 animate-spin text-ink-3" />
            Setting up {stream.settingUp}; Alpha works meanwhile, and they appear as they go in.
          </p>
        )}

        {firstOpen ? (
          <Welcome onTry={(w) => api.post('/api/say', { words: w }).then(onAsked)} />
        ) : (
          // what waits on the person, their day and what Alpha did, each a block the person
          // drags beside, above or below another (Vikas, 29 Oct); an empty one is not shown. The
          // standard column on the right, as on an Overview (Vikas, 30 Oct); the work column keeps
          // the page "home", so an arrangement kept before stays the person's
          <Arranged
            className="grid gap-8 @3xl:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]"
            blocks={[
              ...(cards.length + signIns.length > 0
                ? [{ key: 'needs', name: 'Agent approvals', node: needs }]
                : []),
              ...(failed.tasks || (tasks?.lines.length ?? 0) > 0 || cuts.length > 1
                ? [{ key: 'tasks', name: 'Today and overdue', node: todayTasks }]
                : []),
              ...(failed.today || changed.length > 0
                ? [{ key: 'changed', name: 'What changed', node: whatChanged }]
                : []),
              ...mac,
              ...standard,
            ]}
            columns={[
              // two cards a row: Agent approvals beside Today and overdue, What changed beside Mac
              // setup (Vikas, 1 Nov)
              {
                page: 'home',
                start: [
                  ['needs', 'tasks'],
                  ['changed', 'mac'],
                ],
              },
              { page: 'home:side', start: standard.map((b) => [b.key]) },
            ]}
          />
        )}
      </div>
    </div>
  )
}

// First open: a few ways to start, and three setup rows, none of which stands in the way.
function Welcome({ onTry }: { onTry: (words: string) => void }) {
  // the connectors that ask for a place here (their manifests), and the one that takes a folder
  const [view, setView] = useState<{
    steps: { name: string; words: string; sub: string; done: boolean }[]
    kit: boolean
    learned: boolean
  } | null>(null)
  useEffect(() => {
    Promise.all([
      api.get<ConnectorsView>('/api/connectors'),
      api.get<WorkingModuleView[]>('/api/working'),
      api.get<FootprintView>('/api/footprint').catch(() => null),
    ]).then(
      ([c, w, f]) =>
        setView({
          learned: !!f?.done,
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
    // the footprint first (Vikas, 30 Oct): Alpha reads what is ticked, then asks what is left
    {
      done: view?.learned,
      words: 'Let Alpha learn your business',
      sub: 'It reads only what you tick on this Mac, drafts your business for your yes, then asks what is left',
      href: '#/conversation/interviewer',
    },
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
            className="h-7 rounded-full border border-line bg-surface px-2.75 text-ink-2 text-sm transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent"
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

// Home's one strip, across every module (Vikas, 27 Oct): what waits on the person (Alpha's
// questions with it), the agents, today's tasks and what changed; never a strip per module.
function homeTiles({
  cards,
  signIns,
  agents,
  tasks,
  changed,
}: {
  cards: CardView[]
  signIns: number
  agents: AgentView[]
  tasks: TasksView | null
  changed: { id: string; name: string; words: string | null }[]
}): Tile[] {
  const questions = cards.filter(isQuestion)
  const on = agents.filter((a) => a.state === 'on')
  const needs = agents.filter((a) => a.needs)
  const due = (tasks?.counts.overdue ?? 0) + (tasks?.counts.today ?? 0)
  const all = needsCount(cards, signIns)
  // one place for what waits on the person: Agent approvals below lists it (Vikas, 1 Nov: was
  // Needs you), so its tile counts it and goes there; it never lists it again. Interview me is a
  // button at the head of the standard column, not a tile (Vikas, 30 Oct).
  return [
    {
      key: 'needs',
      label: 'Agent approvals',
      signal: signIns ? 'now' : (strongest(cards.map(signalOf)) ?? 'opt'),
      big: String(all),
      small: `${all === 1 ? 'approval' : 'approvals'} to answer${
        questions.length
          ? `, ${questions.length} ${questions.length === 1 ? 'question' : 'questions'}`
          : ''
      }`,
      lines: [],
      go: 'needs',
      act: all
        ? { label: 'Review', go: 'needs' }
        : { label: 'Done', off: true, tip: 'Nothing to answer now' },
    },
    {
      key: 'agents',
      label: 'Agents',
      signal: needs.length ? 'now' : on.length ? 'done' : 'opt',
      big: String(on.length),
      small: `of ${agents.length} agents active`,
      lines: [
        ...needs.slice(0, 3).map((a) => ({
          s: 'now' as const,
          words: `${a.name} needs ${a.needs}`,
          href: `#/agent/${a.id}`,
        })),
        ...agents
          .filter((a) => !a.needs)
          .slice(0, 4 - Math.min(needs.length, 3))
          .map((a) => ({
            s: (a.state === 'on' ? 'done' : 'opt') as Signal,
            words: a.name,
            href: `#/agent/${a.id}`,
          })),
      ],
      go: 'agents',
      act: needs[0]
        ? { label: 'Fix', href: `#/agent/${needs[0].id}` }
        : { label: 'Open', go: 'agents', tip: 'Open agents' },
    },
    {
      key: 'tasks',
      label: 'Tasks',
      signal: tasks?.counts.overdue ? 'now' : due ? 'yes' : 'opt',
      big: String(due),
      small: `${due === 1 ? 'task' : 'tasks'} due${tasks?.counts.overdue ? `, ${tasks.counts.overdue} overdue` : ' today'}`,
      lines: (tasks?.lines ?? []).slice(0, 4).map((t) => ({
        s: (t.overdue ? 'now' : 'yes') as Signal,
        words: t.title,
        href: `#/tasks/${t.id}`,
      })),
      go: 'tasks',
      act: due
        ? { label: 'Start', go: 'tasks' }
        : { label: 'Open', go: 'tasks', tip: 'Open tasks' },
    },
    {
      key: 'changed',
      label: 'What changed',
      signal: 'opt',
      big: String(changed.length),
      small: `${changed.length === 1 ? 'thing' : 'things'} changed`,
      lines: changed.slice(0, 20).map((r) => ({
        s: 'opt' as const,
        words: r.words ?? r.name,
        href: `#/run/${r.id}`,
      })),
      go: 'changed',
      act: changed.length
        ? { label: 'Review', go: 'changed', tip: 'What changed' }
        : { label: 'Review', off: true, tip: 'Nothing changed since you last looked' },
    },
  ]
}
