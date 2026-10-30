// The window (design §14): the rail, a bar over each screen, the screen (Home, Activity, Settings
// or a module: its tables, conversation, agents and notes) and the assistant on the right of every
// screen but the whole conversation's own, through the module's lens on a module's screen. ⌘J
// folds it and opens it again (Vikas, 25 Oct).
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
  Bot,
  Brain,
  Briefcase,
  FileText,
  House,
  ListChecks,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity } from './Activity.tsx'
import { Assistant } from './Assistant.tsx'
import { api, listen, wordsOf } from './api.ts'
import { CardPage } from './CardPage.tsx'
import { Agents, applyLive, Conversation, type Live } from './Conversation.tsx'
import { FileView } from './FileView.tsx'
import { Home } from './Home.tsx'
import { ItemPage } from './Items.tsx'
import { LayoutContext, NO_LAYOUT } from './layout.ts'
import { Marker } from './Mark.tsx'
import { ModuleScreen } from './Module.tsx'
import { NewAgent, NewModule } from './NewModule.tsx'
import { signalOf } from './Overview.tsx'
import { Parts } from './Parts.tsx'
import { Peek, usePeek } from './Peek.tsx'
import { People } from './People.tsx'
import { RowPage, type RowPlace } from './RowPage.tsx'
import { alphaOf, Settings } from './Settings.tsx'
import {
  Bar,
  BarMiddle,
  type Crumb,
  DOCK_MAX,
  Find,
  network,
  type Place,
  Rail,
  Signals,
} from './Shell.tsx'
import type { Module } from './stream.ts'
import { TableView } from './TableView.tsx'
import { Tasks } from './Tasks.tsx'
import { titleOf } from './table/values.ts'
import { applyTextSize, applyTheme } from './theme.ts'
import { ancestors, inside } from './tree.ts'
import { type Signal, strongest } from './ui/dot.tsx'
import { setFoldLines } from './ui/fold.tsx'

