// The window (design §14): the rail, a bar over each screen, and the screen: Home (the important
// things), the Conversation, Activity, Settings or a module (its tables, conversation, agents and
// notes). Ask (⌘J) opens the conversation on the right of any other screen, through the module's
// lens on a module's screen.
import type {
  Layout,
  LiveEvent,
  Me,
  ModuleSummary,
  Stream,
  TableView as TableData,
} from '@alpha/core/api'
import {
  Activity as ActivityIcon,
  Briefcase,
  FileText,
  House,
  MessageSquare,
  SlidersHorizontal,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity } from './Activity.tsx'
import { api, listen } from './api.ts'
import { applyLive, Conversation, type Live } from './Conversation.tsx'
import { FileView } from './FileView.tsx'
import { Home } from './Home.tsx'
import { ModuleScreen } from './Module.tsx'
import { Parts } from './Parts.tsx'
import { Settings } from './Settings.tsx'
import { Bar, type Crumb, Find, type Place, Rail } from './Shell.tsx'
import type { Module } from './stream.ts'
import { TableView } from './TableView.tsx'
import { applyTheme } from './theme.ts'
import { ancestors, inside } from './tree.ts'
import { SidePanel } from './ui/side-panel.tsx'

function placeOf(hash: string): Place {
  const m = /^#\/table\/([^/?]+)(?:\/([^/?]+))?(?:\?(.*))?$/.exec(hash)
  if (m?.[1]) {
    // ?only=<rows> (the rows a page counted), ?field=<name> (that value's panel)
    const query = new URLSearchParams(m[3] ?? '')
    const only = query.get('only')
    return {
      at: 'table',
      id: m[1],
      row: m[2] ?? null,
      only: only ? only.split(',').filter(Boolean) : null,
      field: query.get('field'),
    }
  }
  const f = /^#\/file\/([0-9a-f]{16,})(?:\?(.*))?$/.exec(hash)
  if (f?.[1]) {
    const q = new URLSearchParams(f[2] ?? '')
    const box = q.get('box')?.split(',').map(Number)
    return {
      at: 'file',
      place: {
        hash: f[1],
        sheet: q.get('sheet'),
        cell: q.get('cell'),
        page: q.get('page') ? Number(q.get('page')) : null,
        box:
          box?.length === 4 && box.every(Number.isFinite)
            ? (box as [number, number, number, number])
            : null,
        line: q.get('line') ? Number(q.get('line')) : null,
      },
    }
  }
  const s = /^#\/settings(?:\?connect=([\w-]+))?$/.exec(hash)
  if (s) return { at: 'settings', open: s[1] ?? null }
  if (hash === '#/activity') return { at: 'activity' }
  if (hash === '#/conversation') return { at: 'conversation' }
  if (hash === '#/parts') return { at: 'parts' }
  const mod = /^#\/module\/([^/]+)(?:\/(overview|conversation|agents|page\/([\w-]+)))?$/.exec(hash)
  if (mod?.[1])
    return {
      at: 'module',
      id: mod[1],
      tab:
        mod[2] === 'overview' || mod[2] === 'conversation' || mod[2] === 'agents' ? mod[2] : null,
      page: mod[3] ?? null,
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
  const [fileName, setFileName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [finding, setFinding] = useState(false)
  // a topic chip's lens: the conversation keeps to one module until it is cleared
  const [lens, setLens] = useState<Module>(null)
  // Ask (⌘J): the conversation on the right of any screen but the conversation's own
  const [asking, setAsking] = useState(false)
  // how the person left the window: the rail, its folds, the side conversation's width
  const [layout, setLayout] = useState<Layout>({ railFolded: false, folded: [], panel: null })
  const changeLayout = useCallback((change: Partial<Layout>) => {
    setLayout((l) => ({ ...l, ...change }))
    api.post('/api/layout', change).catch(() => undefined)
  }, [])
  const placed: Module =
    place.at === 'module'
      ? (modules.find((m) => m.id === place.id) ?? null)
      : place.at === 'table' && table
        ? table.module
        : null
  // a module's lens takes in the modules inside it
  const moduleHere: Module = useMemo(
    () => placed && { id: placed.id, name: placed.name, ids: inside(modules, placed.id) },
    [placed?.id, placed?.name, modules, placed],
  )
  const above = moduleHere ? ancestors(modules, moduleHere.id).map((m) => m.name) : []
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

  // ⌘K opens Find anywhere; ⌘\ folds the rail or opens it
  const foldedRef = useRef(layout.railFolded)
  foldedRef.current = layout.railFolded
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setFinding((f) => !f)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        changeLayout({ railFolded: !foldedRef.current })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [changeLayout])
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
        setLayout(me.layout)
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
            : place.at === 'file'
              ? { icon: <FileText className={icon} />, parts: ['Documents', fileName || '…'] }
              : place.at === 'table'
                ? {
                    icon: <Briefcase className={icon} />,
                    parts: table ? [...above, table.module.name, table.name] : ['…'],
                  }
                : place.at === 'module'
                  ? {
                      icon: <Briefcase className={icon} />,
                      parts: [
                        ...above,
                        moduleHere?.name ?? '…',
                        place.tab === 'agents'
                          ? 'Agents and notes'
                          : place.tab === 'conversation'
                            ? 'Conversation'
                            : place.tab === 'overview' ||
                                (!place.page && modules.some((x) => x.parent === place.id))
                              ? 'Overview'
                              : (modules
                                  .find((x) => x.id === place.id)
                                  ?.pages.find((p) =>
                                    place.page ? p.name === place.page : p.front,
                                  )?.title ?? '…'),
                      ],
                    }
                  : { icon: <House className={icon} />, parts: ['Home'] }

  return (
    <div className="flex h-screen bg-canvas text-base text-ink">
      <Rail
        modules={modules}
        place={place}
        here={moduleHere?.id ?? null}
        layout={layout}
        onLayout={changeLayout}
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
            ) : place.at === 'file' ? (
              <FileView place={place.place} onName={setFileName} />
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
                      : place.page
                        ? { kind: 'page', name: place.page }
                        : null
                }
                version={version}
                table={table}
                renderTable={(t) => (
                  <TableView
                    key={t.id}
                    data={t}
                    row={place.at === 'table' ? place.row : null}
                    only={place.at === 'table' ? place.only : null}
                    field={place.at === 'table' ? place.field : null}
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
              width={layout.panel}
              onWidth={(panel) => changeLayout({ panel })}
              full={moduleHere ? `#/module/${moduleHere.id}/conversation` : '#/conversation'}
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
