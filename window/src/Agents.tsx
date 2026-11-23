// The firm's agents: an agent's page shows what it is, its memories and its skills. An agent is
// made and changed in a conversation with the Chief of staff, so nothing here is a form to fill in.
import type { AgentDetail, AgentView, MemoryView, Stream, TimeSavedView } from '@alpha/core/api'
import { Bot, Check, MessageSquare, Plus, Trash2, X } from 'lucide-react'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { AgentSchedules } from './AgentSchedules.tsx'
import { api, wordsOf } from './api.ts'
import { useLayout } from './layout.ts'
import { shownScreens } from './plugin/screens.ts'
import { Record } from './Record.tsx'
import { MODEL_NAMES } from './Usage.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button, IconButton } from './ui/button.tsx'
import { fill } from './ui/chart.tsx'
import { Confirm } from './ui/dialog.tsx'
import { Field } from './ui/field.tsx'
import { Info } from './ui/info.tsx'
import { Pill } from './ui/pill.tsx'
import { MenuItem, Popover } from './ui/popover.tsx'
import { Roll } from './ui/roll.tsx'
import { Section } from './ui/section.tsx'
import { Voice } from './ui/voice.tsx'
import { Waiting } from './ui/waiting.tsx'
import { Words } from './ui/words.tsx'
import { YesNo } from './ui/yes-no.tsx'

export const CHIEF = 'chief'

// The agents in the order every list shows them: the Chief of staff, then Alpha's own, then each
// kit's by its name, then those made here.
export function useAgents(version: number): AgentView[] {
  const [agents, setAgents] = useState<AgentView[]>([])
  useEffect(() => {
    if (version >= 0)
      api.get<AgentView[]>('/api/agents').then(
        (all) => setAgents(inOrder(all)),
        () => undefined,
      )
  }, [version])
  return agents
}

const GROUP = { alpha: 0, kit: 1, here: 2 } as const
function inOrder(all: AgentView[]): AgentView[] {
  const rank = (a: AgentView) => (a.chief ? -1 : GROUP[a.from.kind])
  return [...all].sort(
    (a, b) => rank(a) - rank(b) || (a.from.name ?? '').localeCompare(b.from.name ?? ''),
  )
}

// The model an agent runs on, by its name: the owner changes it here.
export function ModelPicker({ agent }: { agent: Pick<AgentView, 'id' | 'model'> }) {
  const [choices, setChoices] = useState<{ models: string[]; canChange: boolean } | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    api
      .get<{ models: string[]; canChange: boolean }>('/api/models')
      .then(setChoices, () => undefined)
  }, [])
  const name = MODEL_NAMES[agent.model] ?? agent.model
  if (!choices?.canChange) return <span className="text-ink-3 text-sm">{name}</span>
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="menu"
        aria-label={`Model: ${name}`}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md px-1.5 py-0.5 text-ink-3 text-sm hover:bg-hover hover:text-ink"
      >
        {name}
      </button>
      <Popover
        anchor={anchor as RefObject<HTMLElement | null>}
        open={open}
        onClose={() => setOpen(false)}
      >
        {choices.models.map((m) => (
          <MenuItem
            key={m}
            onClick={() => {
              setOpen(false)
              void api.post(`/api/agents/${agent.id}/model`, { model: m })
            }}
          >
            {m === agent.model && <Check className="size-3.5 text-ink-3" />}
            {MODEL_NAMES[m] ?? m}
          </MenuItem>
        ))}
      </Popover>
    </>
  )
}

// The agents down the left of the conversation, the Chief of staff first.
export function AgentRail({
  agents,
  chosen,
  onPick,
  stream,
}: {
  agents: AgentView[]
  chosen: string
  onPick: (id: string) => void
  stream: Stream | null // the cards from each agent that wait on the person, and which failed
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
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-medium text-ink text-md">
              {a.name}
              {!a.chief && a.from.kind !== 'here' && (
                <span className="font-normal text-ink-3 text-sm"> · {a.from.name}</span>
              )}
            </span>
            <AgentMark id={a.id} stream={stream} />
          </span>
          <span className="truncate text-ink-3 text-sm">{a.title}</span>
        </button>
      ))}
    </nav>
  )
}

