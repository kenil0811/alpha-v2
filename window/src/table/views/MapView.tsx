import type { PlaceRow } from '@alpha/core/api'
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import { api } from '../../api.ts'
import { cn } from '../../ui/cn.ts'

// A table's Map view (Vikas, 3 Nov: a view in View, for every table that says where its rows are;
// Network's tables show every module's places, on OpenStreetMap): every row that says where it is, a pin a place with its count, OpenStreetMap's tiles under them. Dragged to
// move, + and − to zoom; a pin picked lists its rows beside, each opening its record. A place
// OpenStreetMap has not placed yet (or a "Zoom") is listed under the map.
const TILE = 256
const worldX = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z
const worldY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z
}

export function MapView({ version = 0, table }: { version?: number; table?: string | undefined }) {
  const [rows, setRows] = useState<PlaceRow[] | null>(null)
  const [on, setOn] = useState<string | null>(null)
  const [view, setView] = useState<{ z: number; cx: number; cy: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 720, h: 520 })
  const finding = rows?.some((r) => r.finding) ?? false
  useEffect(() => {
    if (version < 0) return
    const get = () =>
      api.get<PlaceRow[]>('/api/places').then(
        (all) => setRows(table ? all.filter((r) => r.href.startsWith(`#/table/${table}/`)) : all),
        () => setRows([]),
      )
    get()
    // OpenStreetMap is asked one place a second: the pins come as it answers
    const t = finding ? window.setInterval(get, 3000) : undefined
    return () => window.clearInterval(t)
  }, [version, finding, table])
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