export function placeOf(hash: string): Place {
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
      why: query.get('why'),
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
  // a #/settings?connect= link lands on the connection, in Settings (Vikas, 28 Oct)
  const c = /^#\/settings\?connect=([\w-]+)$/.exec(hash)
  if (c) return { at: 'settings', section: 'connections', open: c[1] ?? null }
  // Usage for one agent: its Cost on the Agents list and on its page open here
  const u = /^#\/settings\/usage\?agent=([\w-]+)$/.exec(hash)
  if (u) return { at: 'settings', section: 'usage', open: u[1] ?? null }
  const s = /^#\/(settings|intelligence)(?:\/(\w+))?$/.exec(hash)
  // Permissions and Governance moved from Intelligence to Settings: an old link still lands there
  if (s)
    return s[1] === 'settings' || s[2] === 'permissions' || s[2] === 'governance'
      ? { at: 'settings', section: s[2] ?? null, open: null }
      : { at: 'intelligence', section: s[2] ?? null, open: null }
  if (hash === '#/activity') return { at: 'activity' }
  const tk = /^#\/tasks(?:\/([\w-]+)|\?list=(\w+)(?:&agent=[\w-]+)?)?$/.exec(hash)
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
  const talk = /^#\/conversation(?:\/([\w-]+))?$/.exec(hash)
  if (talk) return { at: 'conversation', agent: talk[1] ?? null }
  if (hash === '#/parts') return { at: 'parts' }
  if (hash === '#/module/new') return { at: 'new', what: 'module' }
  // ?module=<id>: from a module's Agents card, that module chosen
  if (/^#\/agent\/new(?:\?module=[\w-]+)?$/.test(hash)) return { at: 'new', what: 'agent' }
  // a row's own page (core step 3b)
  const rw = /^#\/row\/([\w-]+)$/.exec(hash)
  if (rw?.[1]) return { at: 'row', id: rw[1] }
  // a standing permission's old link lands on its rule (core step 2)
  const it = /^#\/(agent|run|rule|permission|card)\/([\w-]+)$/.exec(hash)
  if (it?.[1] && it[2])
    return {
      at: 'item',
      kind: it[1] === 'permission' ? 'rule' : (it[1] as 'agent' | 'run' | 'rule' | 'card'),
      id: it[2],
    }
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
  const peek = usePeek()
  const [stream, setStream] = useState<Stream | null>(null)
  const [modules, setModules] = useState<ModuleSummary[]>([])
  const [table, setTable] = useState<TableData | null>(null)
  const [live, setLive] = useState<Live>({})
  const [busyTurn, setBusyTurn] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [fileName, setFileName] = useState('')
  const [personName, setPersonName] = useState('')
  const [taskName, setTaskName] = useState('')
  const [itemName, setItemName] = useState('')
  const [rowPlace, setRowPlace] = useState<RowPlace | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [finding, setFinding] = useState(false)
  // how the person left the window, kept by Alpha per person: the rail, the assistant, tables
  const [layout, setLayout] = useState<Layout>(NO_LAYOUT)
  const changeLayout = useCallback((change: Partial<Layout>) => {
    setLayout((l) => ({ ...l, ...change }))
    api.post('/api/layout', change).catch(() => undefined)
  }, [])
  const layoutHere = useMemo(() => ({ layout, change: changeLayout }), [layout, changeLayout])
  // the rail's dot beside each module: the strongest signal of what waits in it
  const cards = stream?.cards
  const signals = useMemo(() => {
    const by: Record<string, Signal[]> = {}
    for (const c of cards ?? []) if (c.module) by[c.module] = [...(by[c.module] ?? []), signalOf(c)]
    return Object.fromEntries(
      Object.entries(by).map(([k, v]) => [k, strongest(v) ?? 'opt']),
    ) as Record<string, Signal>
  }, [cards])
  // the assistant on the right: open unless the person folded it
  const asking = layout.assistant !== 'folded'
  const setAsking = useCallback(
    (open: boolean | ((was: boolean) => boolean)) =>
      setLayout((l) => {
        const next = typeof open === 'function' ? open(l.assistant !== 'folded') : open
        const assistant = next ? 'open' : 'folded'
        if (assistant !== l.assistant) api.post('/api/layout', { assistant }).catch(() => undefined)
        return { ...l, assistant }
      }),
    [],
  )
  // the Alpha module is not on the rail: its Decisions and Noticed are in Settings › Governance,
  // and anything that opens it (Home's cards, Find, a link) lands there
  const alpha = alphaOf(modules)
  useEffect(() => {
    if (alpha && place.at === 'module' && place.id === alpha.id)
      window.location.replace('#/settings/governance')
  }, [alpha, place])
  // where a screen puts its switch, in the middle of the bar
  const [middle, setMiddle] = useState<HTMLElement | null>(null)
  const placed: Module =
    place.at === 'module'
      ? (modules.find((m) => m.id === place.id) ?? null)
      : place.at === 'table' && table
        ? table.module
        : place.at === 'people'
          ? network(modules)
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
      // ⌘J, or ⌘⇧\ (the rail's ⌘\ mirrored), folds the assistant or opens it
      const mirrored = e.shiftKey && (e.key === '\\' || e.key === '|')
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key.toLowerCase() === 'j' || mirrored) &&
        askableRef.current
      ) {
        e.preventDefault()
        setAsking((a) => !a)
      }
    }
    const onAsk = () => setAsking(true)
    const onFind = () => setFinding(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('alpha:ask', onAsk)
    window.addEventListener('alpha:find', onFind)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('alpha:ask', onAsk)
      window.removeEventListener('alpha:find', onFind)
    }
  }, [])

  // ⌘K opens Find anywhere; ⌘\ folds the rail or opens it
  const foldedRef = useRef(layout.railFolded)
  foldedRef.current = layout.railFolded
  const panelRef = useRef(layout.panel)
  panelRef.current = layout.panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setFinding((f) => !f)
      }
      // Escape steps the assistant back one level: wide to normal to folded; never while typing or
      // with a pop-up open, which Escape closes first
      if (
        e.key === 'Escape' &&
        !e.defaultPrevented &&
        !typing(e.target) &&
        !document.querySelector('dialog[open]') &&
        askableRef.current
      ) {
        if (panelRef.current) changeLayout({ panel: null })
        else setAsking(false)
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === '\\') {
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
        applyTextSize(me.textSize)
        setLayout(me.layout)
        setLaidOut(true)
        setFoldLines(me.foldLines)
      },
      () => undefined,
    )
  }, [])
  // Nothing is pinned atop the rail to start; past 12 modules Alpha asks once, as a task, whether
  // to pin some (Vikas, 28 Oct). An empty list, not none, marks it asked.
  const [laidOut, setLaidOut] = useState(false)
  useEffect(() => {
    if (!laidOut || layout.docked !== null || modules.length <= DOCK_MAX) return
    changeLayout({ docked: [] })
    void api
      .post('/api/tasks', {
        title: `Pin the places you use most to the top of the rail (right-click one, up to ${DOCK_MAX})`,
      })
      .catch(() => undefined)
  }, [laidOut, layout.docked, modules.length, changeLayout])

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
  // a run's page sits under Activity, an agent's under Intelligence, a rule's under Settings
  const itemCrumb: Crumb | null =
    place.at === 'row'
      ? {
          // a row's page sits under its module and its table, the way back to each
          icon: <Briefcase className={icon} />,
          parts: rowPlace
            ? [
                at(rowPlace.module.name, `#/module/${rowPlace.module.id}`),
                at(rowPlace.table.name, `#/table/${rowPlace.table.id}`),
                at(rowPlace.title),
              ]
            : [at('…')],
        }
      : place.at !== 'item'
        ? null
        : place.kind === 'agent'
          ? {
              icon: <Bot className={icon} />,
              parts: [at('Agents', '#/intelligence/agents'), at(itemName || '…')],
            }
          : place.kind === 'card'
            ? {
                icon: <Bot className={icon} />,
                parts: [at('Agents', '#/conversation'), at(itemName || '…')],
              }
            : place.kind === 'rule'
              ? {
                  icon: <SlidersHorizontal className={icon} />,
                  parts: [at('Settings', '#/settings/permissions'), at(itemName || '…')],
                }
              : {
                  icon: <ActivityIcon className={icon} />,
                  parts: [at('Activity', '#/activity'), at(itemName || '…')],
                }
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
                  ? [at('People', '#/people'), at('Organizations')]
                  : [at('People')],
            }
          : place.at === 'conversation'
            ? { icon: <Bot className={icon} />, parts: [at('Agents')] }
            : place.at === 'settings'
              ? { icon: <SlidersHorizontal className={icon} />, parts: [at('Settings')] }
              : place.at === 'intelligence'
                ? { icon: <Brain className={icon} />, parts: [at('Second Brain')] }
                : place.at === 'parts'
                  ? { parts: [at('Parts')] }
                  : place.at === 'new'
                    ? place.what === 'agent'
                      ? {
                          icon: <Bot className={icon} />,
                          parts: [at('Agents', '#/intelligence/agents'), at('New agent')],
                        }
                      : { icon: <Briefcase className={icon} />, parts: [at('New module')] }
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
                                  place.row
                                    ? at(table.name, `#/table/${table.id}`)
                                    : at(table.name),
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
                                          (!place.page &&
                                            modules.some((x) => x.parent === place.id))
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
    <LayoutContext.Provider value={layoutHere}>
      <Signals.Provider value={signals}>
        <div className="flex h-screen bg-canvas text-base text-ink">
          <Rail
            modules={modules.filter((m) => m !== alpha)}
            place={place}
            here={moduleHere?.id ?? null}
            layout={layout}
            onLayout={changeLayout}
            name={name}
            cards={stream?.cards ?? []}
            signIns={stream?.attention.length ?? 0}
            onNew={() => {
              window.location.hash = '#/module/new'
            }}
            tasksDue={(stream?.tasks.today ?? 0) + (stream?.tasks.overdue ?? 0)}
            online={!problem}
          />
          <main className="flex min-w-0 flex-1 flex-col">
            <Bar
              // no way back inside a module: its tabs are the way around
              crumb={
                place.at === 'module' || place.at === 'table'
                  ? { parts: crumb.parts.slice(-1) }
                  : (itemCrumb ?? crumb)
              }
              lens={null}
              onClearLens={() => undefined}
              middle={setMiddle}
            />
            {problem && (
              <div className="border-line border-b bg-warn-soft px-6 py-2 text-md text-warn">
                {problem}
              </div>
            )}
            <BarMiddle value={middle}>
              <div className="flex min-h-0 flex-1">
                <div className="min-w-0 flex-1">
                  {place.at === 'home' ? (
                    <Home
                      stream={stream}
                      modules={modules}
                      name={name}
                      onAsked={() => setAsking(true)}
                    />
                  ) : place.at === 'conversation' ? (
                    <Agents
                      stream={stream}
                      live={live}
                      busyTurn={busyTurn}
                      agent={place.agent}
                      version={version}
                    />
                  ) : place.at === 'parts' ? (
                    <Parts />
                  ) : place.at === 'new' ? (
                    place.what === 'agent' ? (
                      <NewAgent
                        modules={modules.filter((m) => m.id !== alpha?.id)}
                        onAsked={() => setAsking(true)}
                      />
                    ) : (
                      <NewModule modules={modules} onAsked={() => setAsking(true)} />
                    )
                  ) : place.at === 'file' ? (
                    <FileView place={place.place} onName={setFileName} />
                  ) : place.at === 'activity' ? (
                    <Activity version={version} />
                  ) : place.at === 'row' ? (
                    <RowPage key={place.id} id={place.id} version={version} onPlace={setRowPlace} />
                  ) : place.at === 'item' && place.kind === 'card' ? (
                    <CardPage key={place.id} id={place.id} version={version} onName={setItemName} />
                  ) : place.at === 'item' ? (
                    <ItemPage
                      key={`${place.kind}/${place.id}`}
                      kind={place.kind as 'agent' | 'run' | 'rule'}
                      id={place.id}
                      version={version}
                      onName={setItemName}
                    />
                  ) : place.at === 'tasks' ? (
                    <Tasks list={place.list} id={place.id} version={version} onName={setTaskName} />
                  ) : place.at === 'people' ? (
                    <People
                      kind={place.kind}
                      id={place.id}
                      version={version}
                      net={network(modules)}
                      onName={setPersonName}
                    />
                  ) : place.at === 'settings' || place.at === 'intelligence' ? (
                    <Settings
                      page={place.at}
                      tab={place.section}
                      open={place.open}
                      version={version}
                    />
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
                      cards={stream?.cards ?? []}
                      table={table}
                      renderTable={(t) => (
                        <TableView
                          key={t.id}
                          data={t}
                          row={place.at === 'table' ? place.row : null}
                          only={place.at === 'table' ? place.only : null}
                          why={place.at === 'table' ? place.why : null}
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
                {peek.href && (
                  <Peek
                    href={peek.href}
                    canBack={peek.canBack}
                    onBack={peek.back}
                    onClose={peek.close}
                    version={version}
                    modules={modules}
                    cards={stream?.cards ?? []}
                  />
                )}
              </div>
            </BarMiddle>
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
          <Marker from={moduleHere} />
        </div>
      </Signals.Provider>
    </LayoutContext.Provider>
  )
}

// a key pressed in a field belongs to the field
const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
