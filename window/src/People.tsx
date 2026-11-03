// People (design §4, §14, Ledger): everyone Alpha knows, however many rows name them, each with
// their company and plain numbers (how many messages and meetings lately, the last, who wrote
// first), never a score; companies the same way. A page each: how to reach them, where they work
// now and before, where Alpha knows them from, the ones merged into them (each can be unmerged),
// and the mail and meetings with them, newest first, each opening its row.

import type { KeptTable, ModuleSummary, PersonView, PlaceRow, RowAround } from '@alpha/core/api'
import { CalendarDays, ChevronRight, Mail, Pencil } from 'lucide-react'
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { api, Problem } from './api.ts'
import { peopleTabs } from './Module.tsx'
import { peek } from './Peek.tsx'
import { Record } from './Record.tsx'
import { InNav } from './Shell.tsx'
import { TableView } from './TableView.tsx'
import { Avatar } from './ui/avatar.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Field } from './ui/field.tsx'
import { PillSwitch, SwitchPill } from './ui/pill-switch.tsx'
import { Section } from './ui/section.tsx'

const date = (at: string) =>
  new Date(at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(new Date(at).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  })

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// "12 emails and 2 meetings in 90 days"
function channelWords(channels: { channel: string; count: number }[], days: number): string {
  if (!channels.length) return `Nothing in ${days} days`
  const said = channels.map((c) =>
    c.channel === 'mail'
      ? plural(c.count, 'email')
      : c.channel === 'meeting'
        ? plural(c.count, 'meeting')
        : `${c.count} ${c.channel}`,
  )
  return `${said.length > 1 ? `${said.slice(0, -1).join(', ')} and ${said.at(-1)}` : said[0]} in ${days} days`
}

const firstWords = (first: 'you' | 'them' | null) =>
  first === 'you' ? 'you wrote first' : first === 'them' ? 'they wrote first' : null

export function People({
  kind,
  id,
  version,
  net,
  onName,
}: {
  kind: 'person' | 'company' | 'map'
  id: string | null
  version: number
  net: ModuleSummary | null
  onName: (name: string) => void
}) {
  return id ? (
    <PersonPage id={id} version={version} onName={onName} />
  ) : (
    <PeopleList kind={kind} version={version} net={net} />
  )
}

// People is Network's tab beside Overview, in the bar; an organization's list opens from a person.
function PeopleList({
  kind,
  version,
  net,
}: {
  kind: 'person' | 'company' | 'map'
  version: number
  net: ModuleSummary | null
}) {
  // the core serves People and Organizations as tables; a name changes in its cell
  const [data, setData] = useState<KeptTable | null>(null)
  const load = useCallback(() => {
    if (kind === 'map') return
    api
      .get<KeptTable>(`/api/kept/${kind === 'company' ? 'organizations' : 'people'}`)
      .then(setData, () => setData(null))
  }, [kind])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const none = data && data.rows.length === 0 && kind === 'person'
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Network's switch in the bar (Vikas, 29 Oct): Overview first, then People, nothing else;
          its other lists are the People table's Lists */}
      <InNav>
        <PillSwitch label={net?.name ?? 'People'}>
          {[
            ...(net
              ? [
                  {
                    key: 'overview',
                    href: `#/module/${net.id}/overview`,
                    label: 'Overview',
                    sel: false,
                  },
                ]
              : []),
            ...peopleTabs(kind),
          ].map((t) => (
            <SwitchPill key={t.key} tab={t} />
          ))}
        </PillSwitch>
      </InNav>
      {none && (
        <div className="border-line border-b px-7 py-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => (window.location.hash = '#/settings/connections')}
          >
            Connect Contacts, Calendar or Gmail
          </Button>
        </div>
      )}
      <div className="min-h-0 flex-1">
        {kind === 'map' ? (
          <PlacesMap version={version} />
        ) : data ? (
          <TableView
            key={kind}
            data={data}
            kept={{
              open: (id) => {
                peek(`#/people/${id}`)
              },
            }}
          />
        ) : (
          <p className="p-7 text-ink-3">Loading…</p>
        )}
      </div>
    </div>
  )
}

