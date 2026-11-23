// Set up Alpha: the first run as one continuous page over the window (proposed, Vikas 23 Nov; the
// 22 Nov story's chapters are its steps). A slim progress bar and Later at the top; each step opens
// under the one before once that is done or skipped, Alpha's face saying its one line, the step,
// and Skip and its own act at its foot. The core draws every step from state (core/src/api/
// story.ts); each part keeps its place from the first frame, so nothing moves as things load
// (ui-rules U1 to U4).
import type { ChapterScreen, StoryView } from '@alpha/core/api'
import { Check, Minus } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.ts'
import { Face } from '../Face.tsx'
import { Refusal, useAct } from '../ui/act.tsx'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
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
  const done = list.filter(through).length
  const moved = (s: StoryView) => {
    setStory(s)
    if (s.done) onClose()
  }
  return (
    <div className="fixed inset-0 z-(--z-overlay) overflow-y-auto bg-canvas text-base text-ink">
      <header className="sticky top-0 z-10 border-line border-b bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[760px] items-center gap-4 px-4 md:px-8">
          <p className="shrink-0 font-semibold text-ink-2 text-sm">Set up Alpha</p>
          <div
            role="progressbar"
            aria-label="How far along"
            aria-valuemin={0}
            aria-valuemax={list.length}
            aria-valuenow={done}
            className="h-1 flex-1 overflow-hidden rounded-full bg-sunk"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${(done / Math.max(1, list.length)) * 100}%` }}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Later
          </Button>
        </div>
      </header>
      <main className="mx-auto flex max-w-[760px] flex-col px-4 pb-24 md:px-8">
        {open.map((c, i) => (
          <StepPart
            key={c.key}
            step={c}
            n={i + 1}
            here={c.key === story.at}
            moved={moved}
            leave={onClose}
          />
        ))}
      </main>
    </div>
  )
}

// One step on the page. Only the step the person is on is open (Vikas, 23 Nov: "let it appear
// layer by layer"); each one gone through folds to one line, its mark, title and what happened,
// with Change to open it again in place.
function StepPart(p: {
  step: Step
  n: number
  here: boolean
  moved: (s: StoryView) => void
  leave: () => void
}) {
  const [opened, setOpened] = useState(false)
  if (p.here || opened) return <OpenStep {...p} fold={() => setOpened(false)} />
  return (
    <section
      aria-label={p.step.title}
      className="flex min-h-11 items-center gap-3 border-line border-b py-2"
    >
      <Mark state={p.step.state} here={false} />
      <span className="shrink-0 text-ink-2">{p.step.title}</span>
      <span className="min-w-0 flex-1 truncate text-ink-3 text-sm">
        {p.step.summary ?? (p.step.state === 'done' ? 'Done' : '')}
      </span>
      <Button variant="ghost" size="sm" onClick={() => setOpened(true)}>
        Change
      </Button>
    </section>
  )
}

// A step open: Alpha's line, the step's own part, and its foot: on the step the person is on,
// Skip and its act; on one opened again with Change, Close and its act, which folds it again.
function OpenStep({
  step,
  n,
  here,
  moved,
  leave,
  fold,
}: {
  step: Step
  n: number
  here: boolean
  moved: (s: StoryView) => void
  leave: () => void
  fold: () => void
}) {
  const key = step.key
  const [screen, setScreen] = useState<ChapterScreen | null>(null)
  const [next, setNext] = useState<Next>({ label: 'Continue', ready: true })
  const { busy, problem, act } = useAct()
  const load = useCallback(() => {
    api.get<ChapterScreen>(`/api/story/${key}`).then(setScreen, () => undefined)
  }, [key])
  useEffect(load, [load])
  // the step that opens comes into view, gently unless motion is reduced
  const part = useRef<HTMLElement>(null)
  useEffect(() => {
    if (n === 1) return
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    part.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
  }, [n])
  const go = (skip: boolean) =>
    void act(async () => {
      const out = await api.post<{ story: StoryView }>(
        `/api/story/${key}${skip ? '/skip' : ''}`,
        skip ? {} : (next.body?.() ?? {}),
      )
      moved(out.story)
      if (!here) fold()
    })
  // a step's own act from its part (an answer, an approval): on when it says, else read again,
  // so an answer on a step gone through keeps the person where they are
  const actHere = async (body: unknown) => {
    const out = await api.post<{ story: StoryView; on?: boolean }>(`/api/story/${key}`, body)
    moved(out.story)
    if (!out.on) load()
  }
  // Hello has nothing to skip, Claude can't be skipped while no model is set, and Done is the
  // way out
  const skippable =
    here &&
    key !== 'welcome' &&
    key !== 'done' &&
    !(key === 'claude' && screen?.key === 'claude' && !screen.set)
  return (
    <section
      ref={part}
      aria-label={step.title}
      className="story-rise flex scroll-mt-16 flex-col gap-6 border-line border-b pt-8 pb-6"
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
          {/* Alpha's line is the step's title */}
          <h2 className="text-xl">{screen?.says ?? ''}</h2>
        </div>
      </header>
      {/* its place kept while it is read, so nothing below jumps */}
      <div className="min-h-24">
        {screen && (
          <ChapterBody screen={screen} reload={load} next={setNext} leave={leave} act={actHere} />
        )}
      </div>
      {(here || screen) && (
        <footer className="flex flex-wrap items-center gap-2">
          {!here && (
            <Button variant="ghost" disabled={busy} onClick={fold}>
              Close
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
            disabled={busy || !next.ready || !screen}
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
