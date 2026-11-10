// The window: the rail, a bar over each screen, the screen (Home, Settings or a
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
import { Bar } from './Bar.tsx'
import { CardPage } from './CardPage.tsx'
import { Conversation } from './Conversation.tsx'
import type { Mood } from './Face.tsx'
import { FileView } from './FileView.tsx'
import { Find } from './Find.tsx'
import { Home } from './Home.tsx'
import { ItemPage } from './Items.tsx'
import { LayoutContext, NO_LAYOUT } from './layout.ts'
import { applyLive, clearLive } from './live.ts'
import { ModuleScreen } from './Module.tsx'
import { OpenedPanel, useOpenBeside } from './OpenedPanel.tsx'
import { splitBeside } from './opened.ts'
import { Parts } from './Parts.tsx'
import { People } from './People.tsx'
import { type Place, placeOf } from './place.ts'
import { screenOf } from './plugin/screens.ts'
import { RowPage, type RowPlace } from './RowPage.tsx'
import { besideWidth, roomBeside, useWindowWidth } from './room.ts'
import { Settings } from './Settings.tsx'
import { BarMiddle, network, Rail } from './Shell.tsx'
import { moduleSignals } from './signals.ts'
import type { Module } from './stream.ts'
import { TableView } from './TableView.tsx'
import { Tasks } from './Tasks.tsx'
import { TaskWork } from './TaskThread.tsx'
import { frameOf } from './table/frame.ts'
import { titleOf } from './table/values.ts'
import { applyTheme } from './theme.ts'
import { inside, landingOf } from './tree.ts'
import { SlideIn } from './ui/slide.tsx'
import { Waiting } from './ui/waiting.tsx'