export function PersonPage({
  id,
  version,
  onName,
}: {
  id: string
  version: number
  onName: (name: string) => void
}) {
  const [p, setP] = useState<PersonView | null>(null)
  const [missing, setMissing] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [mine, setMine] = useState(false)
  // the notes that mention them (core step 3b), under their id or one merged into them
  const [mentions, setMentions] = useState<RowAround['mentions']>([])
  const load = useCallback(() => {
    api
      .get<RowAround['mentions']>(`/api/people/${id}/mentions`)
      .then(setMentions, () => setMentions([]))
    api.get<PersonView>(`/api/people/${id}`).then(
      (v) => {
        // a merged one opens as the one it joined
        if (v.id !== id) window.location.replace(`#/people/${v.id}`)
        setP(v)
        setMissing(false)
        onName(v.name)
      },
      () => setMissing(true),
    )
  }, [id, onName])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])

  const act = async (path: string, body?: unknown) => {
    setProblem(null)
    try {
      const v = await api.post<PersonView>(`/api/people/${path}`, body)
      setP(v)
      onName(v.name)
      if (v.id !== id) window.location.hash = `#/people/${v.id}`
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not go through.')
    }
  }

  if (missing)
    return (
      <p className="p-8 text-ink-2 text-md">
        They are not in your people any more.{' '}
        <a className="text-accent hover:underline" href="#/people">
          All people
        </a>
      </p>
    )
  if (!p) return null
  const company = p.kind === 'company'
  const now = p.companies.filter((c) => !c.ended)
  const contact = [
    channelWords(p.contact.channels, p.contact.days),
    p.contact.last ? `last on ${date(p.contact.last)}` : '',
    p.contact.count ? (firstWords(p.contact.first) ?? '') : '',
  ].filter(Boolean)
  const upcoming = p.history.filter((h) => h.at > new Date().toISOString())
  const past = p.history.filter((h) => h.at <= new Date().toISOString())

  return (
    <Record kind={company ? 'Organization' : 'Person'}>
      <div className="flex flex-col gap-7">
        <div className="flex items-center gap-4">
          <Avatar name={p.name} organization={company} big />
          <div className="min-w-0 flex-1">
            {naming ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (name.trim() && name.trim() !== p.name)
                    void act(`${p.id}/name`, { name: name.trim() })
                  setNaming(false)
                }}
              >
                <Field
                  aria-label="Their name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-80"
                  autoFocus
                />
                <Button type="submit" size="sm" variant="primary">
                  Keep
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNaming(false)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="truncate font-serif text-2xl text-ink">{p.name}</h1>
                <button
                  type="button"
                  data-tip="Change the name"
                  aria-label="Change the name"
                  className="grid size-6 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink"
                  onClick={() => {
                    setName(p.name)
                    setNaming(true)
                  }}
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
            <div className="text-ink-2 text-md">
              {company
                ? [p.domains.join(', '), plural(p.people.length, 'person', 'people')]
                    .filter(Boolean)
                    .join(' · ')
                : now.map((c) => (c.title ? `${c.title}, ${c.name}` : c.name)).join(' · ') ||
                  'No organization known'}
            </div>
          </div>
        </div>
        {problem && <p className="text-bad text-sm">{problem}</p>}
        {!company && p.emails.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-ink-3 text-sm">
            {mine ? (
              <>
                <span>
                  {p.emails.join(', ')} will be known as your own, and {p.name} leaves People.
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={async () => {
                    try {
                      await api.post(`/api/people/${p.id}/you`)
                      window.location.hash = '#/people'
                    } catch (err) {
                      setProblem(err instanceof Problem ? err.message : 'That did not go through.')
                    }
                  }}
                >
                  Yes, that's me
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMine(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <button
                type="button"
                className="underline underline-offset-3 hover:text-ink"
                onClick={() => setMine(true)}
              >
                This is you
              </button>
            )}
          </div>
        )}
        {!company && (
          <div className="rounded-lg border border-line bg-surface px-4 py-3 text-ink-2 text-md">
            {contact.join(' · ')}
          </div>
        )}

        {(p.emails.length > 0 || p.phones.length > 0 || p.profile) && (
          <Section title="How to reach them">
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              {p.emails.map((e) => (
                <Detail key={e} label="Email">
                  <a className="text-ink hover:underline" href={`mailto:${e}`}>
                    {e}
                  </a>
                </Detail>
              ))}
              {p.phones.map((n) => (
                <Detail key={n} label="Phone">
                  {n}
                </Detail>
              ))}
              {p.profile && (
                <Detail label="Profile">
                  <a
                    className="text-ink hover:underline"
                    href={`https://${p.profile}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {p.profile}
                  </a>
                </Detail>
              )}
            </div>
          </Section>
        )}

        {!company && p.companies.length > 0 && (
          <Section title="Works at" about="As your rows say; an earlier one is kept with its dates">
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              {p.companies.map((c) => (
                <a
                  key={`${c.id}${c.title ?? ''}`}
                  href={`#/people/${c.id}`}
                  className="flex items-center gap-3 border-hair border-t px-4 py-2.5 first:border-t-0 hover:bg-hover"
                >
                  <Avatar name={c.name} organization />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-base text-ink">{c.name}</span>
                    {c.title && <span className="block text-ink-3 text-sm">{c.title}</span>}
                  </span>
                  <span className="text-ink-3 text-sm">
                    {c.ended ? `Before ${date(c.ended)}` : 'Now'}
                  </span>
                </a>
              ))}
            </div>
          </Section>
        )}

        {company && p.people.length > 0 && (
          <Section title="People there">
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              {p.people.map((m) => (
                <a
                  key={m.id}
                  href={`#/people/${m.id}`}
                  className="flex items-center gap-3 border-hair border-t px-4 py-2.5 first:border-t-0 hover:bg-hover"
                >
                  <Avatar name={m.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-base text-ink">{m.name}</span>
                    {m.title && <span className="block text-ink-3 text-sm">{m.title}</span>}
                  </span>
                  <ChevronRight className="size-3.5 shrink-0 text-ink-3" />
                </a>
              ))}
            </div>
          </Section>
        )}

        {p.rows.length > 0 && (
          <Section title="In your modules" about="Rows that name them, by a person or an address">
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              {p.rows.map((r) => (
                <div
                  key={r.href}
                  className="flex items-center gap-3 border-hair border-t px-4 py-2.5 first:border-t-0 hover:bg-hover"
                >
                  <a href={r.href} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-base text-ink">
                        {r.name}
                      </span>
                      <span className="block truncate text-ink-3 text-sm">
                        {r.module} · {r.table} · {r.field}
                      </span>
                    </span>
                  </a>
                  {r.field !== 'their own word' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="This row is someone else: it leaves with its own addresses"
                      onClick={() => act(`${p.id}/not`, { record: r.record })}
                    >
                      Not this person
                    </Button>
                  )}
                  <a href={r.href} aria-label={`Open ${r.name}`}>
                    <ChevronRight className="size-3.5 shrink-0 text-ink-3" />
                  </a>
                </div>
              ))}
            </div>
          </Section>
        )}

        {mentions.length > 0 && (
          <Section title="Mentioned in" about="Notes on rows that mention them; each opens its row">
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              {mentions.flatMap((m) =>
                m.rows.map((r) => (
                  <a
                    key={r.id}
                    href={`#/row/${r.id}`}
                    className="flex items-center gap-3 border-hair border-t px-4 py-2.5 first:border-t-0 hover:bg-hover"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-base text-ink">
                        {r.name}
                      </span>
                      <span className="block truncate text-ink-3 text-sm">{m.table.name}</span>
                    </span>
                    <ChevronRight className="size-3.5 shrink-0 text-ink-3" />
                  </a>
                )),
              )}
            </div>
          </Section>
        )}

        {upcoming.length > 0 && (
          <Section title="Coming up">
            <History lines={upcoming.slice().reverse()} />
          </Section>
        )}
        {!company && (
          <Section title="Mail and meetings" about="Newest first; each opens its row">
            {past.length ? (
              <History lines={past} />
            ) : (
              <p className="text-ink-3 text-md">None in what Alpha has read.</p>
            )}
          </Section>
        )}

        <Section title="Where Alpha knows them from">
          <div className="flex flex-wrap gap-2">
            {p.from.map((f) => (
              <span
                key={f.name}
                className="rounded-md border border-line bg-surface px-2.5 py-1 text-ink-2 text-sm"
              >
                {f.name}
                {f.count > 1 ? ` · ${f.count} rows` : ''}
              </span>
            ))}
            {p.from.length === 0 && (
              <span className="text-ink-3 text-sm">Only what merged into this one</span>
            )}
          </div>
        </Section>

        {p.merged.length > 0 && (
          <Section
            title="Merged into this one"
            about="Unmerge gives one back its own addresses and rows, kept apart from then on"
          >
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              {p.merged.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 border-hair border-t px-4 py-2.5 first:border-t-0"
                >
                  <Avatar name={m.name} organization={company} />
                  <span className="min-w-0 flex-1 truncate text-base text-ink">{m.name}</span>
                  <Button size="sm" onClick={() => act(`${m.id}/unmerge`)}>
                    Unmerge
                  </Button>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </Record>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-hair border-t px-4 py-2.5 text-md first:border-t-0">
      <span className="w-16 shrink-0 text-ink-3 text-sm">{label}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  )
}

function History({ lines }: { lines: PersonView['history'] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {lines.map((h) => (
        <a
          key={h.href}
          href={h.href}
          className="flex items-center gap-3 border-hair border-t px-4 py-2.5 first:border-t-0 hover:bg-hover"
        >
          <span className="w-16 shrink-0 text-ink-3 text-sm tabular-nums">{date(h.at)}</span>
          {h.channel === 'meeting' ? (
            <CalendarDays className="size-3.5 shrink-0 text-ink-3" />
          ) : (
            <Mail className="size-3.5 shrink-0 text-ink-3" />
          )}
          <span className="min-w-0 flex-1 truncate text-base text-ink">
            {h.about ?? (h.channel === 'meeting' ? 'A meeting' : 'A message')}
          </span>
          {h.by && (
            <span className="shrink-0 text-ink-3 text-sm">
              {h.channel === 'meeting'
                ? h.by === 'you'
                  ? 'You asked'
                  : 'They asked'
                : h.by === 'you'
                  ? 'You wrote'
                  : 'They wrote'}
            </span>
          )}
        </a>
      ))}
    </div>
  )
}

// Network's map (Vikas, 3 Nov: "see the location of everything", on OpenStreetMap): every row that
// says where it is, a pin a place with its count, OpenStreetMap's tiles under them. Dragged to
// move, + and − to zoom; a pin picked lists its rows beside, each opening its record. A place
// OpenStreetMap has not placed yet (or a "Zoom") is listed under the map.
const TILE = 256
const worldX = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z
const worldY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z
}

