// A module's Setup, its last tab: all there is to know about a module that is not its pages or
// its tables. Where it comes from, what it is for, its schedules, its setup tables and parts, the
// notes Alpha reads first, what is the person's against the module's own, and Pack it.
// The core calls a module's package a kit; a person never reads that word.
import type { AgentView, Me, ModuleView, ScheduleView, YoursView } from '@alpha/core/api'
import { CalendarClock, Trash2 } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { useAgents } from './Agents.tsx'
import { api, Problem } from './api.ts'
import { ModuleCase } from './ModuleCase.tsx'
import { originWords, when } from './Modules.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Confirm } from './ui/dialog.tsx'
import { Select } from './ui/field.tsx'
import { List, Row } from './ui/list.tsx'
import { More } from './ui/more.tsx'
import { Pill } from './ui/pill.tsx'
import { MenuItem } from './ui/popover.tsx'
import { Switch } from './ui/switch.tsx'
import { Words } from './ui/words.tsx'

// A part of Setup: its title in serif, a grey line saying what it is, its content; no card
// around it.
function Part({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <h2 className="font-medium font-serif text-ink text-xl">{title}</h2>
      <p className="mt-0.5 mb-2.5 text-ink-3 text-sm">{sub}</p>
      {children}
    </section>
  )
}

export function ModuleSetup({ m, onChange }: { m: ModuleView; onChange: () => void }) {
  const [me, setMe] = useState<Me | null>(null)
  useEffect(() => {
    api.get<Me>('/api/me').then(setMe, () => undefined)
  }, [])
  const on = m.schedules.filter((a) => a.state === 'on').length
  const about = [
    m.kit || m.tables.length || !m.modules.length ? originWords(m.kit) : '',
    m.schedules.length ? `${on} schedule${on === 1 ? '' : 's'} on` : '',
    m.modules.length ? `${m.modules.length} module${m.modules.length === 1 ? '' : 's'} inside` : '',
    m.sites ? `reads ${m.sites} site${m.sites === 1 ? '' : 's'}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex max-w-page flex-col gap-7 px-7 py-6">
        {about && <p className="text-ink-3 text-sm">{about}</p>}
        <ModuleCase m={m} onChange={onChange} />
        <Schedules m={m} onChange={onChange} />
        <KitAgents m={m} />
        <Tables m={m} onChange={onChange} />
        <Part
          title="Notes"
          sub={`What Alpha reads about ${m.name} before it works on it; ask Alpha to change them.`}
        >
          <div className="text-md">
            <Words text={m.notes.replace(/^# .*\n+/, '') || 'No notes yet.'} />
          </div>
        </Part>
        {m.kit && <Yours moduleId={m.id} onChange={onChange} />}
        <PackIt m={m} folder={!!m.kit && !!me?.developer && me.user.role === 'owner'} />
      </div>
    </div>
  )
}

// The agents its kit brought, each opening its page; they change with the kit.
function KitAgents({ m }: { m: ModuleView }) {
  const agents = useAgents(0).filter((a) => a.from.module === m.id)
  if (!agents.length) return null
  return (
    <Part title="Agents" sub={`The agents ${m.name} brings. They change with it.`}>
      <List>
        {agents.map((a) => (
          <Row
            key={a.id}
            className="relative hover:bg-canvas"
            title={
              <a href={`#/agent/${a.id}`} className="after:absolute after:inset-0">
                {a.name}
              </a>
            }
            sub={a.title}
          />
        ))}
      </List>
    </Part>
  )
}

function Schedules({ m, onChange }: { m: ModuleView; onChange: () => void }) {
  const agents = useAgents(0)
  return (
    <Part title="Schedules" sub={`What runs on its own in ${m.name}.`}>
      <div className="flex flex-col gap-2">
        {m.schedules.length > 1 && (
          <div className="flex justify-end">
            <AllSchedules moduleId={m.id} schedules={m.schedules} onChange={onChange} />
          </div>
        )}
        {m.schedules.length === 0 ? (
          <p className="text-ink-2 text-md">No schedules yet. Ask Alpha to keep one.</p>
        ) : (
          <List>
            {m.schedules.map((a) => (
              <OneSchedule key={a.id} a={a} agents={agents} onChange={onChange} />
            ))}
          </List>
        )}
      </div>
    </Part>
  )
}

