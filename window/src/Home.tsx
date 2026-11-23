// Home: the ask box, then its cards: Needs you while something waits (each answered right here),
// Set up Alpha until it is done, today's tasks and the ones just completed, each card only while it
// has something (Vikas, 23 Nov). The date and the greeting are in the bar (HomeHead). The modules
// are in the rail; the conversation has its own place on the right of every screen.
import type { AgentView, CardView, Stream, TasksView } from '@alpha/core/api'
import { ArrowUp, CheckCheck, Inbox, ListChecks, LoaderCircle, Sparkles } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { api, Problem } from './api.ts'
import { CardGrid, type GridCard } from './CardGrid.tsx'
import { fromWhom, mainOf, NeedsYou } from './NeedsYou.tsx'
import { shownScreens } from './plugin/screens.ts'
import { ReadLine } from './ReadReport.tsx'
import { StoryCard, stepsDone, useStory } from './story/StoryCard.tsx'
import { TaskList } from './Tasks.tsx'
import { Button } from './ui/button.tsx'
import { Group } from './ui/groups.tsx'
import { Voice } from './ui/voice.tsx'

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

// The date, and the greeting under it, at the left of Home's bar (Vikas, 22 Nov).
export function HomeHead({ name }: { name: string }) {
  const day = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return (
    <div className="flex min-w-0 flex-col leading-tight">
      <span className="truncate text-ink-3 text-xs">{day}</span>
      <h1 className="truncate font-serif text-ink text-lg">{greeting(name)}</h1>
    </div>
  )
}

function greeting(name: string): string {
  const h = new Date().getHours()
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return name ? `${part}, ${name}` : part
}

export function Home({
  stream,
  agents,
  onAsked,
}: {
  stream: Stream | null
  agents: AgentView[] // Needs you's faces
  onAsked: () => void // the answer opens on the right
}) {
  const [tasks, setTasks] = useState<TasksView | null>(null)
  const [finished, setFinished] = useState<TasksView | null>(null)
  // a load that failed is said, with Try again, never shown as a quiet day
  const [failed, setFailed] = useState(false)
  const [words, setWords] = useState('')
  const ask = useRef<HTMLInputElement>(null)
  const last = stream?.lastId
  const [story, setStory] = useStory(last)
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

  const from = fromWhom(stream?.cards ?? [], stream?.attention ?? [], agents)
  const waiting = (stream?.cards.length ?? 0) + (stream?.attention.length ?? 0)
  const changeCard = (card: CardView) => {
    setWords(`About “${card.words.replace(/\?$/, '')}”: `)
    ask.current?.focus()
  }

  // a card shows only when it has something: no empty frames (Vikas, 23 Nov)
  const grid: GridCard[] = []
  if (waiting > 0)
    grid.push({
      key: 'needs',
      width: '1/2', // a sign-in alone
      main: mainOf(from),
      small: { icon: <Inbox className="size-4" />, value: String(waiting), label: 'Needs you' },
      node: <NeedsYou from={from} onChange={changeCard} />,
    })
  // Set up Alpha, until the person finishes it or declines
  if (story?.row)
    grid.push({
      key: 'set-up',
      width: '1/4',
      small: {
        icon: <Sparkles className="size-4 text-accent" />,
        value: `${stepsDone(story)}/${story.chapters.length}`,
        label: 'Set up Alpha',
      },
      node: <StoryCard story={story} onChange={setStory} />,
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
      <div className="mx-auto flex max-w-page flex-col gap-7 px-8 pt-7 pb-12">
        <AskBox area={ask} words={words} setWords={setWords} onAsked={onAsked} />

        {stream?.settingUp && (
          <p className="flex items-center gap-2 text-ink-2 text-md">
            <LoaderCircle className="size-3.5 animate-spin text-ink-3" />
            Setting up {stream.settingUp}
          </p>
        )}

        {/* see what Alpha read: the live line while a read runs (proposed, 23 Nov) */}
        {!!stream?.reading.length && <ReadLine version={last} />}

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
          data-composer
          ref={area}
          value={words}
          onChange={(e) => setWords(e.target.value)}
          placeholder="Ask Alpha, or tell it what to keep"
          aria-label="Ask Alpha"
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />
        <Voice value={words} onChange={setWords} />
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
