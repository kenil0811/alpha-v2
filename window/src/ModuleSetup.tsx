// A module's Setup, its last tab and its one place: what runs on its own in it, every table it
// has, the files on its rows and the rules that hold in it, and no more. The rest about a module is its details, a page of its own a link on Setup opens: where
// it comes from, what it is for, the agents it brings, the notes Alpha reads first, what is the
// person's against the module's own, and on a developer's Alpha, Update from its folder.
// The core calls a module's package a kit; a person never reads that word.
import type {
  AgentView,
  Me,
  ModuleFileView,
  ModuleView,
  RuleView,
  ScheduleView,
  YoursView,
} from '@alpha/core/api'
import { CalendarClock, ChevronRight, FileText, Plus, Trash2 } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { useAgents } from './Agents.tsx'
import { api, Problem } from './api.ts'
import { startAsk } from './ask.ts'
import { ModuleCase } from './ModuleCase.tsx'
import { originWords, when } from './Modules.tsx'
import { TableTab } from './TableTab.tsx'
import { KINDS } from './table/KindPicker.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Confirm } from './ui/dialog.tsx'
import { DropZone } from './ui/drop-zone.tsx'
import { Select } from './ui/field.tsx'
import { Info } from './ui/info.tsx'
import { List, Row } from './ui/list.tsx'
import { More } from './ui/more.tsx'
import { Pill } from './ui/pill.tsx'
import { MenuItem } from './ui/popover.tsx'
import { Switch } from './ui/switch.tsx'
import { updatedWords } from './ui/update-now.tsx'
import { Words } from './ui/words.tsx'

// a part's place on the page, for a link to it (a notice's Find it in Setup › Tables)
export const partId = (title: string) => `setup-${title.toLowerCase().replaceAll(' ', '-')}`

// A part of Setup: its title in serif, an ⓘ saying what it is where that needs saying, a button
// at the right of the title's line where the part adds something, its content; no card around it.
export function Part({
  title,
  about,
  action,
  children,
}: {
  title: string
  about?: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <section id={partId(title)} className="flex scroll-mt-4 flex-col">
      <div className="mb-2.5 flex items-center gap-1.5">
        <h2 className="font-medium font-serif text-ink text-xl">{title}</h2>
        {about && <Info help={about} />}
        {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  )
}

export function ModuleSetup({ m, onChange }: { m: ModuleView; onChange: () => void }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex max-w-page flex-col gap-7 px-7 py-6">
        <Schedules m={m} onChange={onChange} />
        <Tables m={m} />
        <Files m={m} />
        <Rules m={m} />
        <a
          href={`#/module/${m.id}/details`}
          className="flex items-center gap-1 self-start text-accent text-md hover:underline"
        >
          Module details
          <ChevronRight className="size-3.5" />
        </a>
      </div>
    </div>
  )
}

