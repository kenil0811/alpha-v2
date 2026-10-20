// The window: Home (the stream) and a module's tables in a rail beside it (design §14).
import type { LiveEvent, ModuleSummary, Stream, TableView as TableData } from '@alpha/core/api'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity } from './Activity.tsx'
import { api, listen } from './api.ts'
import { applyLive, Home, type Live } from './Home.tsx'
import { Parts } from './Parts.tsx'
import { Settings } from './Settings.tsx'
import { TableView } from './TableView.tsx'
import { cn } from './ui/cn.ts'

type Place =
  | { at: 'home' }
  | { at: 'activity' }
  | { at: 'parts' }
  | { at: 'table'; id: string; row: string | null }
  | { at: 'settings'; open: string | null }

function placeOf(hash: string): Place {
  const m = /^#\/table\/([^/]+)(?:\/([^/]+))?$/.exec(hash)
  if (m?.[1]) return { at: 'table', id: m[1], row: m[2] ?? null }
  const s = /^#\/settings(?:\?connect=([\w-]+))?$/.exec(hash)
  if (s) return { at: 'settings', open: s[1] ?? null }
  if (hash === '#/activity') return { at: 'activity' }
  if (hash === '#/parts') return { at: 'parts' }
  return { at: 'home' }
}

export function Rail({
  modules,
  place,
  name,
}: {
  modules: ModuleSummary[]
  place: Place
  name: string
}) {
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-4 border-r border-rail-line bg-rail px-3 py-4 text-base text-rail-ink-2">
      <div className="px-2 text-ink">Alpha</div>
      <a
        href="#/"
        className={cn(
          'rounded-md px-2 py-1 hover:bg-rail-hover',
          place.at === 'home' && 'bg-rail-sel text-rail-ink shadow-btn',
        )}
      >
        Home
      </a>
      <a
        href="#/activity"
        className={cn(
          '-mt-3 rounded-md px-2 py-1 hover:bg-rail-hover',
          place.at === 'activity' && 'bg-rail-sel text-rail-ink shadow-btn',
        )}
      >
        Activity
      </a>
      {modules.map((m) => (
        <div key={m.id} className="flex flex-col gap-0.5">
          <div className="px-2 text-sm text-ink-3">{m.name}</div>
          {m.tables.map((t) => (
            <a
              key={t.id}
              href={`#/table/${t.id}`}
              className={cn(
                'flex justify-between rounded-md px-2 py-1 hover:bg-rail-hover',
                place.at === 'table' && place.id === t.id && 'bg-rail-sel text-rail-ink shadow-btn',
              )}
            >
              <span>{t.name}</span>
              <span className="text-ink-3">{t.rows}</span>
            </a>
          ))}
        </div>
      ))}
      <div className="mt-auto flex flex-col gap-1">
        <a
          href="#/settings"
          className={cn(
            'rounded-md px-2 py-1 hover:bg-rail-hover',
            place.at === 'settings' && 'bg-rail-sel text-rail-ink shadow-btn',
          )}
        >
          Settings
        </a>
        <div className="px-2 text-sm text-ink-3">{name}</div>
      </div>
    </nav>
  )
}

export function App() {
  const [place, setPlace] = useState<Place>(() => placeOf(window.location.hash))
  const [stream, setStream] = useState<Stream | null>(null)
  const [modules, setModules] = useState<ModuleSummary[]>([])
  const [table, setTable] = useState<TableData | null>(null)
  const [live, setLive] = useState<Live>({})
  const [busyTurn, setBusyTurn] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const placeRef = useRef(place)
  placeRef.current = place

  const refresh = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        api.get<Stream>('/api/stream'),
        api.get<ModuleSummary[]>('/api/modules'),
      ])
      setStream(s)
      setModules(m)
      if (!s.busy) setBusyTurn(null)
      const p = placeRef.current
      if (p.at === 'table') setTable(await api.get<TableData>(`/api/tables/${p.id}`))
      setProblem(null)
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'The core did not answer.')
    }
  }, [])

  useEffect(() => {
    const onHash = () => setPlace(placeOf(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    api.get<{ user: { name: string } }>('/api/me').then(
      (me) => setName(me.user.name),
      () => undefined,
    )
  }, [])

  useEffect(() => {
    if (place.at === 'table')
      api.get<TableData>(`/api/tables/${place.id}`).then(setTable, () => setTable(null))
    else setTable(null)
  }, [place])

  useEffect(
    () =>
      listen((e: LiveEvent) => {
        if (e.type === 'lines') {
          void refresh()
          setVersion((v) => v + 1)
        }
        if (e.type === 'busy') setBusyTurn(e.turn)
        if (e.type === 'idle') {
          setBusyTurn(null)
          void refresh()
        }
        if (e.type === 'live') setLive((l) => applyLive(l, e))
      }),
    [refresh],
  )

  return (
    <div className="flex h-screen bg-canvas text-base text-ink">
      <Rail modules={modules} place={place} name={name} />
      <main className="min-w-0 flex-1">
        {problem && (
          <div className="border-b border-line bg-warn-soft px-6 py-2 text-base text-warn">
            {problem}
          </div>
        )}
        {place.at === 'home' ? (
          <Home stream={stream} live={live} busyTurn={busyTurn} />
        ) : place.at === 'parts' ? (
          <Parts />
        ) : place.at === 'activity' ? (
          <Activity version={version} />
        ) : place.at === 'settings' ? (
          <Settings open={place.open} version={version} />
        ) : table ? (
          <TableView key={table.id} data={table} row={place.at === 'table' ? place.row : null} />
        ) : (
          <p className="p-6 text-ink-3">That table is not there.</p>
        )}
      </main>
    </div>
  )
}
