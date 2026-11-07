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
  Briefcase,
  FileText,
  House,
  ListChecks,
  MessageSquare,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity } from './Activity.tsx'
import { Assistant } from './Assistant.tsx'
import { api, listen, wordsOf } from './api.ts'
import { useBack } from './back.ts'
import { CardPage } from './CardPage.tsx'
import { applyLive, Conversation, type Live } from './Conversation.tsx'
import { FileView } from './FileView.tsx'
import { Find } from './Find.tsx'
import { Home } from './Home.tsx'
import { ItemPage } from './Items.tsx'
import { LayoutContext, NO_LAYOUT } from './layout.ts'
import { Marker } from './Mark.tsx'
import { ModuleScreen } from './Module.tsx'
import { NewModule } from './NewModule.tsx'
import { OpenedPanel, useOpenBeside } from './OpenedPanel.tsx'
import { splitBeside } from './opened.ts'
import { Parts } from './Parts.tsx'
import { People } from './People.tsx'
import { type Place, placeOf } from './place.ts'
import { screenOf } from './plugin/screens.ts'
import { RowPage, type RowPlace } from './RowPage.tsx'
import { besideWidth, roomBeside, useWindowWidth } from './room.ts'
import { alphaOf, Settings } from './Settings.tsx'
import { Bar, BarMiddle, type Crumb, network, Rail } from './Shell.tsx'
import { moduleSignals } from './signals.ts'
import type { Module } from './stream.ts'
import { TableView } from './TableView.tsx'
import { Tasks } from './Tasks.tsx'
import { titleOf } from './table/values.ts'
import { applyTheme } from './theme.ts'
import { ancestors, inside } from './tree.ts'
import { setFoldLines } from './ui/fold.tsx'

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
  const [itemName, setItemName] = useState('')
  const [rowPlace, setRowPlace] = useState<RowPlace | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [finding, setFinding] = useState(false)
  // a topic chip's lens: the conversation keeps to one module until it is cleared
  const [lens, setLens] = useState<Module>(null)
  // how the person left the window, kept by Alpha per person: the rail, the assistant, tables
  const [layout, setLayout] = useState<Layout>(NO_LAYOUT)
  const changeLayout = useCallback((change: Partial<Layout>) => {
    setLayout((l) => ({ ...l, ...change }))
    api.post('/api/layout', change).catch(() => undefined)
  }, [])
  const layoutHere = useMemo(() => ({ layout, change: changeLayout }), [layout, changeLayout])
  // the assistant on the right: open unless the person folded it
  const asking = layout.assistant !== 'folded'
  // room beside the page for a row, a task, a run or a person with the assistant open (Batch A)
  const windowWidth = useWindowWidth()
  const room = roomBeside(windowWidth, layout, asking)
  // a task, a run, a person or a row open beside the page, from the address (Batch A, pick 2)
  const { base: besideBase, opened, trail } = splitBeside(window.location.hash)
  useOpenBeside(room)
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
  // the Alpha module is not on the rail: its Decisions and Noticed are in Intelligence › Second
  // Brain, and anything that opens it (Home's cards, Find, a link) lands there
  const alpha = alphaOf(modules)
  useEffect(() => {
    if (alpha && place.at === 'module' && place.id === alpha.id)
      window.location.replace('#/intelligence/brain')
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
      // ⌘J, and ⌘⇧\ beside the rail's ⌘\ (Batch D, 79.4), fold the assistant or open it
      const shiftSlash = e.shiftKey && e.code === 'Backslash'
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'j' || shiftSlash)) {
        if (!askableRef.current) return
        e.preventDefault()
        setAsking((a) => !a)
      }
    }
    const onAsk = () => setAsking(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('alpha:ask', onAsk)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('alpha:ask', onAsk)
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
      if ((e.metaKey || e.ctrlKey) && e.key === '\\' && !e.shiftKey) {
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
        setFoldLines(me.foldLines)
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
      : place.at === 'card'
        ? { icon: <House className={icon} />, parts: [at('Home', '#/'), at('Waits for you')] }
        : place.at !== 'item'
          ? null
          : place.kind === 'agent'
            ? {
                icon: <Sparkles className={icon} />,
                parts: [at('Intelligence', '#/intelligence/agents'), at(itemName || '…')],
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
            ? { icon: <MessageSquare className={icon} />, parts: [at('Conversation')] }
            : place.at === 'settings'
              ? { icon: <SlidersHorizontal className={icon} />, parts: [at('Settings')] }
              : place.at === 'intelligence'
                ? { icon: <Sparkles className={icon} />, parts: [at('Intelligence')] }
                : place.at === 'parts'
                  ? { parts: [at('Parts')] }
                  : place.at === 'plugin'
                    ? { parts: [at(screenOf(place.name)?.title ?? '…')] }
                    : place.at === 'new'
                      ? { icon: <Briefcase className={icon} />, parts: [at('New module')] }
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

  const back = useBack(window.location.hash, (itemCrumb ?? crumb).parts.at(-1)?.label ?? '')
  return (
    <LayoutContext.Provider value={layoutHere}>
      <div className="flex h-screen bg-canvas text-base text-ink">
        <Rail
          modules={modules.filter((m) => m !== alpha)}
          place={place}
          here={moduleHere?.id ?? null}
          layout={layout}
          onLayout={changeLayout}
          name={name}
          waiting={stream?.cards.length ?? 0}
          signals={moduleSignals(stream)}
          onNew={() => {
            window.location.hash = '#/module/new'
          }}
          tasksDue={(stream?.tasks.today ?? 0) + (stream?.tasks.overdue ?? 0)}
          online={!problem}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <Bar
            // no way back to a parent inside a module (its tabs are the way around); back to where
            // the person was, wherever they came from (Batch A, pick 1)
            crumb={
              place.at === 'module' || place.at === 'table'
                ? { parts: crumb.parts.slice(-1) }
                : (itemCrumb ?? crumb)
            }
            back={back}
            // a table's name, in the bar on its own screen, is renamed by a double-click (Batch B)
            rename={
              place.at === 'table' && !place.row && table
                ? (to) => api.post(`/api/tables/${table.id}/name`, { name: to })
                : null
            }
            lens={place.at === 'conversation' ? lens : null}
            onClearLens={() => setLens(null)}
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
                  <Conversation
                    stream={stream}
                    live={live}
                    busyTurn={busyTurn}
                    lens={lens}
                    onLens={setLens}
                  />
                ) : place.at === 'parts' ? (
                  <Parts />
                ) : place.at === 'plugin' ? (
                  <PluginPage name={place.name} />
                ) : place.at === 'new' ? (
                  <NewModule modules={modules} onAsked={() => setAsking(true)} />
                ) : place.at === 'file' ? (
                  <FileView place={place.place} onName={setFileName} />
                ) : place.at === 'activity' ? (
                  <Activity version={version} />
                ) : place.at === 'row' ? (
                  <RowPage
                    key={place.id}
                    id={place.id}
                    version={version}
                    modules={modules}
                    onPlace={setRowPlace}
                  />
                ) : place.at === 'card' ? (
                  <CardPage key={place.id} id={place.id} version={version} />
                ) : place.at === 'item' ? (
                  <ItemPage
                    key={`${place.kind}/${place.id}`}
                    kind={place.kind}
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
                    table={table}
                    renderTable={(t, summary) => (
                      <TableView
                        key={t.id}
                        data={t}
                        summary={summary}
                        row={place.at === 'table' ? place.row : null}
                        only={place.at === 'table' ? place.only : null}
                        of={place.at === 'table' ? place.of : null}
                        field={place.at === 'table' ? place.field : null}
                        // one panel beside the page: a page opened beside takes the row's place
                        quiet={(asking && !room) || !!opened}
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
          </BarMiddle>
        </main>
        {opened && room && (
          <OpenedPanel
            opened={opened}
            trail={trail}
            base={besideBase}
            version={version}
            width={besideWidth(windowWidth, layout, asking)}
            onClose={() => {
              window.location.hash = besideBase
            }}
          />
        )}
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
    </LayoutContext.Provider>
  )
}

// a key pressed in a field belongs to the field
const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

// A plugin's own page, or plain words where no plugin of that name is in this window.
function PluginPage({ name }: { name: string }) {
  const Page = screenOf(name)?.Page
  return Page ? <Page /> : <p className="p-8 text-ink-2 text-md">Nothing is here.</p>
}
