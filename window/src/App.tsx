// The window (design §14): the rail, a bar over each screen, the screen (Home, Activity, Settings
// or a module: its tables, conversation, agents and notes) and the assistant on the right of every
// screen but the whole conversation's own, through the module's lens on a module's screen. ⌘J
// folds it and opens it again (Vikas, 25 Oct: Bridge's and Alpha Brain's frame).
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
  ListChecks,
  MessageSquare,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity } from './Activity.tsx'
import { Assistant } from './Assistant.tsx'
import { api, listen, wordsOf } from './api.ts'
import { applyLive, Conversation, type Live } from './Conversation.tsx'
import { FileView } from './FileView.tsx'
import { Home } from './Home.tsx'
import { ModuleScreen } from './Module.tsx'
import { Parts } from './Parts.tsx'
import { People } from './People.tsx'
import { Settings } from './Settings.tsx'
import { Bar, type Crumb, Find, type Place, Rail } from './Shell.tsx'
import type { Module } from './stream.ts'
import { TableView } from './TableView.tsx'
import { Tasks } from './Tasks.tsx'
import { titleOf } from './table/values.ts'
import { applyTheme } from './theme.ts'
import { ancestors, inside } from './tree.ts'

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
  const tk = /^#\/tasks(?:\/([\w-]+)|\?list=(\w+))?$/.exec(hash)
  if (tk)
    return {
      at: 'tasks',
      list:
        (tk[2] as
          | 'today'
          | 'week'
          | 'overdue'
          | 'waiting'
          | 'agents'
          | 'open'
          | 'done'
          | undefined) ?? 'today',
      id: tk[1] ?? null,
    }
  const pp = /^#\/people(?:\/([\w-]+)|\?(companies))?$/.exec(hash)
  if (pp) return { at: 'people', kind: pp[2] ? 'company' : 'person', id: pp[1] ?? null }
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
  const [personName, setPersonName] = useState('')
  const [taskName, setTaskName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [finding, setFinding] = useState(false)
  // a topic chip's lens: the conversation keeps to one module until it is cleared
  const [lens, setLens] = useState<Module>(null)
  // the assistant on the right: open unless the person folded it, kept in this browser
  const [asking, setAsking] = useState(() => {
    try {
      return localStorage.getItem('alpha.assistant') !== 'folded'
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('alpha.assistant', asking ? 'open' : 'folded')
    } catch {
      // a browser that keeps nothing opens it each time
    }
  }, [asking])
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
  // the modules a screen's module sits inside, each opening its own screen
  const above = moduleHere
    ? ancestors(modules, moduleHere.id).map((m) => ({ label: m.name, href: `#/module/${m.id}` }))
    : []
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
      setProblem(wordsOf(err))
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
  const at = (label: string, href?: string) => ({ label, href })
  const crumb: Crumb =
    place.at === 'activity'
      ? { icon: <ActivityIcon className={icon} />, parts: [at('Activity')] }
      : place.at === 'tasks'
        ? {
            icon: <ListChecks className={icon} />,
            parts: place.id ? [at('Tasks', '#/tasks'), at(taskName || '…')] : [at('Tasks')],
          }
        : place.at === 'people'
          ? {
              icon: <Users className={icon} />,
              parts: place.id
                ? [at('People', '#/people'), at(personName || '…')]
                : place.kind === 'company'
                  ? [at('People', '#/people'), at('Companies')]
                  : [at('People')],
            }
          : place.at === 'conversation'
            ? { icon: <MessageSquare className={icon} />, parts: [at('Conversation')] }
            : place.at === 'settings'
              ? { icon: <SlidersHorizontal className={icon} />, parts: [at('Settings')] }
              : place.at === 'parts'
                ? { parts: [at('Parts')] }
                : place.at === 'file'
                  ? {
                      icon: <FileText className={icon} />,
                      parts: [at('Documents'), at(fileName || '…')],
                    }
                  : place.at === 'table'
                    ? {
                        icon: <Briefcase className={icon} />,
                        parts: table
                          ? [
                              ...above,
                              at(table.module.name, `#/module/${table.module.id}`),
                              // with a row open, the table's name closes it
                              place.row ? at(table.name, `#/table/${table.id}`) : at(table.name),
                              ...(place.row
                                ? [
                                    at(
                                      (() => {
                                        const r = table.rows.find((x) => x.id === place.row)
                                        return r ? titleOf(table.fields, r) : '…'
                                      })(),
                                    ),
                                  ]
                                : []),
                            ]
                          : [at('…')],
                      }
                    : place.at === 'module'
                      ? {
                          icon: <Briefcase className={icon} />,
                          parts: [
                            ...above,
                            at(moduleHere?.name ?? '…', `#/module/${place.id}`),
                            at(
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
                            ),
                          ],
                        }
                      : { icon: <House className={icon} />, parts: [at('Home')] }

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
        onNew={() => setAsking(true)}
        tasksDue={(stream?.tasks.today ?? 0) + (stream?.tasks.overdue ?? 0)}
        online={!problem}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <Bar
          crumb={crumb}
          onFind={() => setFinding(true)}
          lens={place.at === 'conversation' ? lens : null}
          onClearLens={() => setLens(null)}
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
            ) : place.at === 'tasks' ? (
              <Tasks list={place.list} id={place.id} version={version} onName={setTaskName} />
            ) : place.at === 'people' ? (
              <People kind={place.kind} id={place.id} version={version} onName={setPersonName} />
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
        </div>
      </main>
      {askable && (
        <Assistant
          folded={!asking}
          onFold={(f) => setAsking(!f)}
          title={moduleHere ? `Ask about ${moduleHere.name}` : 'Alpha'}
          mood={stream?.cards.length ? 'needs' : busyTurn || stream?.busy ? 'working' : 'quiet'}
          running={(stream?.running.length ?? 0) + (stream?.reading.length ?? 0)}
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
        </Assistant>
      )}
      {finding && <Find modules={modules} onClose={() => setFinding(false)} />}
    </div>
  )
}
