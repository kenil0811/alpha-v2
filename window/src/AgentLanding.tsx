// An agent's Chat as it lands, like Home (Vikas, 23 Nov): a bar that starts a new chat with it (a
// thread of its own), its numbers that are not nought as squares in one row, then its cards on
// Home's grid: what of it waits for the person, its chats, its last lines; nothing empty is drawn.
// Its whole conversation so far is one click away (#/conversation/chat).
import type { AgentDetail, AgentOverview, AgentView, Stream } from '@alpha/core/api'
import { ArrowUp, History, Inbox, MessagesSquare } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { api, Problem } from './api.ts'
import { CardGrid, type GridCard } from './CardGrid.tsx'
import { when } from './Modules.tsx'
import { fromWhom, mainOf, NeedsYou } from './NeedsYou.tsx'
import { cn } from './ui/cn.ts'
import { FRAME } from './ui/frame.tsx'
import { Group } from './ui/groups.tsx'
import { Voice } from './ui/voice.tsx'

const of = (n: number, all: number) => (all ? `${n} of ${all}` : '')

export function AgentLanding({
  agent,
  agents,
  stream,
  version,
}: {
  agent: AgentView
  agents: AgentView[]
  stream: Stream | null
  version: number
}) {
  const [o, setO] = useState<AgentOverview | null>(null)
  const [detail, setDetail] = useState<AgentDetail | null>(null)
  useEffect(() => {
    if (version < 0) return
    api.get<AgentOverview>(`/api/agents/${agent.id}/overview`).then(setO, () => setO(null))
    api.get<AgentDetail>(`/api/agents/${agent.id}`).then(setDetail, () => setDetail(null))
  }, [agent.id, version])
  const mine = (stream?.cards ?? []).filter((c) => c.agent === agent.id)
  const chats = detail?.tasks ?? []
  const stats = (
    [
      [String(mine.length), 'Waiting for you'],
      [String(o?.tasks.open ?? 0), 'Tasks open'],
      [String(o?.tasks.done ?? 0), 'Tasks done'],
      [o ? of(o.cards.yes, o.cards.yes + o.cards.no) : '', 'Cards you said yes to'],
      [o ? of(o.runs.ok, o.runs.ok + o.runs.failed) : '', 'Runs that went well'],
    ] as const
  ).filter(([v]) => v && v !== '0')

  const grid: GridCard[] = []
  if (mine.length)
    grid.push({
      key: 'agent:needs',
      width: '1/2',
      main: mainOf(fromWhom(mine, [], agents)),
      small: { icon: <Inbox className="size-4" />, value: String(mine.length), label: 'Needs you' },
      node: (
        <NeedsYou
          from={fromWhom(mine, [], agents)}
          onChange={(c) => {
            window.location.hash = `#/card/${c.id}`
          }}
        />
      ),
    })
  if (chats.length)
    grid.push({
      key: 'agent:chats',
      width: '1/4',
      small: {
        icon: <MessagesSquare className="size-4" />,
        value: String(chats.length),
        label: 'Chats',
      },
      node: (
        <Group title="Chats">
          <ul className="flex flex-col gap-1.5 text-md">
            {chats.map((t) => (
              <li key={t.id}>
                <a href={`#/work/${t.id}`} className="flex justify-between gap-3 hover:text-accent">
                  <span className="truncate text-ink">{t.title}</span>
                  <span className="shrink-0 text-ink-3 text-sm">{t.state}</span>
                </a>
              </li>
            ))}
          </ul>
        </Group>
      ),
    })
  if (o?.recent.length)
    grid.push({
      key: 'agent:lately',
      width: '1/4',
      small: {
        icon: <History className="size-4" />,
        value: String(o.recent.length),
        label: 'Lately',
      },
      node: (
        <Group title="Lately">
          <ul className="flex flex-col gap-1.5 text-md">
            {o.recent.map((r) => (
              <li key={`${r.at}${r.words}`} className="flex gap-3">
                <span className="min-w-0 flex-1 truncate text-ink">{r.words}</span>
                <span className="shrink-0 text-ink-3 text-xs">{when(r.at)}</span>
              </li>
            ))}
          </ul>
        </Group>
      ),
    })

  return (
    <div className="@container h-full overflow-y-auto">
      <div className="mx-auto flex max-w-page flex-col gap-6 px-8 pt-7 pb-12">
        <NewChat agent={agent} />
        {stats.length > 0 && (
          <div className="flex gap-3 overflow-x-auto">
            {stats.map(([v, label]) => (
              <div
                key={label}
                className={cn(
                  FRAME,
                  'flex aspect-square w-24 shrink-0 flex-col items-center justify-center gap-1 p-2 text-center',
                )}
              >
                <span className="font-semibold text-ink text-xl tabular-nums">{v}</span>
                <span className="text-ink-3 text-xs leading-tight">{label}</span>
              </div>
            ))}
          </div>
        )}
        <CardGrid cards={grid} />
      </div>
    </div>
  )
}

// The bar: what is typed starts a new chat with this agent, a task it owns, which opens at once.
function NewChat({ agent }: { agent: AgentView }) {
  const [words, setWords] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const send = async (e: FormEvent) => {
    e.preventDefault()
    const w = words.trim()
    if (!w || busy) return
    setBusy(true)
    setProblem(null)
    try {
      const t = await api.post<{ id: string }>('/api/tasks', {
        title: w.split('\n')[0]?.slice(0, 80),
        notes: w,
        owner: { kind: 'alpha', id: agent.id },
      })
      window.location.hash = `#/work/${t.id}`
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not start.')
      setBusy(false)
    }
  }
  return (
    <form onSubmit={send} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pr-1.5 pl-4 shadow-pop focus-within:border-accent-line focus-within:ring-3 focus-within:ring-accent-soft">
          <input
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder={`Start a new chat with ${agent.name}`}
            aria-label={`Start a new chat with ${agent.name}`}
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
        <a
          href="#/conversation/chat"
          className="shrink-0 text-ink-3 text-sm underline underline-offset-3 hover:text-ink"
        >
          Whole conversation
        </a>
      </div>
      {problem && <div className="text-bad text-sm">{problem}</div>}
    </form>
  )
}
