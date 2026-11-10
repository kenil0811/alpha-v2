// The bar over every screen (split from Shell.tsx for its wall).
import { ChevronLeft } from 'lucide-react'
import { Face, type Mood } from './Face.tsx'
import { MOD } from './time.ts'

// The bar over each screen, at the shared 48px: the screen's switch or name centred, and the lens
// on the left when one is on, with a ‹ to the page above (Kenil, 10 Nov); at its right, Alpha's
// face opens the assistant while it is closed.
// Find is ⌘K, from anywhere.
export function Bar({
  name,
  middle,
  plain,
  ask,
  back,
}: {
  name: string
  middle: (at: HTMLElement | null) => void
  plain?: boolean // the conversation's: a small sans title, as Claude Code's
  ask: { mood: Mood; open: () => void } | null
  back: { label: string; href: string } | null // the page above this one; none at the top
}) {
  return (
    <div
      data-tauri-drag-region
      className="@container grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-hair border-b bg-canvas pr-3.5 pl-6"
    >
      <div className="flex min-w-0 items-center gap-2" data-tauri-drag-region>
        {back ? (
          <a
            href={back.href}
            data-tip={`Back to ${back.label}`}
            className="-ml-2 flex min-w-0 shrink items-center gap-0.5 rounded-md py-1 pr-2 pl-1 text-ink-3 text-md hover:bg-hover hover:text-ink"
          >
            <ChevronLeft className="size-4 shrink-0" />
            <span className="truncate">{back.label}</span>
          </a>
        ) : (
          // always in its place, greyed where there is no page above (Kenil, 10 Nov)
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
        {!plain && (
          <h1 className="hidden min-w-0 truncate font-serif text-ink text-xl peer-empty:block">
            {name}
          </h1>
        )}
      </div>
      <div className="flex justify-end" data-tauri-drag-region>
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
