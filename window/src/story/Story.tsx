// Set up Alpha: the first run over the window, one step on screen at a time (the 22 Nov story's
// chapters are its steps). Later at the top and dots at the right edge; Alpha's face saying the
// step's one line, the step, and Previous, Skip and its own act at its foot. Nothing scrolls back
// to an earlier step: Previous goes to it. The core draws every step from state (core/src/api/
// story.ts); each part keeps its place from the first frame, so nothing moves as things load
// (ui-rules U1 to U4).
import type { ChapterScreen, StoryView } from '@alpha/core/api'
import { Check, Minus } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from '../api.ts'
import { Face } from '../Face.tsx'
import { Refusal, useAct } from '../ui/act.tsx'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { Typing } from '../ui/typing.tsx'
import { SET_UP } from './address.ts'
import { ChapterBody, type Next } from './chapters.tsx'

// The window, or the story over it: opened by itself on a person's first time (nothing gone
// through yet), and from its address.
export function StoryGate({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => window.location.hash === SET_UP)
  const [story, setStory] = useState<StoryView | null>(null)
  const [asked, setAsked] = useState(false)
  // on the first load: a person's first time opens the story by itself
  useEffect(() => {
    api.get<StoryView>('/api/story').then(
      (s) => {
        if (s.fresh) setOpen(true)
        setAsked(true)
      },
      () => setAsked(true), // a core without the story: the window as it was
    )
  }, [])
  // where the story stands, read afresh each time it opens (Reopen starts it over)
  useEffect(() => {
    if (!open) return
    setStory(null)
    api.get<StoryView>('/api/story').then(setStory, () => setOpen(false))
  }, [open])
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === SET_UP) setOpen(true)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const close = useCallback(() => {
    setOpen(false)
    if (window.location.hash === SET_UP) window.location.hash = '#/'
  }, [])
  if (!asked) return null
  if (open) return story ? <Story first={story} onClose={close} /> : <Blank />
  return <>{children}</>
}

// While the story is read: the page's frame at once, never a blank screen.
function Blank() {
  return <div className="fixed inset-0 z-(--z-overlay) bg-canvas" />
}

type Step = StoryView['chapters'][number]
const through = (c: Step) => c.state === 'done' || c.state === 'skipped'

function Story({ first, onClose }: { first: StoryView; onClose: () => void }) {
  const [story, setStory] = useState(first)
  const list = story.chapters
  // the one step on screen: where the person is, or one before it they went back to with Previous
  const [viewing, setViewing] = useState(() => story.at ?? list[0]?.key ?? 'done')
  const index = list.findIndex((c) => c.key === viewing)
  const step = list[index]
  const moved = (s: StoryView, on: boolean) => {
    setStory(s)
    if (s.done) return onClose()
    if (!on) return
    // on from the step on screen: to the next one, never past where the person is
    const atNow = s.chapters.findIndex((c) => c.key === s.at)
    const nextAt = Math.min(index + 1, atNow < 0 ? s.chapters.length - 1 : atNow)
    setViewing(s.chapters[nextAt]?.key ?? s.at ?? 'done')
  }
  return (
    <div className="fixed inset-0 z-(--z-overlay) flex flex-col overflow-y-auto bg-canvas text-base text-ink">
      <header className="sticky top-0 z-(--z-raised) bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[760px] items-center gap-4 px-4 md:px-8">
          <p className="flex-1 font-semibold text-ink-2 text-sm">Set up Alpha</p>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Later
          </Button>
        </div>
      </header>
      <Dots list={list} viewing={viewing} onPick={setViewing} />
      <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-4 pr-8 md:px-8">
        {step && (
          <StepPart
            key={step.key}
            step={step}
            here={step.key === story.at}
            fresh={first.fresh}
            moved={moved}
            back={index > 0 ? () => setViewing(list[index - 1]?.key ?? viewing) : null}
            leave={onClose}
          />
        )}
      </main>
    </div>
  )
}

// The steps as vertical dots at the right edge, like a slideshow's: the one the person is on
// filled and a little larger; one gone through goes there, named in its tip with what happened;
// those ahead are faint, unnamed and can't be pressed, so nothing ahead is told.
function Dots({
  list,
  viewing,
  onPick,
}: {
  list: Step[]
  viewing: string
  onPick: (key: string) => void
}) {
  return (
    <nav
      aria-label="Steps"
      className="fixed top-1/2 right-[max(env(safe-area-inset-right),6px)] z-(--z-raised) flex -translate-y-1/2 flex-col items-center gap-2 md:right-4 md:gap-3"
    >
      {list.map((c) => {
        const here = c.key === viewing
        const gone = through(c) || c.state === 'now'
        const tip = [c.title, c.summary].filter(Boolean).join(' · ')
        return (
          <button
            key={c.key}
            type="button"
            disabled={!gone && !here}
            aria-label={gone || here ? tip : 'A step ahead'}
            aria-current={here ? 'step' : undefined}
            data-tip={gone || here ? tip : undefined}
            onClick={() => onPick(c.key)}
            className="grid size-4 place-items-center disabled:cursor-default"
          >
            <span
              className={cn(
                'rounded-full transition-[width,height,background-color]',
                here
                  ? 'size-2.5 bg-accent md:size-3'
                  : gone
                    ? 'size-1.5 bg-ink-3 hover:bg-ink-2 md:size-2'
                    : 'size-1.5 bg-line md:size-2',
              )}
            />
          </button>
        )
      })}
    </nav>
  )
}

