// Set up Alpha: the first run told as a story of short chapters (the 22 Nov onboarding redesign),
// full screen over the window. The path of chapters at the left (a bar on top on a phone), Alpha's
// face saying one line at the top, one chapter's screen, and Back, Skip and the chapter's own act
// at its foot. The core draws every screen from state (core/src/api/story.ts); each part keeps its
// place from the first frame, so nothing moves as things load (ui-rules U1 to U4).
import type { ChapterScreen, StoryView } from '@alpha/core/api'
import { Check, Minus } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
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
  if (open) return story ? <Story first={story} onClose={close} /> : null
  return <>{children}</>
}

function Story({ first, onClose }: { first: StoryView; onClose: () => void }) {
  const [story, setStory] = useState(first)
  const [at, setAt] = useState(first.at ?? first.chapters[0]?.key ?? 'done')
  const [screen, setScreen] = useState<ChapterScreen | null>(null)
  const [next, setNext] = useState<Next>({ label: 'Continue', ready: true })
  const { busy, problem, act } = useAct()
  const load = useCallback(() => {
    api.get<ChapterScreen>(`/api/story/${at}`).then(setScreen, () => undefined)
  }, [at])
  useEffect(() => {
    setScreen(null)
    setNext({ label: 'Continue', ready: true })
    load()
  }, [load])

  const list = story.chapters
  const here = list.findIndex((c) => c.key === at)
  const nowAt = list.findIndex((c) => c.key === story.at)
  // after an act, on to the first chapter not gone through; Done goes to Home
  const moved = (s: StoryView) => {
    setStory(s)
    if (s.done) onClose()
    else setAt(s.at ?? 'done')
  }
  const go = (skip: boolean) =>
    void act(async () => {
      const out = await api.post<{ story: StoryView }>(
        `/api/story/${at}${skip ? '/skip' : ''}`,
        skip ? {} : (next.body?.() ?? {}),
      )
      moved(out.story)
    })
  // Claude can't be skipped while no model is set, and Done is the way out
  const skippable = at !== 'done' && !(at === 'claude' && screen?.key === 'claude' && !screen.set)

  return (
    <div className="fixed inset-0 z-(--z-overlay) flex flex-col bg-canvas text-base text-ink md:flex-row">
      <Path list={list} at={at} nowAt={nowAt} onPick={setAt} onLater={onClose} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[820px] flex-col gap-8 px-4 py-10 md:px-8 md:py-16">
          <header className="flex min-h-18 items-start gap-4">
            <div className="size-12 shrink-0">
              <Face mood={busy ? 'working' : 'quiet'} />
            </div>
            {/* Alpha's line is the screen's title */}
            <h1 key={at} className="story-rise pt-2 text-xl">
              {screen?.says ?? ''}
            </h1>
          </header>
          <section key={at} className="story-rise min-h-90 flex-1">
            {screen && <ChapterBody screen={screen} reload={load} next={setNext} leave={onClose} />}
          </section>
          <footer className="flex flex-wrap items-center gap-2 border-line border-t pt-5">
            <Button
              variant="ghost"
              disabled={busy || here <= 0}
              onClick={() => setAt(list[here - 1]?.key ?? at)}
            >
              Back
            </Button>
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
        </div>
      </main>
    </div>
  )
}

// The chapters, each with its state; one gone through can be opened again. On a phone, a bar on top.
function Path({
  list,
  at,
  nowAt,
  onPick,
  onLater,
}: {
  list: StoryView['chapters']
  at: string
  nowAt: number
  onPick: (key: string) => void
  onLater: () => void
}) {
  const here = list.findIndex((c) => c.key === at)
  return (
    <nav className="flex shrink-0 items-center gap-3 border-line border-b bg-rail px-4 py-3 md:w-60 md:flex-col md:items-stretch md:gap-1 md:border-r md:border-b-0 md:px-3 md:py-6">
      <p className="hidden px-2 pb-4 font-semibold text-ink-2 text-sm md:block">Set up Alpha</p>
      <p className="flex-1 text-ink-2 text-sm md:hidden">
        {here + 1} of {list.length} · {list[here]?.title}
      </p>
      <ol className="hidden flex-col gap-0.5 md:flex">
        {list.map((c, i) => {
          const open = nowAt < 0 || i <= nowAt
          return (
            <li key={c.key}>
              <button
                type="button"
                disabled={!open}
                onClick={() => onPick(c.key)}
                className={cn(
                  'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-md transition-colors',
                  c.key === at ? 'bg-rail-sel text-ink' : 'text-ink-2 hover:bg-rail-hover',
                  !open && 'text-ink-3 hover:bg-transparent',
                )}
              >
                <Mark state={c.state} here={c.key === at} />
                {c.title}
              </button>
            </li>
          )
        })}
      </ol>
      <span className="hidden flex-1 md:block" />
      <Button variant="ghost" size="sm" onClick={onLater} className="md:self-start">
        Later
      </Button>
    </nav>
  )
}

function Mark({ state, here }: { state: StoryView['chapters'][number]['state']; here: boolean }) {
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
