// The assistant on the right of every screen (Vikas, 25 Oct): always there.
// Open, its header has the fold control, Alpha's face and name in the middle and the bell for
// Activity, with the pencil beside it (Mark.tsx); its edge drags it wider. Folded, it is a strip with the face, the name and the bell,
// and a click anywhere on it opens it again, as does Open the assistant under the face, mirroring
// the rail's strip, or a drag out of its edge. ⌘J (or ⌘⇧\, the rail's ⌘\ mirrored) folds and
// opens it.
import { Bell, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Face, type Mood } from './Companion.tsx'
import { MarkButton } from './Mark.tsx'
import { IconButton } from './ui/button.tsx'
import { Edge, Opening, STRIP } from './ui/edge.tsx'
import { SidePanel } from './ui/side-panel.tsx'

function BellLink({ running }: { running: number }) {
  return (
    <a
      href="#/activity"
      aria-label={running ? `Activity, ${running} running` : 'Activity'}
      data-tip={running ? `Activity, ${running} running` : 'Activity'}
      className="relative grid size-7.5 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink"
    >
      <Bell className="size-4" />
      {running > 0 && (
        <span
          className="absolute top-1 right-1 size-2 animate-pulse rounded-full bg-accent"
          aria-hidden="true"
        />
      )}
    </a>
  )
}

export function Assistant({
  folded,
  onFold,
  title,
  mood,
  running,
  width,
  onWidth,
  children,
}: {
  folded: boolean
  onFold: (folded: boolean) => void
  title: string // Alpha, or the module it is asked about
  mood: Mood
  running: number
  width: number | null
  onWidth: (w: number | null) => void
  children: ReactNode
}) {
  const [opening, setOpening] = useState<number | null>(null)
  if (folded)
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: the face is the keyboard's way in
      <aside
        onClick={() => onFold(false)}
        className="relative flex w-14 shrink-0 cursor-pointer flex-col items-center gap-1 border-line border-l bg-surface"
      >
        <Edge
          side="left"
          folded
          width={STRIP}
          max={Math.floor((window.innerWidth * 2) / 3)}
          onDrag={setOpening}
          onDone={(w) => {
            onWidth(w)
            onFold(false)
          }}
          onFold={() => undefined}
        />
        <Opening side="right" width={opening} />
        <div className="flex h-12 w-full shrink-0 items-center justify-center border-hair border-b">
          <button
            type="button"
            aria-label="Open the assistant (⌘J)"
            data-tip="Open the assistant (⌘J)"
            onClick={(e) => {
              e.stopPropagation()
              onFold(false)
            }}
            className="size-8 rounded-full"
          >
            <Face mood={mood} />
          </button>
        </div>
        <button
          type="button"
          aria-label="Open the assistant"
          data-tip="Open the assistant (⌘J)"
          onClick={(e) => {
            e.stopPropagation()
            onFold(false)
          }}
          className="mt-1 mb-2 grid size-8.5 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink"
        >
          <PanelRightOpen className="size-4" />
        </button>
        <span className="text-ink-3 text-xs">Alpha</span>
        <MarkButton />
        <BellLink running={running} />
      </aside>
    )
  return (
    <SidePanel
      title={title}
      onClose={() => onFold(true)}
      width={width}
      onWidth={onWidth}
      // always open beside every screen, so it leaves the rail and at least 600px of screen
      // (a width kept from the old Ask panel squeezed every screen to 200px; 26 Oct)
      keep={216 + 600}
      head={
        <div className="flex h-12 shrink-0 items-center gap-0.5 border-hair border-b px-2">
          <IconButton label="Fold the assistant (⌘J)" onClick={() => onFold(true)}>
            <PanelRightClose className="size-4" />
          </IconButton>
          <span className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <span className="size-6.5 shrink-0">
              <Face mood={mood} />
            </span>
            <span className="truncate font-semibold text-ink text-md">{title}</span>
          </span>
          <MarkButton />
          <BellLink running={running} />
        </div>
      }
    >
      {children}
    </SidePanel>
  )
}
