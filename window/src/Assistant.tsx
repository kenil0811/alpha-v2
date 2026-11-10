// The assistant on the right of a screen, opened from Alpha's face at the right of the bar (Kenil,
// 10 Nov): it starts closed and opens only when asked. Its header has the close control and Alpha's
// face and name in the middle and the close control at its outer corner; its edge drags it wider,
// and it slides open and shut. ⌘J opens and closes it.
import { PanelRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Face, type Mood } from './Face.tsx'
import { MOD } from './time.ts'
import { IconButton } from './ui/button.tsx'
import { SidePanel } from './ui/side-panel.tsx'

export function Assistant({
  onClose,
  title,
  mood,
  width,
  onWidth,
  children,
}: {
  onClose: () => void
  title: ReactNode // the agent it shows, with its picker
  mood: Mood
  width: number | null
  onWidth: (w: number | null) => void
  children: ReactNode
}) {
  return (
    <SidePanel
      title={title}
      onClose={onClose}
      width={width}
      onWidth={onWidth}
      // beside every screen, so it leaves the rail and at least 600px of screen
      // (a width kept from the old Ask panel squeezed every screen to 200px; 26 Oct)
      keep={216 + 600}
      head={
        <div className="flex h-12 shrink-0 items-center gap-0.5 border-hair border-b px-2">
          {/* as wide as the button opposite, so the name stays in the middle */}
          <span className="size-7 shrink-0" />
          <span className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <span className="size-6.5 shrink-0">
              <Face mood={mood} />
            </span>
            <span className="truncate font-semibold text-ink text-md">{title}</span>
          </span>
          {/* the sidebar button at the outer corner, as the rail's (Kenil, 10 Nov) */}
          <IconButton label={`Close the assistant (${MOD}J)`} onClick={onClose}>
            <PanelRight className="size-4" />
          </IconButton>
        </div>
      }
    >
      {children}
    </SidePanel>
  )
}
