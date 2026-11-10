// Home: the date, the greeting, the ask box, what needs the person while something waits (cards
// answered right here), and today's tasks. The modules are in the rail; the conversation has its
// own place in the rail and on the right of every screen.
import type { CardView, Stream, TasksView } from '@alpha/core/api'
import { ArrowUp, KeyRound, LoaderCircle } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { api, Problem } from './api.ts'
import { CardBox } from './CardBox.tsx'
import { SCREENS } from './plugin/screens.ts'
import { signInWith } from './SignInApps.tsx'
import { TaskList } from './Tasks.tsx'
import { Button } from './ui/button.tsx'
import { Group, Line, Quiet } from './ui/groups.tsx'

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
  name,
  onAsked,
}: {
  stream: Stream | null
  name: string
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

  const cards = stream?.cards ?? []
  const signIns = stream?.attention ?? []
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
          </div>
          <AskBox area={ask} words={words} setWords={setWords} onAsked={onAsked} />
        </div>

        {stream?.settingUp && (
          <p className="flex items-center gap-2 text-ink-2 text-md">
            <LoaderCircle className="size-3.5 animate-spin text-ink-3" />
            Setting up {stream.settingUp}; Alpha works meanwhile, and they appear as they go in.
          </p>
        )}

        {/* a plugin's row, while something of its waits for the person */}
        {SCREENS.map((s) => s.Waiting && <s.Waiting key={s.name} />)}

        {/* only while something waits */}
        {cards.length + signIns.length > 0 && (
          <Group title="Needs you" count={cards.length + signIns.length}>
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
                      : { href: `#/intelligence/connections?connect=${a.connector}` })}
              />
            ))}
          </Group>
        )}

        {finished && finished.lines.length > 0 && (
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
        )}

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
          {tasks && !failed && tasks.lines.length === 0 && (
            <Quiet>Nothing due today. Say a task, or add one in Tasks.</Quiet>
          )}
          {tasks && tasks.lines.length > 0 && <TaskList lines={tasks.lines} onChange={load} />}
        </Group>
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