export function App() {
  const [place, setPlace] = useState<Place>(() => placeOf(window.location.hash))
  const [stream, setStream] = useState<Stream | null>(null)
  const [modules, setModules] = useState<ModuleSummary[]>([])
  const [table, setTable] = useState<TableData | null>(null)
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
  // the assistant on the right: closed until the person opens it from Alpha's face (Kenil, 10 Nov)
  const asking = layout.assistant === 'open'
  // room beside the page for a row, a task, a run or a person with the assistant open (Batch A)
  const windowWidth = useWindowWidth()
  const room = roomBeside(windowWidth, layout, asking)
  // a task, a run, a person or a row open beside the page, from the address (Batch A, pick 2)
  const { base: besideBase, opened } = splitBeside(window.location.hash)
  useOpenBeside(room)
  const setAsking = useCallback(
    (open: boolean | ((was: boolean) => boolean)) =>
      setLayout((l) => {
        const next = typeof open === 'function' ? open(l.assistant === 'open') : open
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
  const askable = place.at !== 'conversation' && place.at !== 'work'
  // the module on screen, known from the rail's list at once for a table, so its tabs never wait on
  // the table's own load (Kenil, 10 Nov)
  const moduleHereId =
    place.at === 'module'
      ? place.id
      : place.at === 'table'
        ? (modules.find((x) => x.tables.some((t) => t.id === place.id))?.id ??
          table?.module.id ??
          null)
        : null
  // the table on screen: its own once here, else its frame from what the rail knows, so a move from
  // one table to another keeps the frame and only changes what is in it (Kenil, 10 Nov)
  const tableHere: TableData | null = (() => {
    if (place.at !== 'table') return table
    if (table && table.id === place.id) return table
    const m = modules.find((x) => x.id === moduleHereId)
    const t = m?.tables.find((x) => x.id === place.id)
    return m && t ? frameOf(t.id, t.name, { id: m.id, name: m.name }) : null
  })()
  // the agents' own page closes the assistant, so it never opens again by itself on leaving
  useEffect(() => {
    if (!askable) setAsking(false)
  }, [askable, setAsking])
  const mood: Mood = stream?.cards.length ? 'needs' : busyTurn || stream?.busy ? 'working' : 'quiet'
  // the agent the assistant shows, kept per person; the Chief of staff when it has gone
  const agents = useAgents(version)
  const asked = layout.agent ?? CHIEF
  const chosen = agents.some((a) => a.id === asked) ? asked : CHIEF
  const agentHere = agents.find((a) => a.id === chosen) ?? null
  const pickAgent = useCallback((id: string) => changeLayout({ agent: id }), [changeLayout])
  // New module opens the Module builder's conversation, the Chief of staff's once it has gone
  // (Kenil, 10 Nov)
  const openBuilder = useCallback(() => {
    const go = (id: string) => {
      pickAgent(id)
      window.location.hash = '#/conversation'
    }
    api.get<{ id: string | null }>('/api/agents/builder').then(
      (b) => go(b.id ?? CHIEF),
      () => go(CHIEF),
    )
  }, [pickAgent])
  // an old link to New module's page goes there too
  useEffect(() => {
    if (place.at === 'new') openBuilder()
  }, [place.at, openBuilder])
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

  // a table newly opened: its shape first, drawn at once, its rows alongside (Kenil, 10 Nov)
  const [rowsComing, setRowsComing] = useState(false)
  const rowsFor = useRef<string | null>(null) // the table whose rows are here
  const loadTable = useCallback(async (id: string, opening = false) => {
    const here = () => placeRef.current.at === 'table' && placeRef.current.id === id
    if (opening)
      api.get<TableData>(`/api/tables/${id}?rows=none`).then(
        (shape) => {
          if (!here() || rowsFor.current === id) return
          setTable(shape)
          setRowsComing(true)
        },
        () => undefined,
      )
    try {
      const t = await api.get<TableData>(`/api/tables/${id}`)
      if (!here()) return
      rowsFor.current = id
      setTable(t)
      setRowsComing(false)
    } catch {
      if (!here()) return
      setTable(null)
      setRowsComing(false)
      window.location.hash = '#/'
    }
  }, [])

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
      setProblem(null)
    } catch (err) {
      setProblem(wordsOf(err))
    }
    // the table open now, on its own: one that has gone (deleted, say) sends the person Home rather
    // than standing as a warning over the next screen (Kenil, 10 Nov)
    const p = placeRef.current
    if (p.at === 'table') await loadTable(p.id)
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
        // the assistant starts closed, whatever it was when the window last closed
        setLayout({ ...me.layout, assistant: 'folded' })
      },
      () => undefined,
    )
  }, [])

  useEffect(() => {
    if (place.at !== 'table') {
      rowsFor.current = null
      setTable(null)
      return
    }
    // another table: drawn from its shape while its rows come; the same one is only brought up to date
    const opening = rowsFor.current !== place.id
    if (opening) rowsFor.current = null
    void loadTable(place.id, opening)
  }, [place])

  useEffect(
    () =>
      listen((e: LiveEvent) => {
        if (e.type === 'lines') {
          void refresh()
          setVersion((v) => v + 1)
        }
        // what is under way shows only in that agent's own conversation
        const here = e.type === 'lines' || ((e.agent ?? CHIEF) === chosenRef.current && !e.task)
        if (e.type === 'busy' && here) setBusyTurn(e.turn)
        if (e.type === 'idle') {
          if (here) setBusyTurn(null)
          void refresh()
        }
        if (e.type === 'live') applyLive(e) // kept by turn, so a task's thread can read its own
      }),
    [refresh],
  )

  // another agent chosen: its conversation, with nothing under way carried over
  useEffect(() => {
    if (!chosen) return
    setBusyTurn(null)
    clearLive()
    void refresh()
  }, [chosen, refresh])

  // the page above this one, for the bar's ‹ (Kenil, 10 Nov); none on a page at the top
  const parentOf = (): { label: string; href: string } | null => {
    const HOME = { label: 'Home', href: '#/' }
    // above a module: the module it sits in, where that one opens, else Home
    const aboveModule = (id: string | null): { label: string; href: string } => {
      const up = id ? modules.find((m) => m.id === id)?.parent : null
      const p = up ? modules.find((m) => m.id === up) : null
      return p ? { label: p.name, href: landingOf(modules, p) } : { label: 'Home', href: '#/' }
    }
    switch (place.at) {
      case 'tasks':
        return place.id ? { label: 'Tasks', href: '#/tasks' } : HOME
      case 'work':
        return { label: itemName || 'The task', href: `#/tasks/${place.id}` }
      case 'row':
        return rowPlace && { label: rowPlace.table.name, href: `#/table/${rowPlace.table.id}` }
      // a module's own tables and pages are the module: they go to the module it sits in, else Home
      // (Kenil, 10 Nov: the module's address opened the same table again)
      case 'table':
        if (place.row) return table && { label: table.name, href: `#/table/${place.id}` }
        return aboveModule(moduleHereId)
      case 'module':
        return aboveModule(place.id)
      case 'item':
        return place.kind === 'schedule'
          ? { label: 'Schedules', href: '#/intelligence/schedules' }
          : place.kind === 'run'
            ? { label: 'Activity', href: '#/settings/activity' }
            : { label: 'Permissions', href: '#/settings/permissions' }
      case 'agent':
        return { label: 'Agents', href: '#/conversation' }
      case 'card':
        return { label: 'Home', href: '#/' }
      case 'people':
        if (!place.id) return HOME
        return place.kind === 'company'
          ? { label: 'Organizations', href: '#/people?companies' }
          : { label: 'People', href: '#/people' }
      // every other page goes Home; Home alone has nothing above it (Kenil, 10 Nov)
      case 'home':
        return null
      default:
        return HOME
    }
  }

  // the screen's name, for the bar
  const screenName = (): string => {
    switch (place.at) {
      case 'row':
        return rowPlace?.title ?? ''
      case 'card':
        return 'Waits for you'
      case 'item':
      case 'agent':
      case 'work':
        return itemName || ''
      case 'tasks':
        return place.id ? taskName || '' : 'Tasks'
      case 'people':
        if (place.id) return personName || ''
        return place.kind === 'company' ? 'Organizations' : 'People'
      case 'conversation':
        return agents.find((a) => a.id === chosen)?.name ?? 'Chief of staff'
      case 'settings':
        return 'Settings'
      case 'intelligence':
        return 'Intelligence'
      case 'parts':
        return 'Parts'
      case 'plugin':
        return screenOf(place.name)?.title ?? ''
      case 'new':
        return 'New module'
      case 'file':
        return fileName || ''
      case 'table': {
        if (!table) return ''
        if (!place.row) return table.name
        const r = table.rows.find((x) => x.id === place.row)
        return r ? titleOf(table.fields, r) : ''
      }
      case 'module': {
        if (place.tab === 'setup') return 'Setup'
        if (place.tab === 'overview' || (!place.page && modules.some((x) => x.parent === place.id)))
          return 'Overview'
        const pages = modules.find((x) => x.id === place.id)?.pages
        return pages?.find((p) => (place.page ? p.name === place.page : p.front))?.title ?? ''
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
            openBuilder()
          }}
          tasksDue={(stream?.tasks.today ?? 0) + (stream?.tasks.overdue ?? 0)}
          online={!problem}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <Bar
            name={screenName()}
            middle={setMiddle}
            plain={place.at === 'conversation' || place.at === 'work'}
            ask={askable && !asking ? { mood, open: () => setAsking(true) } : null}
            back={parentOf()}
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
                  <Home stream={stream} name={name} onAsked={() => setAsking(true)} />
                ) : place.at === 'conversation' ? (
                  <div className="flex h-full min-h-0">
                    <AgentRail agents={agents} chosen={chosen} onPick={pickAgent} />
                    <div className="min-w-0 flex-1">
                      <Conversation
                        stream={stream}
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
                ) : place.at === 'new' ? null : place.at === 'file' ? (
                  <FileView place={place.place} onName={setFileName} />
                ) : place.at === 'work' ? (
                  <TaskWork key={place.id} id={place.id} version={version} onName={setItemName} />
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
                ) : moduleHereId ? (
                  <ModuleScreen
                    moduleId={moduleHereId}
                    known={modules.find((x) => x.id === moduleHereId) ?? null}
                    inside={modules.filter((x) => x.parent === moduleHereId).length}
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
                    table={tableHere}
                    renderTable={(t, summary) => (
                      <TableView
                        key={t.id}
                        data={t}
                        loading={rowsComing || (place.at === 'table' && table?.id !== place.id)}
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
                  // a table on its way: nothing to read yet, and never a word that it is not there
                  <Waiting />
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
          <SlideIn open={asking}>
            <Assistant
              onClose={() => setAsking(false)}
              title={<AgentPicker agents={agents} chosen={chosen} onPick={pickAgent} />}
              mood={mood}
              width={layout.panel}
              onWidth={(panel) => changeLayout({ panel })}
            >
              <Conversation
                stream={stream}
                busyTurn={busyTurn}
                from={moduleHere}
                compact
                agent={agentHere}
                agents={agents}
              />
            </Assistant>
          </SlideIn>
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
