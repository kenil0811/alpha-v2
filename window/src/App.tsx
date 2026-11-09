// The window (design §14): the rail, a bar over each screen, the screen (Home, Settings or a
// module: its pages, tables and Setup) and the assistant on the right of every
// screen but the whole conversation's own, knowing which module's screen it is on. ⌘J
// folds it and opens it again (Vikas, 25 Oct).
import type {
  Layout,
  LiveEvent,
  Me,
  ModuleSummary,
  Stream,
  TableView as TableData,
} from '@alpha/core/api'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AgentPage, AgentPicker, AgentRail, CHIEF, useAgents } from './Agents.tsx'
import { Assistant } from './Assistant.tsx'
import { api, listen, wordsOf } from './api.ts'
import { CardPage } from './CardPage.tsx'
import { applyLive, Conversation, type Live } from './Conversation.tsx'
import { FileView } from './FileView.tsx'
import { Find } from './Find.tsx'
import { Home } from './Home.tsx'
import { ItemPage } from './Items.tsx'
import { LayoutContext, NO_LAYOUT } from './layout.ts'
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
import { Settings } from './Settings.tsx'
import { Bar, BarMiddle, network, Rail } from './Shell.tsx'
import { moduleSignals } from './signals.ts'
import type { Module } from './stream.ts'
import { TableView } from './TableView.tsx'
import { Tasks } from './Tasks.tsx'
import { titleOf } from './table/values.ts'
import { applyTheme } from './theme.ts'
import { inside } from './tree.ts'

export function App() {
  const [place, setPlace] = useState<Place>(() => placeOf(window.location.hash))
  const [stream, setStream] = useState<Stream | null>(null)
  const [modules, setModules] = useState<ModuleSummary[]>([])
  const [table, setTable] = useState<TableData | null>(null)
  const [live, setLive] = useState<Live>({})
  const [busyTurn, setBusyTurn] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [owner, setOwner] = useState(true) // a member does not set Alpha up
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
  // the assistant on the right: open unless the person folded it
  const asking = layout.assistant !== 'folded'
  // room beside the page for a row, a task, a run or a person with the assistant open (Batch A)
  const windowWidth = useWindowWidth()
  const room = roomBeside(windowWidth, layout, asking)
  // a task, a run, a person or a row open beside the page, from the address (Batch A, pick 2)
  const { base: besideBase, opened } = splitBeside(window.location.hash)
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
  const askable = place.at !== 'conversation'
  // the agent the assistant shows, kept per person; the Chief of staff when it has gone
  const agents = useAgents(version)
  const asked = layout.agent ?? CHIEF
  const chosen = agents.some((a) => a.id === asked) ? asked : CHIEF
  const agentHere = agents.find((a) => a.id === chosen) ?? null
  const pickAgent = useCallback((id: string) => changeLayout({ agent: id }), [changeLayout])
  const chosenRef = useRef(chosen)
  chosenRef.current = chosen
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
        api.get<Stream>(
          `/api/stream${chosenRef.current === CHIEF ? '' : `?agent=${chosenRef.current}`}`,
        ),
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
        setOwner(me.user.role === 'owner')
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
        // what is under way shows only in that agent's own conversation
        const here = e.type === 'lines' || (e.agent ?? CHIEF) === chosenRef.current
        if (e.type === 'busy' && here) setBusyTurn(e.turn)
        if (e.type === 'idle') {
          if (here) setBusyTurn(null)
          void refresh()
        }
        if (e.type === 'live' && here) setLive((l) => applyLive(l, e))
      }),
    [refresh],
  )

  // another agent chosen: its conversation, with nothing under way carried over
  useEffect(() => {
    if (!chosen) return
    setBusyTurn(null)
    setLive({})
    void refresh()
  }, [chosen, refresh])

  // the screen's name, for the bar
  const screenName = (): string => {
    switch (place.at) {
      case 'row':
        return rowPlace?.title ?? '…'
      case 'card':
        return 'Waits for you'
      case 'item':
      case 'agent':
        return itemName || '…'
      case 'tasks':
        return place.id ? taskName || '…' : 'Tasks'
      case 'people':
        if (place.id) return personName || '…'
        return place.kind === 'company' ? 'Organizations' : 'People'
      case 'conversation':
        return 'Conversation'
      case 'settings':
        return 'Settings'
      case 'intelligence':
        return 'Intelligence'
      case 'parts':
        return 'Parts'
      case 'plugin':
        return screenOf(place.name)?.title ?? '…'
      case 'new':
        return 'New module'
      case 'file':
        return fileName || '…'
      case 'table': {
        if (!table) return '…'
        if (!place.row) return table.name
        const r = table.rows.find((x) => x.id === place.row)
        return r ? titleOf(table.fields, r) : '…'
      }
      case 'module': {
        if (place.tab === 'setup') return 'Setup'
        if (place.tab === 'overview' || (!place.page && modules.some((x) => x.parent === place.id)))
          return 'Overview'
        const pages = modules.find((x) => x.id === place.id)?.pages
        return pages?.find((p) => (place.page ? p.name === place.page : p.front))?.title ?? '…'
      }
      default:
        return 'Home'
    }
  }
  return (
    <LayoutContext.Provider value={layoutHere}>
      <div className="flex h-screen bg-canvas text-base text-ink">
        <Rail
          modules={modules}
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
          <Bar name={screenName()} middle={setMiddle} />
          {problem && (
            <div className="border-line border-b bg-warn-soft px-6 py-2 text-md text-warn">
              {problem}
            </div>
          )}
          <BarMiddle value={middle}>
            <div className="flex min-h-0 flex-1">
              <div className="min-w-0 flex-1">
                {place.at === 'home' ? (
                  <Home stream={stream} name={name} owner={owner} onAsked={() => setAsking(true)} />
                ) : place.at === 'conversation' ? (
                  <div className="flex h-full min-h-0">
                    <AgentRail agents={agents} chosen={chosen} onPick={pickAgent} />
                    <div className="min-w-0 flex-1">
                      <Conversation
                        stream={stream}
                        live={live}
                        busyTurn={busyTurn}
                        agent={agentHere}
                        agents={agents}
                      />
                    </div>
                  </div>
                ) : place.at === 'parts' ? (
                  <Parts />
                ) : place.at === 'plugin' ? (
                  <PluginPage name={place.name} />
                ) : place.at === 'new' ? (
                  <NewModule modules={modules} onAsked={() => setAsking(true)} />
                ) : place.at === 'file' ? (
                  <FileView place={place.place} onName={setFileName} />
                ) : place.at === 'agent' ? (
                  <AgentPage id={place.id} version={version} onName={setItemName} />
                ) : place.at === 'row' ? (
                  <RowPage key={place.id} id={place.id} version={version} onPlace={setRowPlace} />
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
                    cards={stream?.cards ?? []}
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
            title={<AgentPicker agents={agents} chosen={chosen} onPick={pickAgent} />}
            mood={stream?.cards.length ? 'needs' : busyTurn || stream?.busy ? 'working' : 'quiet'}
            width={layout.panel}
            onWidth={(panel) => changeLayout({ panel })}
          >
            <Conversation
              stream={stream}
              live={live}
              busyTurn={busyTurn}
              from={moduleHere}
              compact
              agent={agentHere}
              agents={agents}
            />
          </Assistant>
        )}
        {finding && <Find modules={modules} onClose={() => setFinding(false)} />}
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
