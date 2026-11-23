// Home: the date, the greeting, the ask box, what needs the person while something waits (cards
// answered right here), and today's tasks. The modules are in the rail; the conversation has its
// own place in the rail and on the right of every screen.
import type { AgentView, CardView, Stream, TasksView } from '@alpha/core/api'
import { ArrowUp, CheckCheck, Inbox, KeyRound, ListChecks, LoaderCircle } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { api, Problem } from './api.ts'
import { CardBox } from './CardBox.tsx'
import { CardGrid, type GridCard } from './CardGrid.tsx'
import { shownScreens } from './plugin/screens.ts'
import { signInWith } from './SignInApps.tsx'
import { StoryRow } from './story/StoryRow.tsx'
import { TaskList } from './Tasks.tsx'
import { Button } from './ui/button.tsx'
import { Group, Line } from './ui/groups.tsx'
import { Segmented } from './ui/segmented.tsx'

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

// The agents the waiting cards come from, each with how many, in the team's order; a sign-in,
// which no agent raised, shows under All only.
function byAgent(cards: CardView[], agents: AgentView[]) {
  return agents.flatMap((a) => {
    const count = cards.filter((c) => c.agent === a.id).length
    return count ? [{ id: a.id, name: a.name, count }] : []
  })
}

function greeting(name: string): string {
  const h = new Date().getHours()
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return name ? `${part}, ${name}` : part
}

export function Home({
  stream,
  name,
  agents,
  onAsked,
}: {
  stream: Stream | null
  name: string
  agents: AgentView[] // for Needs you's filter by agent
  onAsked: () => void // the answer opens on the right
}) {
  const [tasks, setTasks] = useState<TasksView | null>(null)
  const [finished, setFinished] = useState<TasksView | null>(null)
  // a load that failed is said, with Try again, never shown as a quiet day
  const [failed, setFailed] = useState(false)
  const [words, setWords] = useState('')
  const ask = useRef<HTMLInputElement>(null)
  const last = stream?.lastId
  const load = useCallback(() => {
    api.get<TasksView>('/api/tasks?list=finished').then(setFinished, () => undefined)
    api.get<TasksView>('/api/tasks?list=today').then(
      (t) => {
        setTasks(t)
        setFailed(false)
      },
      () => setFailed(true),
    )
  }, [])
  // on opening, and at each new journal line, Home looks again
  useEffect(() => {
    void last
    load()
  }, [load, last])

  const [from, setFrom] = useState('all') // Needs you's cards from one agent, or all
  const all = stream?.cards ?? []
  const by = byAgent(all, agents)
  const one = by.length > 1 && by.some((a) => a.id === from) ? from : 'all'
  const cards = one === 'all' ? all : all.filter((c) => c.agent === one)
  const signIns = one === 'all' ? (stream?.attention ?? []) : []
  const waiting = all.length + (stream?.attention ?? []).length
  const changeCard = (card: CardView) => {
    setWords(`About “${card.words.replace(/\?$/, '')}”: `)
    ask.current?.focus()
  }

  // a card shows only when it has something: no empty frames (Vikas, 23 Nov)
  const grid: GridCard[] = []
  if (waiting > 0)
    grid.push({
      key: 'needs',
      width: '1/2', // wide enough that a question stays within two lines (Vikas, 23 Nov)
      small: { icon: <Inbox className="size-4" />, value: String(waiting), label: 'Needs you' },
      node: (
        <Group title="Needs you" count={waiting}>
          {by.length > 1 && (
            <div>
              <Segmented
                label="From"
                value={one}
                onChange={setFrom}
                options={[
                  { value: 'all', label: `All ${waiting}` },
                  ...by.map((a) => ({ value: a.id, label: `${a.name} ${a.count}` })),
                ]}
              />
            </div>
          )}
          {cards.map((c) => (
            <CardBox key={c.id} id={c.id} card={c} onChange={changeCard} />
          ))}
          {signIns.map((a) => (
            <Line
              key={a.connector}
              icon={<KeyRound className="size-3.5 text-warn" />}
              head={a.waiting ? 'Waiting on your side' : 'Sign-in'}
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
                ? { href: '#/settings/connections' }
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
                    : { href: `#/settings/connections?connect=${a.connector}` })}
            />
          ))}
        </Group>
      ),
    })
  if (failed || (tasks?.lines.length ?? 0) > 0)
    grid.push({
      key: 'tasks',
      width: '1/4',
      small: {
        icon: <ListChecks className="size-4" />,
        value: String(tasks?.lines.length ?? 0),
        label: "Today's tasks",
      },
      node: (
        <Group
          title="Today's tasks"
          action={
            <a
              className="text-ink-3 text-xs underline underline-offset-3 hover:text-ink"
              href="#/tasks"
            >
              All tasks
            </a>
          }
        >
          {failed && <NotLoaded onTry={load} />}
          {tasks && tasks.lines.length > 0 && <TaskList lines={tasks.lines} onChange={load} />}
        </Group>
      ),
    })
  if (finished?.lines.length)
    grid.push({
      key: 'finished',
      width: '1/4',
      small: {
        icon: <CheckCheck className="size-4" />,
        value: String(finished.lines.length),
        label: 'Recently completed',
      },
      node: (
        <Group
          title="Recently completed tasks"
          action={
            <button
              type="button"
              className="text-ink-3 text-xs underline underline-offset-3 hover:text-ink"
              onClick={() => void api.post('/api/tasks/clear-completed').then(load)}
            >
              Clear
            </button>
          }
        >
          <TaskList lines={finished.lines} onChange={load} />
        </Group>
      ),
    })

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
          </div>
          <AskBox area={ask} words={words} setWords={setWords} onAsked={onAsked} />
        </div>

        {stream?.settingUp && (
          <p className="flex items-center gap-2 text-ink-2 text-md">
            <LoaderCircle className="size-3.5 animate-spin text-ink-3" />
            Setting up {stream.settingUp}
          </p>
        )}

        {/* Set up Alpha, until the person finishes it or declines */}
        <StoryRow version={last} />

        {/* a plugin's row, while something of its waits for the person */}
        {shownScreens().map((s) => s.Waiting && <s.Waiting key={s.name} />)}

        <CardGrid cards={grid} />
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