// A module's details, a page of its own under Setup: all the rest there is to know about it.
export function ModuleDetails({ m, onChange }: { m: ModuleView; onChange: () => void }) {
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
        <KitAgents m={m} />
        <Part
          title="Notes"
          about={`What Alpha reads about ${m.name} before it works on it; ask Alpha to change them.`}
        >
          <div className="text-md">
            <Words text={m.notes.replace(/^# .*\n+/, '')} />
          </div>
        </Part>
        {m.kit && <Yours moduleId={m.id} onChange={onChange} />}
        {!!m.kit && !!me?.developer && me.user.role === 'owner' && <FromFolder m={m} />}
      </div>
    </div>
  )
}

// The agents its kit brought, each opening its page; they change with the kit.
function KitAgents({ m }: { m: ModuleView }) {
  const agents = useAgents(0).filter((a) => a.from.module === m.id)
  if (!agents.length) return null
  return (
    <Part title="Agents" about={`The agents ${m.name} brings. They change with it.`}>
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

// The module's schedules, listed only when it has some; Add schedule starts the sentence with
// Alpha, where schedules are made (Vikas, 23 Nov).
function Schedules({ m, onChange }: { m: ModuleView; onChange: () => void }) {
  const agents = useAgents(0)
  return (
    <Part
      title="Schedules"
      action={
        <>
          {m.schedules.length > 1 && (
            <AllSchedules moduleId={m.id} schedules={m.schedules} onChange={onChange} />
          )}
          <Button size="sm" onClick={() => startAsk(`In ${m.name}, every `)}>
            <Plus className="size-3.5" />
            Add schedule
          </Button>
        </>
      }
    >
      {m.schedules.length > 0 && (
        <List>
          {m.schedules.map((a) => (
            <OneSchedule key={a.id} a={a} agents={agents} onChange={onChange} />
          ))}
        </List>
      )}
    </Part>
  )
}

export function OneSchedule({
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

// Every table of the module in the order of its number (shape/numbers.ts), a name that opens
// it, how it opens for everyone, and how many rows it has. Right-click a table's name for Rename,
// Pin to header and Hide from header, kept per person; a double-click renames it. Whether a setup
// table or a part is kept as a tab for everyone is on that table's own ⋮ menu.
function Tables({ m }: { m: ModuleView }) {
  const at = (t: { number: string | null }) => Number(t.number?.split('.').pop() ?? 0)
  const all = [...m.tables].sort((a, b) => at(a) - at(b))
  if (!all.length) return null
  const head = 'pb-1.5 text-left font-normal text-ink-3 text-sm'
  return (
    <Part title="Tables">
      <table className="w-full border-collapse text-md">
        <thead>
          <tr>
            <th className={cn(head, 'w-20')}>No.</th>
            <th className={head}>Table</th>
            <th className={cn(head, 'w-36')}>Default view</th>
            <th className={cn(head, 'w-16 text-right')}>Rows</th>
          </tr>
        </thead>
        <tbody>
          {all.map((t) => {
            const view = KINDS.find((k) => k.kind === t.view)
            return (
              <tr key={t.id} className="border-hair border-t">
                <td className="py-1.5 text-ink-3 tabular-nums">{t.number}</td>
                <td className="max-w-0 py-1.5">
                  <TableTab table={t} module={m.id}>
                    {(on) => (
                      <div {...on} className="flex min-w-0">
                        <a href={`#/table/${t.id}`} className="truncate text-ink hover:underline">
                          {t.name}
                        </a>
                      </div>
                    )}
                  </TableTab>
                </td>
                <td className="py-1.5 text-ink-2">
                  <span className="flex items-center gap-1.5">
                    {view?.icon}
                    {view?.words ?? t.view}
                  </span>
                </td>
                <td className="py-1.5 text-right text-ink-3 tabular-nums">
                  {t.rows.toLocaleString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Part>
  )
}

// The files on the module's rows, the newest first, each with its row and when it came there; the
// rest in Settings › Files on this module. A file dropped here is kept, and Alpha is asked which
// rows it goes on, since a file sits on a row (Vikas, 23 Nov).
const FEW = 12

function Files({ m }: { m: ModuleView }) {
  const [got, setGot] = useState<{ files: ModuleFileView[]; count: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    api
      .get<{ files: ModuleFileView[]; count: number }>(`/api/modules/${m.id}/files?limit=${FEW}`)
      .then(setGot, () => setGot(null))
  }, [m])
  const bring = async (picked: File[]) => {
    setBusy(true)
    setProblem(null)
    const kept: string[] = []
    for (const f of picked)
      await api.upload(f).then(
        (k) => kept.push(k.name),
        () => setProblem(`${f.name} did not go in.`),
      )
    setBusy(false)
    if (kept.length) startAsk(`Put ${kept.join(', ')} on the right rows in ${m.name}`)
  }
  return (
    <Part title="Files" about={`The files on ${m.name}'s rows. Drop one here and Alpha files it.`}>
      <DropZone onFiles={(f) => void bring(f)} busy={busy}>
        {got?.files.map((f) => (
          <div
            key={`${f.hash}-${f.row.id}`}
            className="flex items-center gap-3 px-1.5 py-1 text-md"
          >
            <FileText className="size-4 shrink-0 text-ink-3" />
            <a
              href={`#/file/${f.hash}`}
              className="min-w-0 flex-1 truncate text-ink hover:underline"
            >
              {f.name}
            </a>
            <a
              href={`#/table/${f.row.table}/${f.row.id}`}
              className="max-w-60 truncate text-ink-2 hover:underline"
            >
              {f.row.name}
            </a>
            <span className="w-28 shrink-0 text-right text-ink-3">{updatedWords(f.at)}</span>
          </div>
        ))}
      </DropZone>
      <Refusal words={problem} />
      {got && got.count > got.files.length && (
        <a
          href={`#/settings/files?module=${m.id}`}
          className="mt-2 flex items-center gap-1 self-start text-accent text-md hover:underline"
        >
          See all in Files
          <ChevronRight className="size-3.5" />
        </a>
      )}
    </Part>
  )
}

// The rules that hold in this module, each opening its page; New rule starts the sentence with
// Alpha, for this module, as Settings › Rules does (Vikas, 23 Nov).
function Rules({ m }: { m: ModuleView }) {
  const [rules, setRules] = useState<RuleView[]>([])
  useEffect(() => {
    api.get<RuleView[]>(`/api/rules?module=${encodeURIComponent(m.id)}`).then(
      (all) => setRules(all.filter((r) => r.module === m.id && !r.revokedAt)),
      () => setRules([]),
    )
  }, [m])
  return (
    <Part
      title="Rules"
      about={`What Alpha may and may not do in ${m.name}.`}
      action={
        <Button size="sm" onClick={() => startAsk(`In ${m.name}, from now on, `)}>
          <Plus className="size-3.5" />
          New rule
        </Button>
      }
    >
      {rules.length > 0 && (
        <List>
          {rules.map((r) => (
            <Row
              key={r.id}
              className="relative hover:bg-canvas"
              title={
                <a href={`#/rule/${r.id}`} className="after:absolute after:inset-0">
                  {r.words}
                </a>
              }
              sub={`${r.side === 'deny' ? 'Never' : 'May'} · used ${r.uses} time${r.uses === 1 ? '' : 's'}`}
            />
          ))}
        </List>
      )}
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
      words: `The file ${f.path.split('/').pop()}, ${f.state === 'removed' ? 'deleted' : 'changed'} by you`,
      back: () => back({ kind: 'file', path: f.path }),
    })),
    ...yours.rows.map((r) => ({
      key: `row:${r.id}`,
      words: `${r.name} in ${r.table}, a setting you changed`,
      back: () => back({ kind: 'row', table: r.table, key: r.key }),
    })),
    ...yours.views.map((v) => ({
      key: `view:${v.id}`,
      words: `The saved list ${v.name} on ${v.table}, yours`,
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
      about="What you changed in this module; its updates leave these alone."
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
                  Go back to the module's own
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
          done={{
            words: `${gone.name}'s values are deleted. Bring them back from`,
            where: { label: 'Activity', href: '#/settings/activity' },
          }}
          onClose={() => setAsking(null)}
          onYes={() => {
            setAsking(null)
            return act(() =>
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

// A developer's Alpha takes a new version of a module from the folder its kit came from. Packing a
// module to install elsewhere is left out for now (Kenil, 16 Nov).
function FromFolder({ m }: { m: ModuleView }) {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
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
      title="Its folder"
      about="Take a new version of this module from the folder it came from."
    >
      <Button size="sm" variant="ghost" disabled={busy} onClick={update}>
        Update from its folder
      </Button>
      {said && <p className="mt-2 text-ink-2 text-md">{said}</p>}
    </Part>
  )
}
