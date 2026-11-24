// The one pop-up: the browser's own <dialog>, opened modal, so focus stays inside, Escape closes
// it and focus goes back where it was. It is the standard card lifted (ui/frame.tsx): a narrow
// box for a few words and their buttons, half the window wide for a form (wide), as tall as what
// it holds. Every pop-up in the window is a Dialog; one that asks before something that can't be
// undone is a Confirm, always narrow.
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
  wide = false,
}: {
  open: boolean
  title: string
  onClose: () => void
  children?: ReactNode
  actions?: ReactNode
  wide?: boolean // a form: half the window, a phone's width at the least
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
        'm-auto p-0 text-ink shadow-pop backdrop:bg-scrim',
        wide ? 'w-1/2 min-w-[min(28rem,calc(100vw-2rem))] max-w-none' : 'w-full max-w-md',
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
// holds the focus, so Return never deletes. Once the core said yes (onYes answered true), it
// closes and a notice says what happened in true words, and where to bring it back when there is
// a way; a refusal shows its own words where it was asked, and no notice.
export function Confirm({
  open,
  title,
  yes,
  onYes,
  done,
  onClose,
  busy,
  children,
}: {
  open: boolean
  title: string
  yes: string
  onYes: () => boolean | Promise<boolean> // true once the core did it
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
              if ((await onYes()) !== true) return
              notify(done)
              onClose()
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
