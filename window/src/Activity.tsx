// Settings › Activity (Ledger; Kenil's 15, 6 Nov): what waits for the person, then every run of a schedule or a reader and every read of a
// connection, newest first, in one list by day, with Alpha's turns that changed rows, removals
// and reverts (core step 1). A run shows its time, name, module, state, one line of what
// happened, how long it took and whether the model was used; it opens to its steps. Runs that
// changed nothing fold into one line per name and day. A running one can be stopped; one that
// wrote rows has Revert behind its ⋮, a removal Bring back, both said first in the one pop-up.
import type { CardView, RunView, UndoView } from '@alpha/core/api'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { startAsk } from './ask.ts'
import { CardBox } from './CardBox.tsx'
import { RUN_STATE } from './runState.ts'
import { usdWords } from './Usage.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Cut, Cuts } from './ui/cut.tsx'
import { Confirm } from './ui/dialog.tsx'
import { More } from './ui/more.tsx'
import { Pill } from './ui/pill.tsx'
import { MenuItem } from './ui/popover.tsx'
import { Section } from './ui/section.tsx'

// a run's time in the mono column: 24-hour, so it never wraps
const time = (at: string) =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })

function took(ms: number | null): string {
  if (ms === null) return ''
  if (ms < 1000) return 'under a second'
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
}