function OneSchedule({
  a,
  agents,
  onChange,
}: {
  a: ScheduleView
  agents: AgentView[]
  onChange: () => void
}) {
  const { busy, problem, act } = useAct(onChange)
  return (
    <Row
      lead={<CalendarClock className="size-4 text-ink-3" />}
      title={
        <a href={`#/schedule/${a.id}`} className="hover:underline">
          {a.name}
        </a>
      }
      sub={`${a.state === 'on' ? 'Runs' : 'Would run'} ${a.when} · last ran ${when(a.lastRunAt)}${
        a.needs ? ` · ${a.needs}` : ''
      }`}
      actions={
        <>
          <Refusal words={problem} />
          {a.running && <Pill tone="accent">Running</Pill>}
          {a.wakes && (
            <Select
              value={a.wakes.id}
              aria-label={`Who ${a.name} wakes`}
              disabled={busy}
              onChange={(e) =>
                act(() => api.post(`/api/schedules/${a.id}/agent`, { agent: e.target.value }))
              }
            >
              {agents.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || a.running}
            onClick={() => act(() => api.post(`/api/schedules/${a.id}/run`))}
          >
            Run now
          </Button>
          <Switch
            checked={a.state === 'on'}
            disabled={busy}
            label={a.state === 'on' ? `Pause ${a.name}` : `Turn on ${a.name}`}
            onChange={(on) =>
              act(() => api.post(`/api/schedules/${a.id}`, { state: on ? 'on' : 'paused' }))
            }
          />
        </>
      }
    />
  )
}

// Every schedule of a module on at once, or all paused once they are all on.
function AllSchedules({
  moduleId,
  schedules,
  onChange,
}: {
  moduleId: string
  schedules: ScheduleView[]
  onChange: () => void
}) {
  const { busy, problem, act } = useAct(onChange)
  const allOn = schedules.every((a) => a.state === 'on')
  return (
    <>
      <Refusal words={problem} />
      <Button
        size="sm"
        disabled={busy}
        onClick={() =>
          act(() =>
            api.post(`/api/modules/${moduleId}/schedules`, { state: allOn ? 'paused' : 'on' }),
          )
        }
      >
        {allOn ? 'Pause all' : 'Turn on all'}
      </Button>
    </>
  )
}

// The tables that are not tabs of their own: setup, and parts, each saying what it is.
function Tables({ m, onChange }: { m: ModuleView; onChange: () => void }) {
  const { busy, on, act } = useAct(onChange)
  const others = m.tables.filter((t) => t.place !== 'main')
  if (!others.length) return null
  return (
    <Part
      title="Tables"
      sub={`Setup its schedules read${
        others.some((t) => t.place === 'part') ? ', the tables whose rows are part of a row' : ''
      }${others.some((t) => t.place === 'people') ? ", and what People's columns hold" : ''}.`}
    >
      <ul className="flex flex-col">
        {others.map((t) => (
          <li
            key={t.id}
            className="flex gap-3 border-hair border-t py-1.5 text-md first:border-t-0"
          >
            <a
              href={`#/table/${t.id}`}
              className="min-w-0 flex-1 truncate text-ink hover:underline"
            >
              {t.name}
            </a>
            <span className="text-ink-3">
              {t.place === 'setup'
                ? 'Setup'
                : t.place === 'people'
                  ? "People's columns"
                  : `Part of ${t.of ?? 'a row'}`}
            </span>
            {t.place !== 'people' && (
              <button
                type="button"
                disabled={busy && on === t.id}
                onClick={() =>
                  act(() => api.post(`/api/tables/${t.id}/tab`, { tab: !t.tab }), t.id)
                }
                className={
                  t.tab
                    ? 'text-accent hover:underline'
                    : 'text-ink-3 hover:text-ink hover:underline'
                }
              >
                {t.tab ? 'A tab' : 'Keep as a tab'}
              </button>
            )}
            <span className="w-14 text-right text-ink-3 tabular-nums">
              {t.rows.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </Part>
  )
}

// What of an installed module is the person's now: each with the module's own version
// back, and the fields the module no longer uses, each with its values gone for good. It shows
// only when there is something to show.
function Yours({ moduleId, onChange }: { moduleId: string; onChange: () => void }) {
  const [yours, setYours] = useState<YoursView | null>(null)
  const [asking, setAsking] = useState<string | null>(null)
  const load = useCallback(() => {
    api.get<YoursView>(`/api/kits/${moduleId}/yours`).then(setYours, () => setYours(null))
  }, [moduleId])
  useEffect(() => {
    load()
  }, [load])
  const { busy, problem, act } = useAct(() => {
    load()
    onChange()
  })
  if (!yours) return null
  const back = (what: Record<string, string>) =>
    act(() => api.post(`/api/kits/${moduleId}/yours/back`, what))
  const items = [
    ...yours.files.map((f) => ({
      key: `file:${f.path}`,
      words: `${f.path}, ${f.state === 'removed' ? 'deleted' : 'changed'} by you`,
      back: () => back({ kind: 'file', path: f.path }),
    })),
    ...yours.rows.map((r) => ({
      key: `row:${r.id}`,
      words: `${r.name} in ${r.table}, a setup row you changed`,
      back: () => back({ kind: 'row', table: r.table, key: r.key }),
    })),
    ...yours.views.map((v) => ({
      key: `view:${v.id}`,
      words: `The view ${v.name} on ${v.table}, yours`,
      back: () => back({ kind: 'view', table: v.table, name: v.name }),
    })),
    ...yours.fields.map((f) => ({
      key: `field:${f.id}`,
      words: `The field ${f.name} in ${f.table}, added by you`,
      back: null,
    })),
  ]
  if (!items.length && !yours.removed.length) return null
  const gone = yours.removed.find((f) => f.fieldId === asking)
  return (
    <Part
      title="What is yours"
      sub="What you changed in this module; its updates leave these alone."
    >
      {problem && <Refusal words={problem} />}
      <List>
        {items.map((it) => (
          <Row
            key={it.key}
            title={it.words}
            actions={
              it.back && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={it.back}>
                  Take the module's version back
                </Button>
              )
            }
          />
        ))}
        {yours.removed.map((f) => (
          <Row
            key={`gone-${f.fieldId}`}
            title={`${f.name} in ${f.table}: the module no longer uses it`}
            sub={`${f.rows} row${f.rows === 1 ? '' : 's'} still hold a value under it`}
            actions={
              <More label="More" disabled={busy}>
                {(close) => (
                  <MenuItem
                    danger
                    onClick={() => {
                      close()
                      setAsking(f.fieldId)
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Delete its values
                  </MenuItem>
                )}
              </More>
            }
          />
        ))}
      </List>
      {gone && (
        <Confirm
          open
          title={`Delete ${gone.name}'s values?`}
          yes={`Delete ${gone.rows === 1 ? 'it' : `all ${gone.rows}`}`}
          busy={busy}
          onClose={() => setAsking(null)}
          onYes={() => {
            setAsking(null)
            act(() =>
              api.post(`/api/kits/${moduleId}/fields/remove`, {
                table: gone.table,
                field: gone.fieldId,
              }),
            )
          }}
        >
          {gone.rows === 1 ? 'One row' : `${gone.rows} rows`} in {gone.table}{' '}
          {gone.rows === 1 ? 'holds' : 'hold'} a value under it, and can’t get it back.
        </Confirm>
      )}
    </Part>
  )
}

// The module as a file to install on another Alpha: made from its shape when it came from none,
// packed as it is now when it came from one; its rows never leave. A developer's Alpha can also
// take a new version from the folder it came from.
function PackIt({ m, folder }: { m: ModuleView; folder: boolean }) {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const pack = async () => {
    setBusy(true)
    setSaid(null)
    try {
      const r = await api.post<{ file: string; words: string }>(`/api/kits/${m.id}/make`, {})
      setSaid(r.words)
    } catch (err) {
      setSaid(err instanceof Problem ? err.message : 'The module was not packed.')
    } finally {
      setBusy(false)
    }
  }
  const update = async () => {
    setBusy(true)
    setSaid(null)
    try {
      const r = await api.post<{ replaced: string[]; kept: string[]; added: string[] }>(
        `/api/kits/${m.id}/update`,
        {},
      )
      setSaid(
        `Updated: ${r.replaced.length + r.added.length} files from the module${
          r.kept.length ? `; kept your changes to ${r.kept.join(', ')}` : ''
        }.`,
      )
    } catch (err) {
      setSaid(err instanceof Problem ? err.message : 'The module was not updated.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Part
      title="Pack it"
      sub="A file that installs this module on another Alpha; its rows stay here."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={pack}>
          {m.kit ? 'Pack it as it is now' : 'Pack it to install elsewhere'}
        </Button>
        {folder && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={update}>
            Update from its folder
          </Button>
        )}
      </div>
      {said && <p className="mt-2 text-ink-2 text-md">{said}</p>}
    </Part>
  )
}
