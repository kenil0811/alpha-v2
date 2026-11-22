// Interviews in the window (the redesign of 22 Nov, calls 15 to 19): its two chapters in Set up
// Alpha, Get to know you (every source on one screen, read together) and What I learned (About
// you, the blanks one at a time, the workflows with their playbacks and Build it), and its page,
// which points to them and to the report. No row on Home and no cards in Needs you: the story is
// where the interview is. Built only from the window's kit, so it looks and acts as the window's
// own screens do.
import {
  askFor,
  Button,
  type ChapterProps,
  Check,
  ChevronRight,
  Field,
  go,
  Info,
  LoaderCircle,
  openModule,
  Pill,
  Refusal,
  type Screen,
  Section,
  Switch,
  startBuild,
  useAct,
} from '@alpha/window/kit'
import { useEffect, useRef, useState } from 'react'

interface Source {
  key: string
  name: string
  reads: string
  has: string
  available: boolean
}
interface Found {
  key?: string
  name: string
  words: string
  shown?: string[]
  on?: boolean
}

// Every source this person has, what each reads and how much there is, all on, each with a
// switch; Read these reads them together, and what was found shows as it comes.
function Know({ screen, reload, next }: ChapterProps) {
  const sources = (screen.sources ?? []) as Source[]
  const found = (screen.found ?? []) as Found[]
  const [off, setOff] = useState<string[]>([])
  const [reading, setReading] = useState(false)
  const offRef = useRef(off)
  offRef.current = off
  useEffect(
    () =>
      next({
        label: 'Read these',
        busy: 'Reading',
        ready: true,
        body: () => {
          setReading(true)
          return { off: offRef.current }
        },
      }),
    [next],
  )
  // what was found, as it comes, while the reading goes on
  useEffect(() => {
    if (!reading && !screen.reading) return
    const t = setInterval(reload, 1500)
    return () => clearInterval(t)
  }, [reading, screen.reading, reload])
  const said = new Map(found.map((f) => [f.key, f]))
  return (
    <ul className="flex flex-col gap-2">
      {sources.map((s) => {
        const f = said.get(s.key)
        const on = s.available && !off.includes(s.key)
        return (
          <li
            key={s.key}
            className="flex flex-col gap-1 rounded-lg border border-line bg-surface px-3.5 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 font-medium text-ink text-md">
                  {s.name}
                  <Info help={s.reads} />
                </p>
                {/* what it holds, or what to do first: whole on a phone, one line on a window */}
                <p className="text-ink-3 text-sm sm:truncate">{s.has}</p>
              </div>
              {f ? (
                <Pill tone={f.on ? 'good' : 'faint'}>{f.on ? 'Read' : 'Not read'}</Pill>
              ) : reading ? (
                <LoaderCircle className="size-4 animate-spin text-ink-3" />
              ) : (
                <Switch
                  label={`Read ${s.name}`}
                  checked={on}
                  disabled={!s.available}
                  onChange={(v) =>
                    setOff((o) => (v ? o.filter((k) => k !== s.key) : [...o, s.key]))
                  }
                />
              )}
            </div>
            {f?.on &&
              (f.shown ?? []).map((l) => (
                <p key={l} className="text-ink-2 text-sm sm:truncate">
                  {l}
                </p>
              ))}
          </li>
        )
      })}
    </ul>
  )
}

interface AboutLine {
  id: string
  line: string
  for: 'me' | 'everyone'
  rests: string[]
  state: string
  decided: boolean
}
interface Playback {
  id: string
  workflow: string
  name: string
  kind: string
  words: string
  does: string
  target: string | null
  choices: string[]
  answer: string | null
  decided: boolean
}
interface Flow {
  id: string
  name: string
  shows: string
  hours: number | null
  status: string
}
interface Asked {
  id: string
  words: string
  options: string[]
  rests: string[]
  at: number
  of: number
}

const restsWords = (rests: string[]) => `Rests on: ${rests.join(', ')}`

