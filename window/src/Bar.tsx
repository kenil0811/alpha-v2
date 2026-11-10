// The bar over every screen (split from Shell.tsx for its wall).
import { Face, type Mood } from './Face.tsx'
import { MOD } from './time.ts'

// The bar over each screen, at the shared 48px: the screen's switch or name centred, and the lens
// on the left when one is on; at its right, Alpha's face opens the assistant while it is closed.
// Find is ⌘K, from anywhere.
export function Bar({
  name,
  middle,
  plain,
  ask,
}: {
  name: string
  middle: (at: HTMLElement | null) => void
  plain?: boolean // the conversation's: a small sans title, as Claude Code's
  ask: { mood: Mood; open: () => void } | null
}) {
  return (
    <div
      data-tauri-drag-region
      className="@container grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-hair border-b bg-canvas pr-3.5 pl-6"
    >
      <div className="flex min-w-0 items-center gap-2" data-tauri-drag-region>
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
