// The one-at-a-time cards (onboarding design §2, Kenil's yes 2 Nov): one source per card with what
// it reads and what it leaves alone, Allow or Skip, macOS's own question where it asks, then what
// was found here before the next. The Full Disk Access card opens System Settings with Alpha in
// Finder beside it and moves on by itself once Alpha can read.
import {
  Button,
  Card,
  List,
  LoaderCircle,
  openConnection,
  Pill,
  Refusal,
  Row,
  Switch,
  useAct,
  wordsOf,
} from '@alpha/window/kit'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CardView } from '../src/run.ts'
import { onboarding } from './routes.ts'

// Each part's state, as the card says it.
const STATE: Record<string, string> = {
  ready: 'Alpha can read it',
  ask: 'macOS asks when Alpha reads',
  settings: 'Needs a switch in System Settings',
  absent: 'Not on this Mac',
  refused: 'macOS said no',
}

export function Cards({ onDone }: { onDone: () => void }) {
  const [names, setNames] = useState<string[]>([])
  const [at, setAt] = useState<number | null>(null)
  const [view, setView] = useState<CardView | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const act = useAct()
  useEffect(() => {
    onboarding.get<{ names: string[]; next: string | null }>('/cards').then(
      (c) => {
        setNames(c.names)
        setAt(Math.max(0, c.next ? c.names.indexOf(c.next) : 0))
      },
      (err) => setProblem(wordsOf(err)),
    )
  }, [])
  const name = at === null ? null : (names[at] ?? null)
  const load = useCallback(async () => {
    if (!name) return
    try {
      setView(await onboarding.get<CardView>(`/card/${name}`))
    } catch (err) {
      setProblem(wordsOf(err))
    }
  }, [name])
  useEffect(() => {
    setView(null)
    void load()
  }, [load])
  // the Full Disk Access card waits on System Settings, a first read on its rows: looked at again
  // every few seconds; once the card can be read, it is allowed on its own
  const waiting =
    !!view &&
    ((view.connected && !view.ready && view.said === null && view.name === 'safari') ||
      !!view.found?.reading)
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => void load(), 3000)
    return () => clearInterval(t)
  }, [waiting, load])
  const moved = useRef(false)
  const { act: run } = act
  useEffect(() => {
    if (moved.current || view?.name !== 'safari' || !view.connected || !view.ready) return
    if (view.said !== null) return
    moved.current = true
    void run(() => onboarding.post<CardView>('/card/safari/allow').then(setView))
  }, [view, run])

  const post = (what: string) =>
    void act.act(() => onboarding.post<CardView>(`/card/${name}/${what}`).then(setView))
  const next = () => {
    if (at === null) return
    if (at + 1 >= names.length) onDone()
    else setAt(at + 1)
  }

  if (problem) return <Refusal words={problem} />
  if (!view)
    return (
      <div className="flex items-center gap-2 text-ink-2 text-md">
        <LoaderCircle className="size-3.5 animate-spin text-ink-3" />
        Opening the card
      </div>
    )
  // a source this Mac does not have (no Chrome): said, and the card moves on
  const states = Object.values(view.states)
  const absent = view.connected && states.length > 0 && states.every((s) => s === 'absent')
  return (
    <Card label={`${view.at} of ${view.of}`}>
      <div className="font-medium text-ink text-lg">{view.title}</div>
      <div className="text-ink text-md">{view.reads}</div>
      <div className="text-ink-2 text-md">Never: {view.never}</div>
      {absent && <div className="text-ink-2 text-md">{view.title} is not on this Mac.</div>}

      {view.name === 'mail' && view.said === null && (
        <List>
          {(view.mail ?? []).map((m) => (
            <Row
              key={m.name}
              title={m.title}
              actions={
                m.connected ? (
                  <Pill tone="good">Connected</Pill>
                ) : (
                  <Button size="sm" onClick={() => openConnection(m.name)}>
                    Connect
                  </Button>
                )
              }
            />
          ))}
        </List>
      )}

      {view.connected && Object.keys(view.states).length > 0 && !view.found && (
        <div className="flex flex-col gap-1 text-sm">
          {Object.entries(view.states).map(([part, s]) => (
            <div key={part} className={s === 'ready' ? 'text-good' : 'text-ink-2'}>
              {part.charAt(0).toUpperCase() + part.slice(1).replace('-', ' ')}: {STATE[s] ?? s}
            </div>
          ))}
        </div>
      )}

      {view.found && <Found card={view} onChange={setView} />}
      {view.said === 'skipped' && (
        <div className="text-ink-3 text-sm">Skipped: Alpha leaves it alone.</div>
      )}
      <Refusal words={view.problem ?? act.problem ?? null} />

      <div className="flex flex-wrap items-center gap-2">
        {view.said === null && !absent && (
          <>
            {view.name === 'safari' && view.connected && !view.ready ? (
              <Button variant="primary" disabled={act.busy} onClick={() => post('settings')}>
                Open System Settings
              </Button>
            ) : (
              <Button variant="primary" disabled={act.busy} onClick={() => post('allow')}>
                {view.name === 'mail' ? 'Done' : 'Allow'}
              </Button>
            )}
            <Button disabled={act.busy} onClick={() => post('skip')}>
              Skip
            </Button>
          </>
        )}
        {(view.said !== null || absent) && (
          <Button variant="primary" disabled={act.busy} onClick={next}>
            {at !== null && at + 1 >= names.length ? 'Done' : 'Next'}
          </Button>
        )}
        {view.said === 'skipped' && (
          <Button variant="ghost" disabled={act.busy} onClick={() => post('allow')}>
            Allow instead
          </Button>
        )}
        {waiting && view.name === 'safari' && (
          <span className="flex items-center gap-1.5 text-ink-3 text-sm">
            <LoaderCircle className="size-3.5 animate-spin" />
            Alpha moves on by itself once it can read
          </span>
        )}
      </div>
    </Card>
  )
}

// What the card found, with a tick on each site or folder: unticked, it is never read.
function Found({ card, onChange }: { card: CardView; onChange: (v: CardView) => void }) {
  const act = useAct()
  const f = card.found
  if (!f) return null
  return (
    <div className="flex flex-col gap-2">
      {f.reading && (
        <div className="flex items-center gap-2 text-ink-2 text-md">
          <LoaderCircle className="size-3.5 animate-spin text-ink-3" />
          Reading on this Mac
        </div>
      )}
      {f.lines.map((l) => (
        <div key={l} className="text-ink text-md">
          {l}
        </div>
      ))}
      {f.ticks && f.ticks.length > 0 && (
        <List className="max-h-80 overflow-y-auto">
          {f.ticks.map((t) => (
            <Row
              key={t.item}
              title={t.item}
              sub={t.sub}
              actions={
                <Switch
                  checked={t.on}
                  label={t.on ? 'Counted: switch off to leave it out' : 'Left out'}
                  disabled={act.busy}
                  onChange={(on) =>
                    void act.act(() =>
                      onboarding
                        .post<CardView>(`/card/${card.name}/tick`, { item: t.item, on })
                        .then(onChange),
                    )
                  }
                />
              }
            />
          ))}
        </List>
      )}
      <Refusal words={act.problem} />
    </div>
  )
}
