// The assistant on the right of every screen (Vikas, 25 Oct): always there.
// Open, its header has the fold control and Alpha's face and name in the middle; its edge drags it
// wider. Folded, it is a strip with the face and the name, and a click anywhere on it opens it
// again. ⌘J folds and opens it.
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Face, type Mood } from './Face.tsx'
import { IconButton } from './ui/button.tsx'
import { Edge, Opening, STRIP, stripItem, stripName } from './ui/edge.tsx'
import { SidePanel } from './ui/side-panel.tsx'

export function Assistant({
  folded,
  onFold,
  title,
  mood,
  width,
  onWidth,
  children,
}: {
  folded: boolean
  onFold: (folded: boolean) => void
  title: ReactNode // the agent it shows, with its picker
  mood: Mood
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
        className="relative flex w-20 shrink-0 cursor-pointer flex-col items-center gap-1 border-line border-l bg-surface px-1"
      >
        {/* dragged out from its edge, it opens as wide as it was let go (Batch D, 79.2) */}
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
        {/* each place named under its icon (Batch E, 79.3) */}
        <button
          type="button"
          aria-label="Open the assistant (⌘J)"
          data-tip="Open the assistant (⌘J)"
          onClick={(e) => {
            e.stopPropagation()
            onFold(false)
          }}
          className={stripItem()}
        >
          <PanelRightOpen className="size-4" />
          <span className={stripName}>Open</span>
        </button>
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
        </div>
      }
    >
      {children}
    </SidePanel>
  )
}
