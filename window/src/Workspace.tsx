// The rail's head: the workspace tile (its picture, or the person's initial on an accent tile) and
// its name. It opens a menu: Activity, with how much Alpha did since the person last opened it,
// Rename and Change picture, the owner's (one name and picture for the whole Alpha), and Log out
// where people sign in. Out of Shell.tsx, which holds the rail itself.
import type { Me, Workspace as WorkspaceData } from '@alpha/core/api'
import { Activity, Image, LogOut, Pencil } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.ts'
import type { Place } from './place.ts'
import { CoreImage } from './ui/core-file.tsx'
import { Field } from './ui/field.tsx'
import { MenuItem, Popover } from './ui/popover.tsx'
import { RENAME_TIP, Renamable } from './ui/rename.tsx'

export interface WorkspaceHere {
  workspace: WorkspaceData
  owner: boolean // only the owner names the workspace and gives it a picture
  signIn: boolean // people sign in here, so they can log out
  news: number // what Alpha did since this person last opened Activity
  change: (to: { name?: string | null; picture?: string | null }) => Promise<unknown>
}

export const NO_WORKSPACE: WorkspaceHere = {
  workspace: { name: null, picture: null },
  owner: true,
  signIn: false,
  news: 0,
  change: async () => undefined,
}

export const WorkspaceContext = createContext<WorkspaceHere>(NO_WORKSPACE)

const OWNERS = 'The owner names the workspace'

// The workspace as this window has it: from the person's me, the count of what is new kept up as
// the world changes. Opening Activity moves the seen mark; so does a first look, once the core says
// there is none, so a newcomer starts from now and not from everything before them.
export function useWorkspaceHere(me: Me | null, place: Place, version: number): WorkspaceHere {
  const inActivity = place.at === 'settings' && place.section === 'activity'
  const [workspace, setWorkspace] = useState<WorkspaceData>({ name: null, picture: null })
  const [news, setNews] = useState(0)
  useEffect(() => {
    if (me) setWorkspace(me.workspace)
  }, [me])
  useEffect(() => {
    if (version < 0) return
    if (inActivity) {
      setNews(0)
      api.post('/api/activity/seen').catch(() => undefined)
      return
    }
    api.get<{ count: number; marked: boolean }>('/api/activity/new').then(
      (r) => {
        setNews(r.count)
        if (!r.marked) api.post('/api/activity/seen').catch(() => undefined)
      },
      () => undefined,
    )
  }, [inActivity, version])
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
      news,
      change,
    }),
    [workspace, me, news, change],
  )
}

// A picture the person picked, drawn to a 96px square, so what the core keeps is small.
function squared(f: File): Promise<string> {
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
  const { workspace, owner, signIn, news, change } = useContext(WorkspaceContext)
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
      {news > 0 && (
        <span className="pointer-events-none absolute -top-0.5 left-5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-semibold text-accent-ink text-xs">
          {news > 99 ? '99+' : news}
        </span>
      )}
      <Renamable
        name={label}
        rename={tileOnly || !owner ? null : (to) => change({ name: to.slice(0, 80) })}
      >
        {(start) => (
          <button
            type="button"
            aria-label={news ? `${label}, ${news} new in Activity` : label}
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
            <MenuItem
              hint={news > 0 ? `${news} new` : undefined}
              onClick={() => {
                window.location.hash = '#/settings/activity'
                close()
              }}
            >
              <Activity className="size-3.5 text-ink-3" />
              Activity
            </MenuItem>
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
