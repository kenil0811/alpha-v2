// Set up Alpha's tiles for the person's computer, and the frame every tile is drawn in: one of
// the person's own through Alpha Bridge (paired from the tile), a PC's own (paired by Alpha's app
// itself), and what Alpha Bridge reads there.
import type { ComputersView, ConnectTile } from '@alpha/core/api'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from '../api.ts'
import { ComputerReads } from '../ComputerReads.tsx'
import { Install, lendsWords, mine, Pairing } from '../Computers.tsx'
import { Refusal, useAct } from '../ui/act.tsx'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { cutTip } from '../ui/cut-tip.ts'
import { FRAME } from '../ui/frame.tsx'
import { Info } from '../ui/info.tsx'
import { Tile } from '../ui/list.tsx'
import { Pill } from '../ui/pill.tsx'

// One row's height when nothing is open: its icon, name and one line of what it reads (more in
// its ⓘ), its act at the right; what landed and any form under it.
export function Frame({
  tile: t,
  icon,
  head,
  children,
}: {
  tile: ConnectTile
  icon: ReactNode
  head?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className={cn(FRAME, 'flex min-w-0 flex-col gap-2.5 p-4')}>
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
        <Tile>{icon}</Tile>
        {/* on a phone its act goes under its name on every tile, never beside it */}
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1 font-medium text-ink text-md">
            <span className="truncate">{t.title}</span>
            {t.note && <Info help={t.note} />}
          </h2>
          <p className="truncate text-ink-3 text-sm" {...cutTip(t.reads)}>
            {t.reads}
          </p>
        </div>
        {head && (
          <div className="flex w-full items-center gap-1.5 pl-12 sm:w-auto sm:shrink-0 sm:pl-0">
            {head}
          </div>
        )}
      </div>
      {children}
    </section>
  )
}

// A computer of the person's own, through Alpha Bridge: download it for this computer, pair it
// with a one-time link, and the tile ticks once the computer connects.
export function BridgeTile({ tile: t, icon }: { tile: ConnectTile; icon: ReactNode }) {
  const [view, setView] = useState<ComputersView | null>(null)
  const [made, setMade] = useState<{ link: string; open: string } | null>(null)
  const load = useCallback(() => {
    api.get<ComputersView>('/api/computers').then(setView, () => undefined)
  }, [])
  const { busy, problem, act } = useAct(load)
  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [load])
  const theirs = (view?.computers ?? []).filter((c) => !c.here)
  const downloads = [...(view?.downloads ?? [])].sort((a, b) => Number(mine(b)) - Number(mine(a)))
  const windows = /Windows/.test(navigator.userAgent)
  return (
    <Frame
      tile={t}
      icon={icon}
      head={
        made ? null : (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                setMade(await api.post<{ link: string; open: string }>('/api/computers/link'))
              })
            }
          >
            {theirs.length ? 'Pair another' : 'Pair this computer'}
          </Button>
        )
      }
    >
      {theirs.map((c) => (
        <div key={c.id} className="flex items-center gap-2 text-md">
          <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
          <span className="truncate text-ink-3 text-sm">{lendsWords(c)}</span>
          <Pill tone={c.online ? 'good' : 'neutral'}>{c.online ? 'Online' : 'Offline'}</Pill>
        </div>
      ))}
      <Refusal words={problem} />
      {made && (
        <>
          {downloads.some((d) => d.kind === 'installer') ? (
            <Install link={made.link} open={made.open} downloads={downloads} />
          ) : (
            <Pairing link={made.link} downloads={downloads} />
          )}
          {windows && (
            <p className="text-ink-3 text-sm">
              Windows may say it protected your computer: press More info, then Run anyway.
            </p>
          )}
        </>
      )}
    </Frame>
  )
}

// A PC's own Alpha: the PC itself, paired by the Bridge part of Alpha's own app, so nothing is
// installed; Lend a folder opens the PC's own picker (rules B2), and the tile shows what it lends.
export function OwnPcTile({ tile: t, icon }: { tile: ConnectTile; icon: ReactNode }) {
  const [view, setView] = useState<ComputersView | null>(null)
  const [asked, setAsked] = useState(false)
  const load = useCallback(() => {
    api.get<ComputersView>('/api/computers').then(setView, () => undefined)
  }, [])
  const { busy, problem, act } = useAct(load)
  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [load])
  const pc = view?.computers.find((c) => !c.here)
  return (
    <Frame
      tile={t}
      icon={icon}
      head={
        <Button
          size="sm"
          disabled={busy || !pc?.online}
          onClick={() =>
            void act(async () => {
              if (!pc) return
              await api.post(`/api/computers/${pc.id}/pick`)
              setAsked(true)
            })
          }
        >
          Lend a folder
        </Button>
      }
    >
      {pc ? (
        <div className="flex items-center gap-2 text-md">
          <span className="min-w-0 flex-1 truncate text-ink">{pc.name}</span>
          <span className="truncate text-ink-3 text-sm">{lendsWords(pc)}</span>
          <Pill tone={pc.online ? 'good' : 'neutral'}>{pc.online ? 'Online' : 'Connecting'}</Pill>
        </div>
      ) : (
        <p className="text-ink-3 text-sm">Connecting this PC to Alpha…</p>
      )}
      <Refusal words={problem} />
      {asked && <p className="text-ink-2 text-md">Pick the folder in the window that opened.</p>}
    </Frame>
  )
}

// What Alpha Bridge reads on the person's computer, each turned on from here (rules B2); read again
// every few seconds, so one turned on there too shows as on.
export function ReadsTile({ tile: t, icon }: { tile: ConnectTile; icon: ReactNode }) {
  const [view, setView] = useState<ComputersView | null>(null)
  const load = useCallback(() => {
    api.get<ComputersView>('/api/computers').then(setView, () => undefined)
  }, [])
  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [load])
  const pc = view?.computers.find((c) => c.id === t.computer)
  return (
    <Frame tile={t} icon={icon}>
      {pc && <ComputerReads computer={pc} plain onChange={load} />}
    </Frame>
  )
}
