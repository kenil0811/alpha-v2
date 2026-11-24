// The bar over every screen (split from Shell.tsx for its wall).
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Face, type Mood } from './Face.tsx'
import { openLink } from './opened.ts'
import { MOD } from './time.ts'
import { cn } from './ui/cn.ts'

export type Crumb = { label: string; href: string }

// The bar over each screen, at the shared 48px: the screen's switch or name centred; at its left a
// ‹ to the page above and the path from Home to it, each part a way there (Home / Deals), the
// middle cut short with … when long; on Home the date there instead, with no ‹
// and no name; at its right, on Home what comes next today, and Alpha's face, which opens the
// assistant while it is closed.
// Find is ⌘K, from anywhere.
export function Bar({
  name,
  middle,
  plain,
  ask,
  trail,
  next,
  lead,
}: {
  name: string
  middle: (at: HTMLElement | null) => void
  plain?: boolean // the conversation's: a small sans title, as Claude Code's
  ask: { mood: Mood; open: () => void } | null
  trail: Crumb[] // Home to the page above this one; none on Home
  next?: ReactNode // on Home, what comes next today, before the face
  lead?: ReactNode // on Home, the date, in place of the ‹ and the name
}) {
  const back = trail.at(-1)
  return (
    <div
      data-tauri-drag-region
      className="@container grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-hair border-b bg-canvas pr-3.5 pl-6"
    >
      <div className="flex min-w-0 items-center gap-2" data-tauri-drag-region>
        {lead ? (
          <div className="flex min-w-0 flex-col justify-center">{lead}</div>
        ) : back ? (
          <nav
            aria-label="Where you are"
            className="-ml-2 flex min-w-0 items-center text-ink-3 text-md"
          >
            <button
              type="button"
              aria-label={`Back to ${back.label}`}
              data-href={back.href}
              onClick={(e) => openLink(back.href, e)}
              className="grid shrink-0 place-items-center rounded-md p-1 hover:bg-hover hover:text-ink"
            >
              <ChevronLeft className="size-4" />
            </button>
            {trail.map((c, i) => (
              <span
                key={c.href}
                className={cn(
                  'flex min-w-0 items-center',
                  i === 0 ? 'shrink-0' : i < trail.length - 1 && 'shrink-[9]',
                )}
              >
                {i > 0 && <span className="shrink-0 px-0.5">/</span>}
                <button
                  type="button"
                  data-href={c.href}
                  onClick={(e) => openLink(c.href, e)}
                  className="min-w-0 truncate rounded-md px-1 py-0.5 hover:bg-hover hover:text-ink"
                >
                  {c.label}
                </button>
              </span>
            ))}
          </nav>
        ) : (
          // always in its place, greyed where there is no page above
          <button
            type="button"
            disabled
            aria-label="Back: nothing above this page"
            className="-ml-2 flex shrink-0 items-center rounded-md p-1 text-ink-3 opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        {plain && (
          <h1 className="min-w-0 truncate font-medium font-sans text-chat text-ink">{name}</h1>
        )}
      </div>
      <div className="flex min-w-0 justify-center">
        <div ref={middle} className="peer flex min-w-0 justify-center empty:hidden" />
        {!plain && !lead && (
          <h1 className="hidden min-w-0 truncate font-serif text-ink text-xl peer-empty:block">
            {name}
          </h1>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2" data-tauri-drag-region>
        {next}
        {ask && (
          <button
            type="button"
            aria-label={`Open the assistant (${MOD}J)`}
            data-tip={`Open the assistant (${MOD}J)`}
            onClick={ask.open}
            className="size-8 rounded-full"
          >
            <Face mood={ask.mood} />
          </button>
        )}
      </div>
    </div>
  )
}
