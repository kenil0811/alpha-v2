// The window (design §14): the rail, a bar over each screen, and the screen: Home (the stream),
// Activity, Settings or a module's table.
import type { LiveEvent, ModuleSummary, Stream, TableView as TableData } from '@alpha/core/api'
import { Activity as ActivityIcon, Briefcase, House, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity } from './Activity.tsx'
import { api, listen } from './api.ts'
import { applyLive, Home, type Live } from './Home.tsx'
import { Parts } from './Parts.tsx'
import { Settings } from './Settings.tsx'
import { Bar, type Crumb, Find, type Place, Rail } from './Shell.tsx'
import type { Module } from './stream.ts'
import { TableView } from './TableView.tsx'

function placeOf(hash: string): Place {
  const m = /^#\/table\/([^/]+)(?:\/([^/]+))?$/.exec(hash)
  if (m?.[1]) return { at: 'table', id: m[1], row: m[2] ?? null }
  const s = /^#\/settings(?:\?connect=([\w-]+))?$/.exec(hash)
  if (s) return { at: 'settings', open: s[1] ?? null }
  if (hash === '#/activity') return { at: 'activity' }
  if (hash === '#/parts') return { at: 'parts' }
  return { at: 'home' }
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
  const [finding, setFinding] = useState(false)
  // a topic chip's lens: Home keeps to one module until it is cleared
  const [lens, setLens] = useState<Module>(null)

  // ⌘K opens Find anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setFinding((f) => !f)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
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

  const icon = 'size-3.25'
  const crumb: Crumb =
    place.at === 'activity'
      ? { icon: <ActivityIcon className={icon} />, parts: ['Activity'] }
      : place.at === 'settings'
        ? { icon: <SlidersHorizontal className={icon} />, parts: ['Settings'] }
        : place.at === 'parts'
          ? { parts: ['Parts'] }
          : place.at === 'table'
            ? {
                icon: <Briefcase className={icon} />,
                parts: table ? [table.module.name, table.name] : ['…'],
              }
            : { icon: <House className={icon} />, parts: ['Home'] }

  return (
    <div className="flex h-screen bg-canvas text-base text-ink">
      <Rail
        modules={modules}
        place={place}
        name={name}
        waiting={stream?.cards.length ?? 0}
        running={stream?.running.length ?? 0}
        online={!problem}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <Bar
          crumb={crumb}
          onFind={() => setFinding(true)}
          lens={place.at === 'home' ? lens : null}
          onClearLens={() => setLens(null)}
        />
        {problem && (
          <div className="border-line border-b bg-warn-soft px-6 py-2 text-md text-warn">
            {problem}
          </div>
        )}
        <div className="min-h-0 flex-1">
          {place.at === 'home' ? (
            <Home stream={stream} live={live} busyTurn={busyTurn} lens={lens} onLens={setLens} />
          ) : place.at === 'parts' ? (
            <Parts />
          ) : place.at === 'activity' ? (
            <Activity version={version} />
          ) : place.at === 'settings' ? (
            <Settings open={place.open} version={version} />
          ) : table ? (
            <TableView key={table.id} data={table} row={place.row} />
          ) : (
            <p className="p-6 text-ink-3">That table is not there.</p>
          )}
        </div>
      </main>
      {finding && <Find modules={modules} onClose={() => setFinding(false)} />}
    </div>
  )
}
