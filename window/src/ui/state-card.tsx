// A small card for one thing that is connected or not (an account, this computer's browser, a
// sign-in app, a way to the model): the card's frame, a dot for its state, its name, and its one act
// on the name's line; a short line under it, anything more below (Vikas, 23 Nov). They sit in a
// grid, a card whose form is open taking the whole row.
import type { ReactNode } from 'react'
import { cn } from './cn.ts'
import { cutTip } from './cut-tip.ts'
import { Frame } from './frame.tsx'
import { Info } from './info.tsx'

// green connected, red failed, yellow needs the person, grey not set up or paused
export type State = 'good' | 'bad' | 'warn' | 'off'
const DOT: Record<State, string> = {
  good: 'bg-good',
  bad: 'bg-bad',
  warn: 'bg-warn',
  off: 'bg-ink-3/40',
}

export const STATE_CARDS = 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3'

export function StateCard({
  state,
  says,
  title,
  about,
  sub,
  act,
  wide = false,
  children,
}: {
  state: State
  says: string // the state in words, on the dot's hover
  title: string
  about?: string | undefined // what it is, in an ⓘ beside its name
  sub?: ReactNode
  act?: ReactNode
  wide?: boolean
  children?: ReactNode
}) {
  return (
    <Frame className={cn('flex min-w-0 flex-col gap-2 px-3.5 py-3', wide && 'col-span-full')}>
      <div className="flex min-h-7 items-center gap-2">
        <StateDot state={state} says={says} />
        <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium text-ink">
          <span className="truncate" {...cutTip(title)}>
            {title}
          </span>
          {about && <Info help={about} />}
        </span>
        {act && <span className="flex shrink-0 items-center gap-1">{act}</span>}
      </div>
      {sub && <div className="min-w-0 truncate text-ink-3 text-sm">{sub}</div>}
      {children}
    </Frame>
  )
}

export function StateDot({ state, says }: { state: State; says: string }) {
  return (
    <span
      role="img"
      aria-label={says}
      data-tip={says}
      className={cn('size-2 shrink-0 rounded-full', DOT[state])}
    />
  )
}