function dayOf(at: string): string {
  const d = new Date(at)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

type Line = { kind: 'run'; run: RunView } | { kind: 'quiet'; latest: RunView; more: number }

// A day's runs, with the quiet ones of each name folded into one line where the latest was.
function fold(runs: RunView[]): Line[] {
  const quiet = new Map<string, RunView[]>()
  for (const r of runs) if (r.quiet) quiet.set(r.name, [...(quiet.get(r.name) ?? []), r])
  const out: Line[] = []
  const shown = new Set<string>()
  for (const r of runs) {
    if (!r.quiet) out.push({ kind: 'run', run: r })
    else if (!shown.has(r.name)) {
      shown.add(r.name)
      const all = quiet.get(r.name) ?? [r]
      out.push(
        all.length === 1 ? { kind: 'run', run: r } : { kind: 'quiet', latest: r, more: all.length },
      )
    }
  }
  return out
}

export function Activity({ version, cards }: { version: number; cards: CardView[] }) {
  const [runs, setRuns] = useState<RunView[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [only, setOnly] = useState<'all' | 'failed'>('all')
  const load = useCallback(() => {
    api.get<RunView[]>('/api/activity').then(setRuns, () => setRuns([]))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])

  const shown = (runs ?? []).filter((r) => only === 'all' || r.state === 'failed')
  const days: [string, RunView[]][] = []
  for (const r of shown) {
    const d = dayOf(r.startedAt)
    const last = days.at(-1)
    if (last && last[0] === d) last[1].push(r)
    else days.push([d, [r]])
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col">
        {cards.length > 0 && (
          <Section title="Waiting for you">
            {cards.map((c) => (
              <CardBox
                key={c.id}
                id={c.id}
                card={c}
                onChange={(card) => startAsk(`About “${card.words.replace(/\?$/, '')}”: `)}
              />
            ))}
          </Section>
        )}
        <div className="flex items-center gap-3">
          <span className="flex-1" />
          {/* cuts of one list, each with its count (Batch D, 66.16) */}
          <Cuts label="Show">
            <Cut on={only === 'all'} count={runs?.length} onClick={() => setOnly('all')}>
              All
            </Cut>
            <Cut
              on={only === 'failed'}
              count={runs?.filter((r) => r.state === 'failed').length}
              onClick={() => setOnly('failed')}
            >
              {RUN_STATE.failed[0]}
            </Cut>
          </Cuts>
        </div>
        {runs && shown.length === 0 && (
          <p className="mt-4 text-ink-2 text-md">
            {only === 'failed'
              ? 'Everything that ran finished.'
              : 'Nothing has run on its own yet. Schedules, readers and connections show their runs here, and Alpha its changes to your tables.'}
          </p>
        )}
        {days.map(([day, list]) => (
          <section key={day}>
            <div className="mt-4.5 mb-2 font-semibold text-ink-3 text-sm">{day}</div>
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              {fold(list).map((l) =>
                l.kind === 'quiet' ? (
                  <div
                    key={`q${l.latest.id}`}
                    className="flex items-center gap-3.5 border-hair border-t bg-canvas px-4 py-2.5 text-ink-3 text-sm first:border-t-0"
                  >
                    <span className="w-12 shrink-0 font-mono">{time(l.latest.startedAt)}</span>
                    <span>
                      {l.latest.name} {l.latest.kind === 'read' ? 'read' : 'ran'} {l.more} times
                      with nothing new
                    </span>
                  </div>
                ) : (
                  <RunRow
                    key={l.run.id}
                    run={l.run}
                    open={open === l.run.id}
                    onOpen={() => setOpen(open === l.run.id ? null : l.run.id)}
                    onStop={() => api.post(`/api/runs/${l.run.id}/stop`).then(load, load)}
                    onUndone={load}
                  />
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export function RunRow({
  run: r,
  open,
  onOpen,
  onStop,
  onUndone,
}: {
  run: RunView
  open: boolean
  onOpen: () => void
  onStop: () => void
  onUndone?: () => void
}) {
  const [state, tone] = RUN_STATE[r.state]
  const words = r.words?.startsWith(`${r.name}: `) ? r.words.slice(r.name.length + 2) : r.words
  const ran = r.kind === 'run' || r.kind === 'read'
  return (
    <div className="border-hair border-t first:border-t-0">
      <div className="group/row grid grid-cols-[48px_1fr_auto_28px] items-start gap-3.5 px-4 py-3 hover:bg-hover">
        {ran ? (
          <a
            href={`#/run/${r.id}`}
            title="Open the run"
            className="pt-0.5 font-mono text-ink-3 text-sm hover:text-ink hover:underline"
          >
            {time(r.startedAt)}
          </a>
        ) : (
          <span className="pt-0.5 font-mono text-ink-3 text-sm">{time(r.startedAt)}</span>
        )}
        <button
          type="button"
          className="min-w-0 text-left"
          onClick={onOpen}
          disabled={!r.steps.length}
        >
          <span className="flex flex-wrap items-center gap-2">
            <b className="font-semibold text-base text-ink">{r.name}</b>
            {r.module && (
              <span className="rounded-sm border border-line px-1.5 text-ink-3 text-xs leading-4.5">
                {r.module}
              </span>
            )}
            {r.state !== 'ok' && <Pill tone={tone}>{state}</Pill>}
            {r.steps.length > 0 && (
              <ChevronRight
                className={cn('size-3.5 text-ink-3 transition-transform', open && 'rotate-90')}
              />
            )}
          </span>
          {words && r.state !== 'running' && (
            <span
              className={cn(
                'mt-0.75 block text-md',
                r.state === 'failed' ? 'text-warn' : 'text-ink-2',
              )}
            >
              {words}
            </span>
          )}
        </button>
        <div className="flex flex-col items-end gap-0.5 text-ink-3 text-sm tabular-nums">
          {r.state === 'running' ? (
            <Button size="sm" onClick={onStop}>
              Stop
            </Button>
          ) : (
            <>
              {ran && (
                <>
                  <span>{took(r.ms)}</span>
                  <span>
                    {r.tokens === null ? 'No model' : `${r.tokens.toLocaleString()} tokens`}
                  </span>
                </>
              )}
              {/* what its uses of the model cost (core plan step 5) */}
              {r.usd !== null && <span>{usdWords(r.usd)}</span>}
            </>
          )}
        </div>
        <Undo run={r} onDone={onUndone} />
      </div>
      {open && r.steps.length > 0 && (
        <ol className="mx-4 mb-3 ml-20.5 flex flex-col gap-1.25 border-line border-t border-dashed pt-2.5">
          {r.steps.map((s) => (
            <li key={s.id} className="grid grid-cols-[64px_1fr] gap-2.5 text-ink-2 text-md">
              <span className="pt-0.5 font-mono text-ink-3 text-xs">
                {new Date(s.at).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                })}
              </span>
              <span className={cn(s.kind === 'told' && 'text-ink')}>{s.words}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// Revert (or Bring back) behind ⋮: the pop-up says what it will do and what it leaves before
// anything happens, from the core's own preview of the same work.
function Undo({ run: r, onDone }: { run: RunView; onDone?: (() => void) | undefined }) {
  const u = r.undo
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<UndoView | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!u) return <span />
  const start = () => {
    setOpen(true)
    setView(null)
    setProblem(null)
    api.post<UndoView>('/api/undo/preview', u.target).then(setView, (e) => setProblem(wordsOf(e)))
  }
  const yes = () => {
    setBusy(true)
    api.post<UndoView>('/api/undo', u.target).then(
      () => {
        setBusy(false)
        setOpen(false)
        onDone?.()
      },
      (e) => {
        setBusy(false)
        setProblem(wordsOf(e))
      },
    )
  }
  return (
    <>
      <More label="More">
        {(close) => (
          <MenuItem
            onClick={() => {
              close()
              start()
            }}
          >
            <RotateCcw className="size-3.5" />
            {u.label}
          </MenuItem>
        )}
      </More>
      <Confirm
        open={open}
        title={u.label === 'Revert' ? `Revert ${u.what}?` : 'Bring these rows back?'}
        yes={u.label}
        busy={busy || !view?.can}
        onClose={() => setOpen(false)}
        onYes={yes}
      >
        {!view && !problem && <p className="text-ink-3 text-md">Working out what it would do…</p>}
        {view && (
          <div className="flex flex-col gap-2 text-md">
            <p className="text-ink">{view.words}</p>
            {view.left.map((l) => (
              <p key={l} className="text-ink-2">
                {l}
              </p>
            ))}
          </div>
        )}
        {problem && <p className="mt-2 text-md text-warn">{problem}</p>}
      </Confirm>
    </>
  )
}
