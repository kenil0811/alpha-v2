// Interviews in the window (the redesign of 22 Nov, calls 15 to 19; one page, 23 Nov): its three steps in Set up Alpha, What I learned (one block of lines, each approved or
// declined), A few questions (one at a time, its options and a box for their own words) and Off
// your plate (the first few pieces of work with their playback and Build it, or a box for one thing
// they repeat), and its page, which points to them and to the report. No row on Home and no cards in Needs you: the story is
// where the interview is. Built only from the window's kit, so it looks and acts as the window's
// own screens do.
import {
  askFor,
  Busy,
  Button,
  type ChapterProps,
  Check,
  ChevronRight,
  Field,
  go,
  IconButton,
  Info,
  LoaderCircle,
  openModule,
  Pencil,
  Pill,
  Refusal,
  Repeat,
  type Screen,
  Section,
  startBuild,
  useAct,
  YesNo,
} from '@alpha/window/kit'
import { useEffect, useState } from 'react'

interface Found {
  name: string
  words: string
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

// The parts the three steps share: what each found, read again while it is being written.
function useLearned({ screen, reload, next }: ChapterProps) {
  const drafting = !!screen.drafting
  const empty = (screen.empty ?? null) as string | null
  useEffect(() => next({ label: 'Continue', ready: true }), [next])
  // read and written in the background: read again until it is there, and while nothing is
  // connected, in case something is
  useEffect(() => {
    if (!drafting && !empty) return
    const t = setInterval(reload, drafting ? 2000 : 5000)
    return () => clearInterval(t)
  }, [drafting, empty, reload])
  return { drafting, empty, problem: (screen.problem ?? null) as string | null }
}

// While it is read and written: what it is doing, in words, and each source read so far with how
// much, in one quiet list; it fills in by itself while the person carries on.
function Writing({ found }: { found: Found[] }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-col gap-0.5">
        <Busy className="text-md">Reading</Busy>
        <span className="text-ink-3 text-sm">This fills in by itself. You can carry on.</span>
      </p>
      {found.length > 0 && (
        <ul
          data-slot="read-so-far"
          className="flex flex-col rounded-lg border border-line bg-surface"
        >
          {found.map((f) => (
            <li
              key={f.name}
              className="flex items-center gap-3 border-hair border-t px-3.5 py-2.5 first:border-t-0"
            >
              <Check className="size-3.5 shrink-0 text-good" />
              <span className="min-w-0 flex-1 truncate text-ink text-md">{f.name}</span>
              <span className="shrink-0 text-ink-3 text-sm">{f.words}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// What I learned: one block of lines, each approved, declined or put in the person's own words
// with the pencil (saved as approved); only an approved one is saved.
function Learned(p: ChapterProps) {
  const { drafting, empty, problem } = useLearned(p)
  const about = (p.screen.about ?? []) as AboutLine[]
  const doing = useAct()
  const send = (body: unknown) => void doing.act(() => p.act(body))
  const [editing, setEditing] = useState<{ id: string; words: string } | null>(null)
  const save = () => {
    if (!editing?.words.trim()) return
    send({ about: { keep: [editing.id], edit: { [editing.id]: editing.words.trim() } } })
    setEditing(null)
  }
  if (empty) return <p className="text-ink-2">{empty}</p>
  if (drafting && !about.length) return <Writing found={(p.screen.found ?? []) as Found[]} />
  return (
    <div className="flex flex-col gap-4">
      {problem && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-warn">
          {problem}
          <Button size="sm" disabled={doing.busy || drafting} onClick={() => send({ retry: true })}>
            Try again
          </Button>
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {about.map((a) => (
          <li key={a.id} className="flex items-start gap-3 py-1">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ink-3" />
            {editing?.id === a.id ? (
              <Field
                className="min-w-0 flex-1"
                aria-label="Your own words"
                autoFocus
                value={editing.words}
                onChange={(e) => setEditing({ id: a.id, words: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save()
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              <span className="flex min-w-0 flex-1 items-start gap-1.5 pt-0.5 text-ink">
                {a.line}
                <Info
                  help={`${a.for === 'everyone' ? 'For everyone here. ' : ''}${restsWords(a.rests)}`}
                />
              </span>
            )}
            {editing?.id === a.id ? (
              <span className="flex shrink-0 gap-1">
                <Button size="sm" disabled={doing.busy || !editing.words.trim()} onClick={save}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1">
                <YesNo
                  value={a.state === 'Kept' ? 'yes' : a.state === 'Dropped' ? 'no' : null}
                  disabled={doing.busy || a.decided}
                  onChange={(v) =>
                    send({ about: v === 'yes' ? { keep: [a.id] } : { drop: [a.id] } })
                  }
                />
                {!a.decided && (
                  <IconButton
                    label="Edit"
                    disabled={doing.busy}
                    className="press swell"
                    onClick={() => setEditing({ id: a.id, words: a.line })}
                  >
                    <Pencil className="size-3.5" />
                  </IconButton>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {drafting && (
        <p className="flex items-center gap-2 text-ink-3 text-sm">
          <Busy>Learning more</Busy>
        </p>
      )}
      <Refusal words={doing.problem} />
    </div>
  )
}

// A few questions: one at a time, its options and a box for their own words.
function Questions(p: ChapterProps) {
  const { drafting, empty } = useLearned(p)
  const question = (p.screen.question ?? null) as Asked | null
  const doing = useAct()
  const send = (body: unknown) => void doing.act(() => p.act(body))
  if (empty) return <p className="text-ink-2">{empty}</p>
  if (!question)
    return drafting ? (
      <p className="flex items-center gap-2 text-ink-3">
        <Busy>Working out what to ask</Busy>
      </p>
    ) : (
      <p className="flex items-center gap-2 text-ink-2">
        <Check className="size-4 text-good" /> All answered, thank you.
      </p>
    )
  return (
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
      <Refusal words={doing.problem} />
    </section>
  )
}

// Off your plate: the first few pieces of work by hours a month, each with its playback and Build
// it; with none, one box for something they repeat, which goes to the Module builder as New
// module does.
function Plate(p: ChapterProps) {
  const { drafting } = useLearned(p)
  const flows = (p.screen.workflows ?? []) as Flow[]
  const playbacks = (p.screen.playbacks ?? []) as Playback[]
  const doing = useAct()
  const send = (body: unknown) => void doing.act(() => p.act(body))
  if (!flows.length && drafting)
    return (
      <p className="flex items-center gap-2 text-ink-3">
        <LoaderCircle className="size-4 animate-spin" /> Working out what I could do for you
      </p>
    )
  if (!flows.length) return <Repeat done={() => p.act({ built: true })} />
  return (
    <div className="flex flex-col gap-2">
      {flows.map((w) => (
        <FlowRow
          key={w.id}
          flow={w}
          playback={
            playbacks.find((x) => x.workflow === w.name && !x.decided) ??
            playbacks.filter((x) => x.workflow === w.name).at(-1)
          }
          busy={doing.busy}
          send={send}
        />
      ))}
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
        about="The Interviewer reads what you connect in Set up Alpha, asks only what it can't tell from that, and saves only what you approve: lines about you in How to work, and a report of your work in Your work."
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
  chapters: { learned: Learned, questions: Questions, plate: Plate },
}