// One step on the page, the only one on screen: Alpha's line, the step's own part, and its foot,
// Previous to the step before (none on the first), Skip on the step the person is on, and its act.
// A step gone through, gone back to with Previous, is changed in place and goes on to the next.
function StepPart({
  step,
  here,
  fresh,
  moved,
  back,
  leave,
}: {
  step: Step
  here: boolean
  fresh: boolean
  moved: (s: StoryView, on: boolean) => void
  back: (() => void) | null
  leave: () => void
}) {
  const key = step.key
  const [screen, setScreen] = useState<ChapterScreen | null>(null)
  const [next, setNext] = useState<Next>({ label: 'Continue', ready: true })
  // Hello types its line out on a person's first time, then its promises come in
  const [said, setSaid] = useState(!(key === 'welcome' && fresh))
  const { busy, problem, act } = useAct()
  const load = useCallback(() => {
    api.get<ChapterScreen>(`/api/story/${key}`).then(setScreen, () => undefined)
  }, [key])
  useEffect(load, [load])
  const go = (skip: boolean) =>
    void act(async () => {
      const out = await api.post<{ story: StoryView }>(
        `/api/story/${key}${skip ? '/skip' : ''}`,
        skip ? {} : (next.body?.() ?? {}),
      )
      moved(out.story, true)
    })
  // a step's own act from its part (an answer, an approval): on when it says, else read again,
  // so an answer keeps the person where they are
  const actHere = async (body: unknown) => {
    const out = await api.post<{ story: StoryView; on?: boolean }>(`/api/story/${key}`, body)
    moved(out.story, !!out.on)
    if (!out.on) load()
  }
  const doneSaying = useCallback(() => setSaid(true), [])
  // a step with nothing to show is passed by, never drawn empty
  const nothing = !!screen && 'nothing' in screen && screen.nothing === true
  useEffect(() => {
    if (here && nothing) go(true)
  }, [here, nothing])
  if (nothing) return null
  // Hello has nothing to skip, Claude can't be skipped while no model is set, and Done is the
  // way out
  const skippable =
    here &&
    key !== 'welcome' &&
    key !== 'done' &&
    !(key === 'claude' && screen?.key === 'claude' && !screen.set)
  return (
    <section
      id={`step-${key}`}
      aria-label={step.title}
      className="story-rise flex min-h-[calc(100dvh-3rem)] flex-col justify-center gap-6 py-10"
    >
      <header className="flex min-h-12 items-start gap-4">
        <div className="size-10 shrink-0">
          <Face mood={here && busy ? 'working' : 'quiet'} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex items-center gap-2 text-ink-3 text-sm">
            <Mark state={step.state} here={here} />
            {step.title}
          </p>
          {/* Alpha's line is the step's title; Hello's types itself out the first time */}
          <h2 className="text-xl">
            {screen && key === 'welcome' ? (
              <Typing text={screen.says} now={said} onDone={doneSaying} />
            ) : (
              (screen?.says ?? '')
            )}
          </h2>
        </div>
      </header>
      {/* its place kept while it is read, so nothing below jumps */}
      <div className="min-h-24">
        {screen && (
          <ChapterBody
            screen={screen}
            reload={load}
            next={setNext}
            leave={leave}
            act={actHere}
            said={said}
          />
        )}
      </div>
      {screen && (
        <footer className="flex flex-wrap items-center gap-2">
          {back && (
            <Button variant="ghost" disabled={busy} onClick={back}>
              Previous
            </Button>
          )}
          {skippable && (
            <Button variant="ghost" disabled={busy} onClick={() => go(true)}>
              Skip
            </Button>
          )}
          <span className="flex-1" />
          <Refusal words={problem} />
          <Button
            variant="primary"
            disabled={busy || !next.ready || !said}
            onClick={() => go(false)}
          >
            {busy && next.busy ? next.busy : next.label}
          </Button>
        </footer>
      )}
    </section>
  )
}

function Mark({ state, here }: { state: Step['state']; here: boolean }) {
  if (state === 'done')
    return (
      <span className="grid size-4.5 place-items-center rounded-full bg-good-soft text-good">
        <Check className="size-3" />
      </span>
    )
  if (state === 'skipped')
    return (
      <span className="grid size-4.5 place-items-center rounded-full bg-sunk text-ink-3">
        <Minus className="size-3" />
      </span>
    )
  return (
    <span
      className={cn(
        'size-4.5 rounded-full border-2',
        here || state === 'now' ? 'border-accent' : 'border-line',
      )}
    />
  )
}
