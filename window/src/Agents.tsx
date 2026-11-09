// The firm's agents (clean base step 7): Intelligence › Agents lists them with the Chief of staff
// first, and an agent's page shows what it is, its memories and its skills. An agent is made and
// changed in a conversation with the Chief of staff, so nothing here is a form to fill in.
import type { AgentDetail, AgentView, MemoryView } from '@alpha/core/api'
import { Bot, MessageSquare, Plus, Trash2, X } from 'lucide-react'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { useLayout } from './layout.ts'
import { Record } from './Record.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button, IconButton } from './ui/button.tsx'
import { Confirm } from './ui/dialog.tsx'
import { Field } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { MenuItem, Popover } from './ui/popover.tsx'
import { Empty, Section } from './ui/section.tsx'
import { Words } from './ui/words.tsx'

export const CHIEF = 'chief'

export function useAgents(version: number): AgentView[] {
  const [agents, setAgents] = useState<AgentView[]>([])
  useEffect(() => {
    if (version >= 0) api.get<AgentView[]>('/api/agents').then(setAgents, () => undefined)
  }, [version])
  return agents
}

export function AgentsSection({ version }: { version: number }) {
  const agents = useAgents(version)
  return (
    <Section title="Agents" about="Each one has its own job, memory and conversation.">
      <List>
        {agents.map((a) => (
          <Row
            key={a.id}
            className="relative hover:bg-canvas"
            lead={
              <Tile>
                <Bot className="size-4" />
              </Tile>
            }
            title={
              <a href={`#/agent/${a.id}`} className="after:absolute after:inset-0">
                {a.name}
              </a>
            }
            sub={`${a.title} · ${a.description}`}
            actions={a.model && <span className="text-ink-3 text-sm">{a.model}</span>}
          />
        ))}
      </List>
      {agents.length <= 1 && (
        <Empty>
          Ask the Chief of staff to make an agent: say what it should do and when to use it.
        </Empty>
      )}
    </Section>
  )
}

// The agents down the left of the conversation, the Chief of staff first.
export function AgentRail({
  agents,
  chosen,
  onPick,
}: {
  agents: AgentView[]
  chosen: string
  onPick: (id: string) => void
}) {
  return (
    <nav
      aria-label="Agents"
      className="flex w-56 shrink-0 flex-col gap-0.5 border-hair border-r p-2.5"
    >
      {agents.map((a) => (
        <button
          key={a.id}
          type="button"
          aria-current={a.id === chosen}
          onClick={() => onPick(a.id)}
          className={
            a.id === chosen
              ? 'flex flex-col rounded-md bg-accent-soft px-2.5 py-1.75 text-left'
              : 'flex flex-col rounded-md px-2.5 py-1.75 text-left hover:bg-hover'
          }
        >
          <span className="truncate font-medium text-ink text-md">{a.name}</span>
          <span className="truncate text-ink-3 text-sm">{a.title}</span>
        </button>
      ))}
    </nav>
  )
}

// The chosen agent's name in the head of the assistant, opening the list of agents.
export function AgentPicker({
  agents,
  chosen,
  onPick,
}: {
  agents: AgentView[]
  chosen: string
  onPick: (id: string) => void
}) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const name = agents.find((a) => a.id === chosen)?.name ?? 'Chief of staff'
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md px-1.5 py-0.5 font-medium text-ink hover:bg-hover"
      >
        {name}
      </button>
      <Popover
        anchor={anchor as RefObject<HTMLElement | null>}
        open={open}
        onClose={() => setOpen(false)}
      >
        {agents.map((a) => (
          <MenuItem
            key={a.id}
            onClick={() => {
              setOpen(false)
              onPick(a.id)
            }}
          >
            {a.name}
          </MenuItem>
        ))}
      </Popover>
    </>
  )
}