// An agent's one mark in the list (ui-rules A11): how many of its cards wait on the person, a plain
// number (Vikas, 23 Nov), else
// Failed when something of its failed since they last opened its chat; nothing otherwise.
function AgentMark({ id, stream }: { id: string; stream: Stream | null }) {
  const waiting = stream?.cards.filter((c) => c.agent === id).length ?? 0
  if (waiting)
    return (
      <Pill tone="warn">
        {waiting}
        <span className="sr-only"> waiting for you</span>
      </Pill>
    )
  if (stream?.failed.includes(id)) return <Pill tone="bad">Failed</Pill>
  return null
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
            <Bot className="size-3.5 text-ink-3" />
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
  inAgents = false,
}: {
  id: string
  version: number
  onName: (name: string) => void
  inAgents?: boolean // Agents › Setup: Chat is one click away, and a deleted agent stays there
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
  if (a === undefined) return <Waiting />
  if (a === null) return <p className="p-6 text-ink-2">This agent is not there any more.</p>
  return (
    <Record kind={a.chief ? 'Runs the team' : `Agent · ${a.title}`}>
      <h1 className="font-serif text-2xl text-ink">{a.name}</h1>
      {!a.chief && a.from.kind !== 'here' && (
        <p className="text-ink-3 text-sm">From {a.from.label}</p>
      )}
      <p className="text-ink-2 text-md">{a.description}</p>
      <div className="flex flex-wrap items-center gap-2">
        {!inAgents && (
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
        )}
        {/* a part of its own from the plugin whose kit carries this agent (ui-rules O3) */}
        {a.from.kind === 'kit' &&
          shownScreens().map((s) => s.agent?.name === a.name && <s.agent.Part key={s.name} />)}
        <ModelPicker agent={a} />
        {!a.chief && (
          <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        )}
        <Refusal words={problem} />
      </div>
      {a.timeSaved && <TimeSaved saved={a.timeSaved} />}
      {!a.chief && <Instructions id={a.id} text={a.instructions} />}
      <Memories id={a.id} memories={a.memories} onChange={load} />
      <AgentSchedules
        agent={a.id}
        schedules={a.schedules}
        onChange={load}
        from={a.chief || a.from.kind === 'here' ? null : a.from.name}
      />
      <Sites id={a.id} sites={a.sites} onChange={load} />
      {a.tasks.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h2 className="font-medium font-serif text-ink text-xl">Tasks</h2>
          {a.tasks.map((t) => (
            <a key={t.id} href={`#/tasks/${t.id}`} className="flex items-center gap-3 text-md">
              <span className="min-w-0 flex-1 truncate text-ink hover:underline">{t.title}</span>
              <span className="shrink-0 text-ink-3 text-sm">{t.state}</span>
            </a>
          ))}
        </section>
      )}
      {a.skills.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h2 className="flex items-center gap-1.5 font-medium font-serif text-ink text-xl">
            Skills
            {!a.chief && a.from.kind !== 'here' && (
              <Info help={`They change with ${a.from.name}.`} />
            )}
          </h2>
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
          done={{
            words: `${a.name} is deleted. Its conversations are in`,
            where: { label: 'Activity', href: '#/settings/activity' },
          }}
          onClose={() => setAsking(false)}
          onYes={() => {
            setAsking(false)
            return act(async () => {
              await api.post(`/api/agents/${a.id}/remove`)
              gone.current = true
              // on Agents the list goes back to the Chief of staff by itself
              if (!inAgents) window.location.hash = '#/conversation/setup'
            })
          }}
        >
          Its memory and files go with it. Its conversations stay in Activity.
        </Confirm>
      )}
    </Record>
  )
}

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const hm = (min: number) => {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

// What it saved this week, Monday to today, a small bar a day; none when it finished nothing.
function TimeSaved({ saved }: { saved: TimeSavedView }) {
  const top = Math.max(1, ...saved.days)
  // it rolls up from nothing and its bars grow as it first shows (motion, 23 Nov)
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const f = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(f)
  }, [])
  return (
    <Section
      title="Time saved this week"
      about="Its finished work this week, times the minutes each kind of work saves you."
    >
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Roll value={hm(grown ? saved.minutes : 0)} className="font-serif text-2xl text-ink" />
            {saved.source === 'estimated' && <Pill>Estimated</Pill>}
          </div>
          <p className="text-ink-3 text-sm">{saved.how}</p>
        </div>
        <div className="ml-auto flex h-10 items-end gap-1">
          {saved.days.map((m, i) => (
            <span
              key={WEEK[i]}
              data-tip={`${WEEK[i]}: ${hm(m)}`}
              className="w-2.5 rounded-sm bg-sunk transition-[height] duration-320 ease-spring"
              style={{
                height: `${grown ? Math.max(8, (m / top) * 100) : 8}%`,
                ...(m ? { background: fill(0) } : {}),
              }}
            />
          ))}
        </div>
      </div>
    </Section>
  )
}