// What was drafted: About you to keep, edit or drop, the blanks one at a time, then the work by
// hours a month, each with its playback; the act at the foot goes on.
function Learned({ screen, reload, next, act }: ChapterProps) {
  const drafting = !!screen.drafting
  const about = (screen.about ?? []) as AboutLine[]
  const question = (screen.question ?? null) as Asked | null
  const flows = (screen.workflows ?? []) as Flow[]
  const playbacks = (screen.playbacks ?? []) as Playback[]
  const found = (screen.found ?? []) as Found[]
  const problem = (screen.problem ?? null) as string | null
  const doing = useAct()
  useEffect(() => next({ label: 'Continue', ready: true }), [next])
  // the draft comes in the background: read again until it is there
  useEffect(() => {
    if (!drafting) return
    const t = setInterval(reload, 2000)
    return () => clearInterval(t)
  }, [drafting, reload])
  const empty = !about.length && !flows.length && !question
  if (drafting && empty)
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-ink-2">
          <LoaderCircle className="size-4 animate-spin" /> Writing what I learned from what I read
        </p>
        <ul className="flex flex-col gap-2">
          {found.map((f) => (
            <li key={f.name} className="text-sm">
              <span className="font-medium text-ink">{f.name}</span>
              <span className="text-ink-3"> {f.words}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  const send = (body: unknown) => void doing.act(() => act(body))
  return (
    <div className="flex flex-col gap-8">
      {problem && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-warn">
          {problem}
          <Button size="sm" disabled={doing.busy || drafting} onClick={() => send({ retry: true })}>
            Try again
          </Button>
        </p>
      )}
      {about.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-ink-2 text-sm">About you</h2>
          {about.map((a) => (
            <AboutRow key={a.id} line={a} busy={doing.busy} send={send} />
          ))}
        </section>
      )}
      {question && (
        <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          <p className="text-ink-3 text-sm">
            Question {question.at} of {question.of}
          </p>
          <p className="flex items-start gap-1.5 font-medium text-ink">
            {question.words}
            <Info help={restsWords(question.rests)} />
          </p>
          <div className="flex flex-wrap gap-2">
            {question.options.map((o) => (
              <Button
                key={o}
                size="sm"
                disabled={doing.busy}
                onClick={() => send({ answer: { id: question.id, choice: o } })}
              >
                {o}
              </Button>
            ))}
          </div>
          <OwnWords
            busy={doing.busy}
            onAnswer={(words) => send({ answer: { id: question.id, choice: words } })}
          />
        </section>
      )}
      {flows.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-ink-2 text-sm">Your work, by hours a month</h2>
          {flows.map((w) => (
            <FlowRow
              key={w.id}
              flow={w}
              playback={
                playbacks.find((p) => p.workflow === w.name && !p.decided) ??
                playbacks.filter((p) => p.workflow === w.name).at(-1)
              }
              busy={doing.busy}
              send={send}
            />
          ))}
        </section>
      )}
      {drafting && (
        <p className="flex items-center gap-2 text-ink-3 text-sm">
          <LoaderCircle className="size-3.5 animate-spin" /> Writing more from your answers
        </p>
      )}
      <Refusal words={doing.problem} />
    </div>
  )
}

// An answer in the person's own words: the box is always there beside the options.
function OwnWords({ busy, onAnswer }: { busy: boolean; onAnswer: (words: string) => void }) {
  const [typed, setTyped] = useState('')
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (typed.trim()) {
          onAnswer(typed.trim())
          setTyped('')
        }
      }}
    >
      <Field
        className="flex-1"
        aria-label="Your answer"
        placeholder="Or answer in your own words"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
      />
      <Button size="sm" type="submit" disabled={busy || !typed.trim()}>
        Answer
      </Button>
    </form>
  )
}

function AboutRow({
  line: a,
  busy,
  send,
}: {
  line: AboutLine
  busy: boolean
  send: (body: unknown) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5">
      {editing === null ? (
        <p className="flex min-w-0 basis-full items-start gap-1.5 text-ink text-md sm:min-w-60 sm:flex-1 sm:basis-auto">
          {a.line}
          <Info
            help={`${a.for === 'everyone' ? 'For everyone here. ' : ''}${restsWords(a.rests)}`}
          />
        </p>
      ) : (
        <Field
          className="min-w-0 basis-full sm:min-w-60 sm:flex-1 sm:basis-auto"
          aria-label="The line, in your words"
          value={editing}
          onChange={(e) => setEditing(e.target.value)}
        />
      )}
      {a.decided ? (
        <Pill tone={a.state === 'Kept' ? 'good' : 'faint'}>{a.state}</Pill>
      ) : editing !== null ? (
        <>
          <Button
            size="sm"
            disabled={busy || !editing.trim()}
            onClick={() => send({ about: { keep: [a.id], edit: { [a.id]: editing.trim() } } })}
          >
            Keep
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" disabled={busy} onClick={() => send({ about: { keep: [a.id] } })}>
            Keep
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(a.line)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => send({ about: { drop: [a.id] } })}
          >
            Drop
          </Button>
        </>
      )}
    </div>
  )
}

