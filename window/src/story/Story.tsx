// Set up Alpha: the first run as one continuous page over the window (proposed, Vikas 23 Nov; the
// 22 Nov story's chapters are its steps). A slim progress bar and Later at the top; each step opens
// under the one before once that is done or skipped, Alpha's face saying its one line, the step,
// and Skip and its own act at its foot. The core draws every step from state (core/src/api/
// story.ts); each part keeps its place from the first frame, so nothing moves as things load
// (ui-rules U1 to U4).
import type { ChapterScreen, StoryView } from '@alpha/core/api'
import { Check, Minus } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from '../api.ts'
import { Face } from '../Face.tsx'
import { ReadLine } from '../ReadReport.tsx'
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
  // every step gone through or skipped, and the one the person is on; opened again after the
  // end, every step
  const at = story.at ? list.findIndex((c) => c.key === story.at) : list.length - 1
  const open = list.slice(0, at + 1)
  const moved = (s: StoryView) => {
    setStory(s)
    if (s.done) onClose()
  }
  return (
    <div className="fixed inset-0 z-(--z-overlay) snap-y snap-mandatory overflow-y-auto bg-canvas text-base text-ink">
      <header className="sticky top-0 z-10 bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[760px] items-center gap-4 px-4 md:px-8">
          <p className="flex-1 font-semibold text-ink-2 text-sm">Set up Alpha</p>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Later
          </Button>
        </div>
      </header>
      <Dots list={list} at={story.at} />
      <main className="mx-auto flex max-w-[760px] flex-col px-4 pr-8 md:px-8">
        {open.map((c, i) => (
          <StepPart
            key={c.key}
            step={c}
            n={i + 1}
            here={c.key === story.at}
            fresh={first.fresh}
            moved={moved}
            leave={onClose}
          />
        ))}
      </main>
    </div>
  )
}

const scrollTo = (key: string) => {
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  document
    .getElementById(`step-${key}`)
    ?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
}

// The steps as vertical dots at the right edge, like a slideshow's: the one the person is on
// filled and a little larger; one gone through goes there, named in its tip with what happened;
// those ahead are faint, unnamed and can't be pressed, so nothing ahead is told.
function Dots({ list, at }: { list: Step[]; at: string | null }) {
  return (
    <nav
      aria-label="Steps"
      className="fixed top-1/2 right-[max(env(safe-area-inset-right),6px)] z-10 flex -translate-y-1/2 flex-col items-center gap-2 md:right-4 md:gap-3"
    >
      {list.map((c) => {
        const here = c.key === at
        const gone = through(c)
        const tip = [c.title, c.summary].filter(Boolean).join(' · ')
        return (
          <button
            key={c.key}
            type="button"
            disabled={!gone && !here}
            aria-label={gone || here ? tip : 'A step ahead'}
            aria-current={here ? 'step' : undefined}
            data-tip={gone || here ? tip : undefined}
            onClick={() => scrollTo(c.key)}
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

// One step on the page, filling the screen under the top bar: scrolling moves a whole step at a
// time, and a step taller than the screen still scrolls. Alpha's line, the step's own part, and
// its foot: Skip and its act on the step the person is on; its act alone on one gone through,
// scrolled back to and changed in place.
function StepPart({
  step,
  n,
  here,
  fresh,
  moved,
  leave,
}: {
  step: Step
  n: number
  here: boolean
  fresh: boolean
  moved: (s: StoryView) => void
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
  // the step that opens comes into view, gently unless motion is reduced
  useEffect(() => {
    if (n > 1) scrollTo(key)
  }, [n, key])
  const go = (skip: boolean) =>
    void act(async () => {
      const out = await api.post<{ story: StoryView }>(
        `/api/story/${key}${skip ? '/skip' : ''}`,
        skip ? {} : (next.body?.() ?? {}),
      )
      moved(out.story)
    })
  // a step's own act from its part (an answer, an approval): on when it says, else read again,
  // so an answer on a step gone through keeps the person where they are
  const actHere = async (body: unknown) => {
    const out = await api.post<{ story: StoryView; on?: boolean }>(`/api/story/${key}`, body)
    moved(out.story)
    if (!out.on) load()
  }
  const doneSaying = useCallback(() => setSaid(true), [])
  // a step with nothing to show is passed by, never drawn empty
  const nothing = !!screen && 'nothing' in screen && screen.nothing === true
  useEffect(() => {
    if (here && nothing) go(true)
  }, [here, nothing])
  if (nothing) return null
  // Hello has nothing to skip, and Done is the way out; every other step can be skipped
  const skippable = here && key !== 'welcome' && key !== 'done'
  return (
    <section
      id={`step-${key}`}
      aria-label={step.title}
      className="story-rise flex min-h-[calc(100dvh-3rem)] snap-start scroll-mt-12 flex-col justify-center gap-6 py-10"
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
      {/* see what Alpha read: the live line, opening the report (proposed, 23 Nov) */}
      <ReadLine onOpen={leave} />
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
