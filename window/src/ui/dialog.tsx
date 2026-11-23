// The one pop-up: the browser's own <dialog>, opened modal, so focus stays inside, Escape closes
// it and focus goes back where it was. It is the standard card lifted (ui/frame.tsx), half the
// window wide and as tall as what it holds (Vikas, 23 Nov); a phone's width at the least. Every pop-up in the window is a Dialog; one that asks
// before something that can't be undone is a Confirm.
import { type ReactNode, useEffect, useRef } from 'react'
import { Button } from './button.tsx'
import { cn } from './cn.ts'
import { FRAME } from './frame.tsx'
import { type Notice, notify } from './notice.tsx'

export function Dialog({
  open,
  title,
  onClose,
  children,
  actions,
}: {
  open: boolean
  title: string
  onClose: () => void
  children?: ReactNode
  actions?: ReactNode
}) {
  const box = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = box.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape, the keyboard's way out, is the dialog's own
    <dialog
      ref={box}
      // Escape closes it natively, and the screen hears it here
      onClose={onClose}
      // a click on the backdrop lands on the dialog itself
      onClick={(e) => e.target === box.current && onClose()}
      aria-label={title}
      className={cn(
        FRAME,
        'm-auto w-1/2 min-w-[min(28rem,calc(100vw-2rem))] max-w-none p-0 text-ink shadow-pop backdrop:bg-scrim',
      )}
    >
      {open && (
        <div className="flex flex-col gap-3 p-4">
          <h2 className="font-medium text-ink text-lg">{title}</h2>
          {children && <div className="text-ink-2 text-md">{children}</div>}
          {actions && <div className="flex justify-end gap-2 pt-1">{actions}</div>}
        </div>
      )}
    </dialog>
  )
}

// Asks before something that can't be undone: the button names what will happen, and Cancel
// holds the focus, so Return never deletes. Once done (onYes not refused: false or a throw), a
// notice says so, and where to bring it back when there is a way (Vikas, 23 Nov).
export function Confirm({
  open,
  title,
  yes,
  onYes,
  onClose,
  busy,
  done,
  children,
}: {
  open: boolean
  title: string
  yes: string
  onYes: () => unknown // false, or a promise of false, when it did not happen
  done: Notice // what the notice says once it is done
  onClose: () => void
  busy?: boolean
  children?: ReactNode
}) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              if ((await onYes()) !== false) notify(done)
            }}
          >
            {yes}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}