function FlowRow({
  flow: w,
  playback: p,
  busy,
  send,
}: {
  flow: Flow
  playback: Playback | undefined
  busy: boolean
  send: (body: unknown) => void
}) {
  const build = useAct()
  const [built, setBuilt] = useState(false)
  const agreed =
    w.status === 'Agreed' || (!!p && (p.answer === 'Yes' || p.answer === 'Yes and also'))
  // one that waits on the person's answer opens by itself; the others open on a click
  const waits = !!p && !p.decided
  const [open, setOpen] = useState(waits)
  useEffect(() => {
    if (waits) setOpen(true)
  }, [waits])
  const state = waits
    ? (['Waits for you', 'warn'] as const)
    : agreed
      ? (['Agreed', 'good'] as const)
      : w.status === 'Not worth building'
        ? (['Not worth building', 'faint'] as const)
        : p?.answer === 'Not this'
          ? (['Being written again', 'faint'] as const)
          : (['Questions first', 'faint'] as const)
  return (
    <div className="flex flex-col rounded-lg border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3.5 py-3 text-left hover:bg-hover"
      >
        <ChevronRight
          className={`size-3.5 shrink-0 text-ink-3 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="min-w-0 flex-1 truncate font-medium text-ink text-md">{w.name}</span>
        {/* on a phone its hours and state go under its name, so the name is never cut */}
        <span className="flex w-full items-center gap-3 pl-6.5 sm:w-auto sm:pl-0">
          {w.hours !== null && <span className="text-ink-3 text-sm">{w.hours} hours a month</span>}
          <Pill tone={state[1]}>{state[0]}</Pill>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-hair border-t px-3.5 pt-2.5 pb-3 pl-10">
          <p className="text-ink-2 text-sm">{w.shows}</p>
        </div>
      )}
      {open && p && (
        <div className="flex flex-col gap-2 px-3.5 pb-3 pl-10">
          <p className="text-ink text-md">{p.words}</p>
          <p className="whitespace-pre-line text-ink-2 text-sm">{p.does}</p>
          {p.decided ? (
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={agreed ? 'good' : 'faint'}>{p.answer}</Pill>
              {agreed && p.kind === 'Module' && (
                <Button
                  size="sm"
                  disabled={build.busy || built}
                  onClick={() =>
                    void build.act(async () => {
                      await startBuild(
                        askFor(
                          [
                            `Build ${p.name} for ${w.name}, from my report in Your work. I said yes to its playback in Set up Alpha: "We'd build ${p.name}".`,
                            p.does,
                            ...(p.target ? [`Target: ${p.target}`] : []),
                            `What the data shows: ${w.shows}`,
                          ].join('\n\n'),
                          [],
                        ),
                      )
                      setBuilt(true)
                    })
                  }
                >
                  {built ? (
                    <>
                      <Check className="size-3.5" /> Being built
                    </>
                  ) : (
                    'Build it'
                  )}
                </Button>
              )}
              <Refusal words={build.problem} />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {p.choices.map((c) => (
                <Button
                  key={c}
                  size="sm"
                  disabled={busy}
                  onClick={() => send({ playback: { id: p.id, choice: c } })}
                >
                  {c}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// The plugin's page: where the interview is, and the report.
function Page() {
  return (
    <div className="mx-auto flex max-w-page flex-col gap-4 px-8 pt-8 pb-12">
      <Section
        title="Interviews"
        about="The Interviewer reads what you allow in Set up Alpha's Get to know you, asks only what it can't tell from that, and keeps what you keep: lines about you in How to work, and a report of your work in Your work."
      >
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => go('#/set-up')}>
            Open Set up Alpha
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void openModule('Your work')}>
            Open Your work
          </Button>
        </div>
      </Section>
    </div>
  )
}

export const screen: Screen = {
  name: 'interviews',
  title: 'Interviews',
  Page,
  chapters: { know: Know, learned: Learned },
}
