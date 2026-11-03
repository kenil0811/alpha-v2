// The assistant on the right of every screen (Vikas, 25 Oct): always there.
// Open, its header has the fold control, Alpha's face and name in the middle and the bell for
// Activity (a dropdown first), with the pencil beside it (Mark.tsx); its edge drags it wider. Folded, it is a strip with the face, the name and the bell,
// and a click anywhere on it opens it again, as does Open the assistant under the face, mirroring
// the rail's strip, or a drag out of its edge. ⌘J (or ⌘⇧\, the rail's ⌘\ mirrored) folds and
// opens it.
import { Bell, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { ActivityDrop } from './Activity.tsx'
import { Face, type Mood } from './Companion.tsx'
import { MarkButton } from './Mark.tsx'
import { IconButton } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Edge, Opening, STRIP, stripItem, stripName } from './ui/edge.tsx'
import { Popover } from './ui/popover.tsx'
import { SidePanel } from './ui/side-panel.tsx'

// The bell opens Activity as a dropdown first; its Open page goes to the page (Vikas, 1 Nov)
function BellLink({ running, labelled = false }: { running: number; labelled?: boolean }) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={running ? `Activity, ${running} running` : 'Activity'}
        data-tip={running ? `Activity, ${running} running` : 'Activity'}
        onClick={(e) => {
          e.stopPropagation() // folded, a click on the strip opens the assistant
          setOpen((o) => !o)
        }}
        className={
          labelled
            ? stripItem()
            : 'relative grid size-7.5 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink'
        }
      >
        <Bell className="size-4" />
        {labelled && <span className={stripName}>Activity</span>}
        {running > 0 && (
          <span
            className="absolute top-1 right-1 size-2 animate-pulse rounded-full bg-accent"
            aria-hidden="true"
          />
        )}
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="end">
        {open && <ActivityDrop onClose={() => setOpen(false)} />}
      </Popover>
    </>
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
        // the bell's dropdown is portalled, but its clicks still bubble here
        onClick={(e) => {
          if (!(e.target as Element).closest('[data-popover]')) onFold(false)
        }}
        className="relative flex w-20 shrink-0 cursor-pointer flex-col items-center gap-1 border-line border-l bg-surface px-1"
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
          className={cn(stripItem(), 'mt-1 mb-2')}
        >
          <PanelRightOpen className="size-4" />
          <span className={stripName}>Open</span>
        </button>
        <MarkButton labelled />
        <BellLink running={running} labelled />
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