// The sites it opens with no card, each with Delete: a yes that lasts is easy to take back.
function Sites({ id, sites, onChange }: { id: string; sites: string[]; onChange: () => void }) {
  const { busy, problem, act } = useAct(onChange)
  if (!sites.length) return null
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="flex items-center gap-1.5 font-medium font-serif text-ink text-xl">
        Sites
        <Info help="It opens these without asking you, and what it runs on a schedule reaches them too." />
      </h2>
      <Refusal words={problem} />
      <ul className="flex flex-col">
        {sites.map((host) => (
          <li
            key={host}
            className="flex items-center gap-2 border-hair border-t py-1.5 text-md first:border-t-0"
          >
            <span className="min-w-0 flex-1 truncate text-ink">{host}</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => act(() => api.post(`/api/agents/${id}/sites/remove`, { host }))}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </section>
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
              aria-pressed={m.essential}
              onClick={() => void toggle(m)}
              data-tip={
                m.essential
                  ? 'Read at the start of every chat'
                  : 'Found when it’s relevant; read it in every chat instead'
              }
              className={m.essential ? 'text-accent text-sm' : 'text-ink-3 text-sm hover:text-ink'}
            >
              Always read
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

// An agent's instructions, edited in place by a double-click; Save never writes them as typed but
// sends the edit to the Chief of staff as a proposal, which fits it in, or asks with a card where it
// conflicts (Vikas, 23 Nov).
function Instructions({ id, text }: { id: string; text: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const { busy, problem, act } = useAct()
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="flex items-center gap-1.5 font-medium font-serif text-ink text-xl">
        Instructions
        <Info help="Double-click to change them. Save sends your change to the Chief of staff, which fits it in, or asks you in the chat where it conflicts." />
      </h2>
      {draft === null ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: a double-click edits, as a name's does
        <div
          className="text-md"
          data-tip="Double-click to change"
          onDoubleClick={() => setDraft(text)}
        >
          <Words text={text || 'None yet.'} />
        </div>
      ) : (
        <div className="flex flex-col items-end gap-1.5">
          <div className="relative w-full">
            <textarea
              // biome-ignore lint/a11y/noAutofocus: the double-click asked for it
              autoFocus
              aria-label="Instructions"
              value={draft}
              rows={Math.min(18, Math.max(4, draft.split('\n').length + 1))}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 pr-9 text-md text-ink outline-none focus:border-accent-line focus:ring-3 focus:ring-accent-soft"
            />
            <Voice value={draft} onChange={setDraft} className="absolute top-1.5 right-1.5" />
          </div>
          <span className="flex gap-1">
            <YesNo yes={false} words="Cancel" onClick={() => setDraft(null)} />
            <YesNo
              yes
              words="Save"
              busy={busy || !draft.trim() || draft.trim() === text.trim()}
              onClick={() =>
                void act(async () => {
                  await api.post(`/api/agents/${id}/propose`, { instructions: draft })
                  setDraft(null)
                  setSent(true)
                })
              }
            />
          </span>
        </div>
      )}
      {sent && (
        <p className="text-ink-2 text-md">
          Sent to the Chief of staff. It changes them, or asks you in the chat.
        </p>
      )}
      <Refusal words={problem} />
    </section>
  )
}
