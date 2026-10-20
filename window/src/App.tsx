// The window (design §14): the rail, a bar over each screen, and the screen: Home (the important
// things), the Conversation, Activity, Settings or a module (its tables, conversation, agents and
// notes). Ask (⌘J) opens the conversation on the right of any other screen, through the module's
// lens on a module's screen.
import type { LiveEvent, Me, ModuleSummary, Stream, TableView as TableData } from '@alpha/core/api'
import {
  Activity as ActivityIcon,
  Briefcase,
  House,
  MessageSquare,
  SlidersHorizontal,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity } from './Activity.tsx'
import { api, listen } from './api.ts'
import { applyLive, Conversation, type Live } from './Conversation.tsx'
import { Home } from './Home.tsx'
import { ModuleScreen } from './Module.tsx'
import { Parts } from './Parts.tsx'
import { Settings } from './Settings.tsx'
import { Bar, type Crumb, Find, type Place, Rail } from './Shell.tsx'
import type { Module } from './stream.ts'
import { TableView } from './TableView.tsx'
import { applyTheme } from './theme.ts'
import { SidePanel } from './ui/side-panel.tsx'

function placeOf(hash: string): Place {
  const m = /^#\/table\/([^/]+)(?:\/([^/]+))?$/.exec(hash)
  if (m?.[1]) return { at: 'table', id: m[1], row: m[2] ?? null }
  const s = /^#\/settings(?:\?connect=([\w-]+))?$/.exec(hash)
  if (s) return { at: 'settings', open: s[1] ?? null }
  if (hash === '#/activity') return { at: 'activity' }
  if (hash === '#/conversation') return { at: 'conversation' }
  if (hash === '#/parts') return { at: 'parts' }
  const mod = /^#\/module\/([^/]+)(?:\/(conversation|agents))?$/.exec(hash)
  if (mod?.[1])
    return {
      at: 'module',
      id: mod[1],
      tab: (mod[2] as 'conversation' | 'agents' | undefined) ?? null,
    }
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
  // a topic chip's lens: the conversation keeps to one module until it is cleared
  const [lens, setLens] = useState<Module>(null)
  // Ask (⌘J): the conversation on the right of any screen but the conversation's own
  const [asking, setAsking] = useState(false)
  const moduleHere: Module =
    place.at === 'module'
      ? (modules.find((m) => m.id === place.id) ?? null)
      : place.at === 'table' && table
        ? table.module
        : null
  const askable = !(
    place.at === 'conversation' ||
    (place.at === 'module' && place.tab === 'conversation')
  )
  const askableRef = useRef(askable)
  askableRef.current = askable
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j' && askableRef.current) {
        e.preventDefault()
        setAsking((a) => !a)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (!askable) setAsking(false)
  }, [askable])

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
    api.get<Me>('/api/me').then(
      (me) => {
        setName(me.user.name)
        // the look Alpha keeps for this person wins over this browser's copy
        applyTheme(me.theme)
      },
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
      : place.at === 'conversation'
        ? { icon: <MessageSquare className={icon} />, parts: ['Conversation'] }
        : place.at === 'settings'
          ? { icon: <SlidersHorizontal className={icon} />, parts: ['Settings'] }
          : place.at === 'parts'
            ? { parts: ['Parts'] }
            : place.at === 'table'
              ? {
                  icon: <Briefcase className={icon} />,
                  parts: table ? [table.module.name, table.name] : ['…'],
                }
              : place.at === 'module'
                ? {
                    icon: <Briefcase className={icon} />,
                    parts: [
                      moduleHere?.name ?? '…',
                      place.tab === 'agents' ? 'Agents and notes' : 'Conversation',
                    ],
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
          lens={place.at === 'conversation' ? lens : null}
          onClearLens={() => setLens(null)}
          ask={askable ? { name: moduleHere?.name ?? '' } : null}
          onAsk={() => setAsking((a) => !a)}
        />
        {problem && (
          <div className="border-line border-b bg-warn-soft px-6 py-2 text-md text-warn">
            {problem}
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            {place.at === 'home' ? (
              <Home stream={stream} modules={modules} name={name} onAsked={() => setAsking(true)} />
            ) : place.at === 'conversation' ? (
              <Conversation
                stream={stream}
                live={live}
                busyTurn={busyTurn}
                lens={lens}
                onLens={setLens}
              />
            ) : place.at === 'parts' ? (
              <Parts />
            ) : place.at === 'activity' ? (
              <Activity version={version} />
            ) : place.at === 'settings' ? (
              <Settings open={place.open} version={version} />
            ) : place.at === 'module' || table ? (
              <ModuleScreen
                moduleId={place.at === 'module' ? place.id : (table?.module.id ?? '')}
                tab={
                  place.at === 'table'
                    ? { kind: 'table', id: place.id }
                    : place.tab
                      ? { kind: place.tab }
                      : null
                }
                version={version}
                table={table}
                renderTable={(t) => (
                  <TableView
                    key={t.id}
                    data={t}
                    row={place.at === 'table' ? place.row : null}
                    quiet={asking}
                  />
                )}
                conversation={
                  <Conversation
                    stream={stream}
                    live={live}
                    busyTurn={busyTurn}
                    lens={moduleHere}
                    onLens={() => undefined}
                    from={moduleHere}
                  />
                }
              />
            ) : (
              <p className="p-6 text-ink-3">That table is not there.</p>
            )}
          </div>
          {asking && askable && (
            <SidePanel
              title={moduleHere ? `Ask about ${moduleHere.name}` : 'Ask Alpha'}
              onClose={() => setAsking(false)}
            >
              <Conversation
                stream={stream}
                live={live}
                busyTurn={busyTurn}
                lens={moduleHere}
                onLens={() => undefined}
                from={moduleHere}
                compact
              />
            </SidePanel>
          )}
        </div>
      </main>
      {finding && <Find modules={modules} onClose={() => setFinding(false)} />}
    </div>
  )
}