function PlacesMap({ version }: { version: number }) {
  const [rows, setRows] = useState<PlaceRow[] | null>(null)
  const [on, setOn] = useState<string | null>(null)
  const [view, setView] = useState<{ z: number; cx: number; cy: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 720, h: 520 })
  const finding = rows?.some((r) => r.finding) ?? false
  useEffect(() => {
    if (version < 0) return
    const get = () => api.get<PlaceRow[]>('/api/places').then(setRows, () => setRows([]))
    get()
    // OpenStreetMap is asked one place a second: the pins come as it answers
    const t = finding ? window.setInterval(get, 3000) : undefined
    return () => window.clearInterval(t)
  }, [version, finding])
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [rows === null])
  if (!rows) return <p className="p-7 text-ink-3">Loading…</p>
  const by = new Map<string, PlaceRow[]>()
  for (const r of rows) by.set(r.place, [...(by.get(r.place) ?? []), r])
  const pins = [...by.entries()].flatMap(([place, rs]) => {
    const at = rs[0]?.at
    return at ? [{ place, at, rows: rs }] : []
  })
  const elsewhere = [...by.entries()].filter(([p]) => !pins.some((x) => x.place === p))
  // the first view holds every pin
  const fit = () => {
    if (!pins.length) return { z: 3, cx: worldX(-96, 3), cy: worldY(38, 3) }
    for (let z = 13; z >= 2; z--) {
      const xs = pins.map((p) => worldX(p.at.lon, z))
      const ys = pins.map((p) => worldY(p.at.lat, z))
      const [w, h] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
      if (w < size.w - 80 && h < size.h - 80)
        return {
          z,
          cx: (Math.max(...xs) + Math.min(...xs)) / 2,
          cy: (Math.max(...ys) + Math.min(...ys)) / 2,
        }
    }
    return { z: 2, cx: worldX(0, 2), cy: worldY(20, 2) }
  }
  const v = view ?? fit()
  const left = v.cx - size.w / 2
  const top = v.cy - size.h / 2
  const n = 2 ** v.z
  const tiles: { x: number; y: number }[] = []
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++)
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty++)
      if (ty >= 0 && ty < n) tiles.push({ x: tx, y: ty })
  const zoom = (d: number) => {
    const z = Math.min(17, Math.max(2, v.z + d))
    setView({ z, cx: v.cx * 2 ** (z - v.z), cy: v.cy * 2 ** (z - v.z) })
  }
  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    const [sx, sy, from] = [e.clientX, e.clientY, v]
    const move = (m: PointerEvent) =>
      setView({ ...from, cx: from.cx - (m.clientX - sx), cy: from.cy - (m.clientY - sy) })
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const most = Math.max(1, ...pins.map((p) => p.rows.length))
  const list = on ? (by.get(on) ?? []) : rows
  return (
    <div className="@container h-full overflow-y-auto">
      <div className="flex min-h-full flex-col gap-4 px-7 py-5 @4xl:h-full @4xl:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <p className="text-ink-2 text-md">
            {rows.length
              ? `${rows.length} rows that say where they are, in ${by.size} places${finding ? ' (placing the rest on the map)' : ''}. Pick a pin to see its rows.`
              : 'No row says where it is yet: a column named Location, City or Address puts it here.'}
          </p>
          <div
            ref={box}
            onPointerDown={drag}
            className="relative min-h-90 flex-1 cursor-grab touch-none overflow-hidden rounded-lg border border-line bg-sunk select-none active:cursor-grabbing"
          >
            {tiles.map((t) => (
              <img
                key={`${v.z}/${t.x}/${t.y}`}
                alt=""
                draggable={false}
                src={`https://tile.openstreetmap.org/${v.z}/${((t.x % n) + n) % n}/${t.y}.png`}
                className="pointer-events-none absolute size-64 max-w-none"
                style={{ left: t.x * TILE - left, top: t.y * TILE - top }}
              />
            ))}
            {pins.map((p) => {
              const r = 9 + 9 * Math.sqrt(p.rows.length / most)
              return (
                <button
                  key={p.place}
                  type="button"
                  aria-pressed={on === p.place}
                  data-tip={`${p.place}: ${p.rows.length}`}
                  onClick={() => setOn(on === p.place ? null : p.place)}
                  className={cn(
                    'absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-surface bg-accent font-medium text-accent-ink text-xs shadow-pop',
                    on === p.place && 'ring-2 ring-ink',
                  )}
                  style={{
                    left: worldX(p.at.lon, v.z) - left,
                    top: worldY(p.at.lat, v.z) - top,
                    width: r * 2,
                    height: r * 2,
                  }}
                >
                  {p.rows.length}
                </button>
              )
            })}
            <div className="absolute top-2 right-2 flex flex-col overflow-hidden rounded-md border border-line bg-surface shadow-btn">
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => zoom(1)}
                className="grid size-7 place-items-center hover:bg-hover"
              >
                +
              </button>
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => zoom(-1)}
                className="grid size-7 place-items-center border-line border-t hover:bg-hover"
              >
                −
              </button>
            </div>
            <span className="absolute right-0 bottom-0 bg-surface/80 px-1.5 text-ink-2 text-xs">
              ©{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                OpenStreetMap
              </a>{' '}
              contributors
            </span>
          </div>
          {elsewhere.length > 0 && (
            <p className="text-ink-3 text-sm">
              Not on the map:{' '}
              {elsewhere.map(([p, rs], i) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setOn(p)}
                  className="hover:text-accent hover:underline"
                >
                  {i > 0 && ', '}
                  {p} ({rs.length})
                </button>
              ))}
            </p>
          )}
        </section>
        <section className="flex min-h-0 min-w-0 flex-col @4xl:w-96">
          <h2 className="mb-2 flex items-baseline gap-2 font-semibold text-base text-ink">
            {on ?? 'Everything'}
            <span className="font-normal text-ink-3 text-sm">{list.length}</span>
            {on && (
              <button
                type="button"
                onClick={() => setOn(null)}
                className="ml-auto font-normal text-accent text-sm hover:underline"
              >
                All places
              </button>
            )}
          </h2>
          <ul className="flex min-h-0 flex-col overflow-y-auto">
            {list.map((r) => (
              <li key={r.href} className="border-hair border-t">
                <a href={r.href} className="flex flex-col py-2 hover:bg-hover">
                  <span className="truncate text-ink text-md">{r.label}</span>
                  <span className="truncate text-ink-3 text-sm">
                    {r.place} · {r.module}, {r.hint}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