export function AgentPage({
  id,
  version,
  onName,
}: {
  id: string
  version: number
  onName: (name: string) => void
}) {
  const [a, setA] = useState<AgentDetail | null | undefined>(undefined)
  const gone = useRef(false) // deleted just now: nothing left to load
  const load = useCallback(() => {
    if (gone.current) return
    api.get<AgentDetail>(`/api/agents/${id}`).then(
      (d) => {
        setA(d)
        onName(d.name)
      },
      () => setA(null),
    )
  }, [id, onName])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const { change } = useLayout()
  const [asking, setAsking] = useState(false)
  const { busy, problem, act } = useAct(load)
  if (a === undefined) return <p className="p-6 text-ink-3">Loading…</p>
  if (a === null) return <p className="p-6 text-ink-2">This agent is not there any more.</p>
  return (
    <Record kind={a.chief ? 'Runs the team' : `Agent · ${a.title}`}>
      <h1 className="font-serif text-2xl text-ink">{a.name}</h1>
      <p className="text-ink-2 text-md">{a.description}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => {
            change({ agent: a.id })
            window.location.hash = '#/conversation'
          }}
        >
          <MessageSquare className="size-3.5" />
          Open conversation
        </Button>
        {a.model && <Pill>{a.model}</Pill>}
        {!a.chief && (
          <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        )}
        <Refusal words={problem} />
      </div>
      {!a.chief && (
        <section className="flex flex-col gap-1.5">
          <h2 className="font-medium font-serif text-ink text-xl">Instructions</h2>
          <p className="text-ink-3 text-sm">Ask the Chief of staff or this agent to change them.</p>
          <div className="text-md">
            <Words text={a.instructions || 'None yet.'} />
          </div>
        </section>
      )}
      <Memories id={a.id} memories={a.memories} onChange={load} />
      {a.skills.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h2 className="font-medium font-serif text-ink text-xl">Skills</h2>
          <ul className="flex flex-col">
            {a.skills.map((s) => (
              <li key={s.name} className="border-hair border-t py-1.5 text-md first:border-t-0">
                <span className="text-ink">{s.name}</span>
                <span className="text-ink-3"> · {s.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {asking && (
        <Confirm
          open
          title={`Delete ${a.name}?`}
          yes="Delete it"
          busy={busy}
          onClose={() => setAsking(false)}
          onYes={() => {
            setAsking(false)
            act(async () => {
              await api.post(`/api/agents/${a.id}/remove`)
              gone.current = true
              window.location.hash = '#/intelligence/agents'
            })
          }}
        >
          Its memories and folder go with it. Its conversations stay in Activity.
        </Confirm>
      )}
    </Record>
  )
}

// Add on the heading, ✕ on a line when hovered, a double-click edits it in place (ui-rules R8).
function Memories({
  id,
  memories,
  onChange,
}: {
  id: string
  memories: MemoryView[]
  onChange: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [typed, setTyped] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const done = () => {
    setAdding(false)
    setEditing(null)
    setTyped('')
    setProblem(null)
    onChange()
  }
  const failed = (e: unknown) => setProblem(wordsOf(e))
  const add = () =>
    api.post(`/api/agents/${id}/memories`, { text: typed.trim() }).then(done, failed)
  const save = (m: MemoryView) =>
    api.post(`/api/memories/${m.id}`, { text: typed.trim() }).then(done, failed)
  const remove = (m: MemoryView) => api.post(`/api/memories/${m.id}/remove`).then(done, failed)
  const toggle = (m: MemoryView) =>
    api.post(`/api/memories/${m.id}`, { essential: !m.essential }).then(done, failed)
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <h2 className="font-medium font-serif text-ink text-xl">Memory</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setAdding(true)
            setTyped('')
          }}
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
      {adding && (
        <Field
          autoFocus
          value={typed}
          placeholder="One short fact"
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add()
            if (e.key === 'Escape') setAdding(false)
          }}
        />
      )}
      {problem && <p className="text-bad text-sm">{problem}</p>}
      {memories.length === 0 && !adding && <p className="text-ink-2 text-md">Nothing yet.</p>}
      <ul className="flex flex-col">
        {memories.map((m) => (
          <li
            key={m.id}
            className="group/line flex items-center gap-2 border-hair border-t py-1.5 text-md first:border-t-0"
          >
            {editing === m.id ? (
              <Field
                autoFocus
                className="flex-1"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void save(m)
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              // biome-ignore lint/a11y/noStaticElementInteractions: a double-click edits the line, as in every short list
              <span
                className="min-w-0 flex-1 text-ink"
                data-tip="Double-click to change it"
                onDoubleClick={() => {
                  setEditing(m.id)
                  setTyped(m.text)
                }}
              >
                {m.text}
              </span>
            )}
            {m.firm && <span className="text-ink-3 text-sm">Everyone</span>}
            <button
              type="button"
              onClick={() => void toggle(m)}
              data-tip={m.essential ? 'Always loaded' : 'Found by search'}
              className={m.essential ? 'text-accent text-sm' : 'text-ink-3 text-sm hover:text-ink'}
            >
              {m.essential ? 'Essential' : 'Make essential'}
            </button>
            <IconButton
              label="Delete it"
              className="opacity-0 group-hover/line:opacity-100"
              onClick={() => void remove(m)}
            >
              <X className="size-3.5" />
            </IconButton>
          </li>
        ))}
      </ul>
    </section>
  )
}
