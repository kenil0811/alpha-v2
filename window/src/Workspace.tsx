// The rail's head: the workspace tile (its picture, or the person's initial on an accent tile) and
// its name. It opens a menu: Rename and Change picture, the owner's (one name and picture for the
// whole Alpha), and Log out where people sign in. Set up Alpha is a card on Home. Out of Shell.tsx, which holds the rail itself.
import type { Me, Workspace as WorkspaceData } from '@alpha/core/api'
import { Image, LogOut, Pencil } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.ts'
import { CoreImage } from './ui/core-file.tsx'
import { Field } from './ui/field.tsx'
import { MenuItem, Popover } from './ui/popover.tsx'
import { RENAME_TIP, Renamable } from './ui/rename.tsx'

export interface WorkspaceHere {
  workspace: WorkspaceData
  owner: boolean // only the owner names the workspace and gives it a picture
  signIn: boolean // people sign in here, so they can log out
  change: (to: { name?: string | null; picture?: string | null }) => Promise<unknown>
}

export const NO_WORKSPACE: WorkspaceHere = {
  workspace: { name: null, picture: null },
  owner: true,
  signIn: false,
  change: async () => undefined,
}

export const WorkspaceContext = createContext<WorkspaceHere>(NO_WORKSPACE)

const OWNERS = 'The owner names the workspace'

// The workspace as this window has it, from the person's me. No count of what Alpha did on the
// tile: what waits is on Home.
export function useWorkspaceHere(me: Me | null): WorkspaceHere {
  const [workspace, setWorkspace] = useState<WorkspaceData>({ name: null, picture: null })
  useEffect(() => {
    if (me) setWorkspace(me.workspace)
  }, [me])
  const change = useCallback(
    (to: { name?: string | null; picture?: string | null }) =>
      api.post<WorkspaceData>('/api/workspace', to).then(setWorkspace),
    [],
  )
  return useMemo(
    () => ({
      workspace,
      owner: me ? me.user.role === 'owner' : false,
      signIn: !!me?.signIn,
      change,
    }),
    [workspace, me, change],
  )
}

// A picture the person picked, drawn to a 96px square, so what the core keeps is small.
export function squared(f: File): Promise<string> {
  return new Promise((done, failed) => {
    const img = new window.Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = 96
      const side = Math.min(img.width, img.height)
      c.getContext('2d')?.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        96,
        96,
      )
      URL.revokeObjectURL(img.src)
      done(c.toDataURL('image/png'))
    }
    img.onerror = () => failed(new Error('That is not a picture.'))
    img.src = URL.createObjectURL(f)
  })
}

export function Workspace({ name, tileOnly }: { name: string; tileOnly?: boolean }) {
  const { workspace, owner, signIn, change } = useContext(WorkspaceContext)
  const label = workspace.name ?? (name ? `${name}'s workspace` : 'Your workspace')
  const anchor = useRef<HTMLDivElement>(null)
  const pic = useRef<HTMLButtonElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const [showing, setShowing] = useState(false)
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const close = () => {
    setOpen(false)
    setRenaming(null)
  }
  const picked = (f: File | undefined) => {
    if (f)
      void squared(f).then(
        (picture) => change({ picture }),
        () => undefined,
      )
  }
  const logOut = () => void api.post('/api/session/out').finally(() => window.location.replace('/'))
  const initial = (name.trim()[0] ?? 'A').toUpperCase()
  const toMenu = () => setOpen((o) => !o)
  return (
    <div
      ref={anchor}
      className="relative flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 hover:bg-rail-hover"
    >
      <button
        ref={pic}
        type="button"
        aria-label="Workspace picture"
        data-tip={owner ? 'Click to see it, double-click to change it' : undefined}
        onClick={() => (workspace.picture && !tileOnly ? setShowing(true) : toMenu())}
        onDoubleClick={() => {
          if (!owner) return
          setShowing(false)
          setOpen(false)
          file.current?.click()
        }}
        className="relative grid size-6.5 shrink-0 place-items-center overflow-hidden rounded-md bg-accent font-semibold text-accent-ink text-md leading-none"
      >
        {workspace.picture ? (
          <CoreImage path={workspace.picture} alt="" className="size-full object-cover" />
        ) : (
          initial
        )}
      </button>
      <Renamable
        name={label}
        rename={tileOnly || !owner ? null : (to) => change({ name: to.slice(0, 80) })}
      >
        {(start) => (
          <button
            type="button"
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={open}
            data-tip={start ? RENAME_TIP : undefined}
            onClick={toMenu}
            onDoubleClick={() => {
              setOpen(false)
              start?.()
            }}
            className="min-w-0 flex-1 text-left"
          >
            <span className={tileOnly ? 'sr-only' : 'block truncate font-semibold text-md'}>
              {label}
            </span>
          </button>
        )}
      </Renamable>
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          picked(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {workspace.picture && (
        <Popover anchor={pic} open={showing} onClose={() => setShowing(false)}>
          <CoreImage
            path={workspace.picture}
            alt={label}
            className="m-1 size-40 rounded-md object-cover"
          />
        </Popover>
      )}
      <Popover anchor={anchor} open={open} onClose={close}>
        {renaming === null ? (
          <>
            <MenuItem reason={owner ? undefined : OWNERS} onClick={() => setRenaming(label)}>
              <Pencil className="size-3.5 text-ink-3" />
              Rename
            </MenuItem>
            <MenuItem
              reason={owner ? undefined : OWNERS}
              onClick={() => {
                file.current?.click()
                close()
              }}
            >
              <Image className="size-3.5 text-ink-3" />
              Change picture
            </MenuItem>
            {signIn && (
              <MenuItem onClick={logOut}>
                <LogOut className="size-3.5 text-ink-3" />
                Log out
              </MenuItem>
            )}
          </>
        ) : (
          <form
            className="flex w-60 flex-col gap-1.5 p-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!renaming.trim()) return
              void change({ name: renaming.trim().slice(0, 80) })
              close()
            }}
          >
            <Field
              autoFocus
              aria-label="Workspace name"
              value={renaming}
              onChange={(e) => setRenaming(e.target.value)}
            />
          </form>
        )}
      </Popover>
    </div>
  )
}
