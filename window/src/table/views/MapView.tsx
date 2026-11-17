// A table as a map (ui-rules T24): a point per row with a place, coloured by a choice when the view
// has one, gathered into counts where they crowd, the row's name on pointing and the row beside on
// a click. MapLibre and its worker load only when a map opens; the tiles come from OpenFreeMap,
// which learns the area in view and nothing of the rows. Rows with no place are counted under it.
import type { FieldView, RowView, ViewConfig } from '@alpha/core/api'
import { pointOf } from '@alpha/core/places'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Choice, optionOf } from '../../ui/pill.tsx'
import { titleOf } from '../values.ts'

type MapLibre = typeof import('maplibre-gl')
type MapInstance = InstanceType<MapLibre['Map']>

const TILES = 'https://tiles.openfreemap.org/styles'

// a row as GeoJSON, longitude first
interface Spot {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: string; name: string; colour: string }
}
interface Spots {
  type: 'FeatureCollection'
  features: Spot[]
}

// The window's own colours, read from its variables, so the points follow light and dark.
const colour = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const dark = () => getComputedStyle(document.documentElement).colorScheme === 'dark'

// Each row with a place as a point, and how many have none.
function pointsOf(rows: RowView[], fields: FieldView[], view: ViewConfig) {
  const by = fields.find((f) => f.id === view.by)
  const until = fields.find((f) => f.id === view.until)
  const group = fields.find((f) => f.id === view.group && f.kind === 'choice')
  const features: Spot[] = []
  const empty = (v: unknown) => v === null || v === undefined || v === ''
  for (const r of rows) {
    const lat = by ? r.values[by.slug] : null
    const lng = until ? r.values[until.slug] : null
    let at: [number, number] | null = null
    if (by?.kind === 'text') at = pointOf(lat)
    else if (!empty(lat) && !empty(lng)) {
      const p: [number, number] = [Number(lat), Number(lng)]
      if (Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180) at = p
    }
    if (!at) continue
    const choice = group ? String(r.values[group.slug] ?? '') : ''
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [at[1], at[0]] },
      properties: {
        id: r.id,
        name: titleOf(fields, r),
        colour: group && choice ? colour(`--opt-${optionOf(group, choice)}`) : colour('--accent'),
      },
    })
  }
  return { features, missing: rows.length - features.length, group }
}

export function MapView({
  rows,
  fields,
  view,
  onOpen,
}: {
  rows: RowView[]
  fields: FieldView[]
  view: ViewConfig
  onOpen: (id: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MapInstance | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [scheme, setScheme] = useState(dark)
  const [ready, setReady] = useState(0) // a map made and loaded, counted, so the points go on it
  // the points' colours are read again when the look changes
  const { features, missing, group } = useMemo(
    () => pointsOf(rows, fields, view),
    [rows, fields, view, scheme],
  )
  const shown = useMemo(
    () => group?.choices.filter((c) => rows.some((r) => r.values[group.slug] === c)) ?? [],
    [group, rows],
  )
  const data = useMemo((): Spots => ({ type: 'FeatureCollection', features }), [features])
  const open = useRef(onOpen)
  open.current = onOpen

  // the window's light or dark, followed as it changes
  useEffect(() => {
    const look = new MutationObserver(() => setScheme(dark()))
    look.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mac = window.matchMedia('(prefers-color-scheme: dark)')
    const follow = () => setScheme(dark())
    mac.addEventListener('change', follow)
    return () => {
      look.disconnect()
      mac.removeEventListener('change', follow)
    }
  }, [])

  // the map itself, made once for its look; the points are set below
  useEffect(() => {
    let gone = false
    let made: MapInstance | null = null
    ;(async () => {
      try {
        const lib = await import('maplibre-gl')
        await import('maplibre-gl/dist/maplibre-gl.css')
        if (gone || !box.current) return
        lib.setWorkerUrl(workerUrl)
        made = new lib.Map({
          container: box.current,
          style: `${TILES}/${scheme ? 'dark' : 'positron'}`,
          center: [-96, 38],
          zoom: 3,
          attributionControl: { compact: true },
        })
        made.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right')
        made.on('load', () => {
          if (!made) return
          made.addSource('rows', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
            cluster: true,
            clusterRadius: 40,
          })
          made.addLayer({
            id: 'gathered',
            type: 'circle',
            source: 'rows',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': colour('--ink-2'),
              'circle-opacity': 0.85,
              'circle-radius': ['step', ['get', 'point_count'], 14, 25, 18, 250, 24],
            },
          })
          made.addLayer({
            id: 'count',
            type: 'symbol',
            source: 'rows',
            filter: ['has', 'point_count'],
            layout: {
              'text-field': ['get', 'point_count_abbreviated'],
              'text-size': 12,
              // a font the tiles' own host serves
              'text-font': ['Noto Sans Bold'],
            },
            paint: { 'text-color': colour('--canvas') },
          })
          made.addLayer({
            id: 'points',
            type: 'circle',
            source: 'rows',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': ['get', 'colour'],
              'circle-radius': 6,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': colour('--surface'),
            },
          })
          const popup = new lib.Popup({ closeButton: false, closeOnClick: false, offset: 10 })
          made.on('mouseenter', 'points', (e) => {
            if (!made) return
            made.getCanvas().style.cursor = 'pointer'
            const f = e.features?.[0]
            const at = f?.geometry.type === 'Point' ? f.geometry.coordinates : null
            if (f && at)
              popup
                .setLngLat(at as [number, number])
                .setText(String(f.properties?.name ?? ''))
                .addTo(made)
          })
          made.on('mouseleave', 'points', () => {
            if (made) made.getCanvas().style.cursor = ''
            popup.remove()
          })
          made.on('click', 'points', (e) => {
            const id = e.features?.[0]?.properties?.id
            if (typeof id === 'string') open.current(id)
          })
          made.on('click', 'gathered', async (e) => {
            const f = e.features?.[0]
            const source = made?.getSource('rows') as
              | { getClusterExpansionZoom: (id: number) => Promise<number> }
              | undefined
            if (!f || !made || !source || f.geometry.type !== 'Point') return
            const zoom = await source.getClusterExpansionZoom(Number(f.properties?.cluster_id))
            made.easeTo({ center: f.geometry.coordinates as [number, number], zoom })
          })
          map.current = made
          setReady((n) => n + 1)
        })
      } catch (e) {
        setProblem(e instanceof Error ? e.message : 'The map did not load.')
      }
    })()
    return () => {
      gone = true
      map.current = null
      made?.remove()
    }
  }, [scheme])

  // the rows' points, and the map fitted to them, whenever the rows change or a map is made
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const source = m.getSource('rows') as { setData: (d: typeof data) => void } | undefined
    source?.setData(data)
    const all = data.features.map((f) => f.geometry.coordinates)
    if (!all.length) return
    const lngs = all.map((p) => p[0])
    const lats = all.map((p) => p[1])
    m.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 13, duration: 0 },
    )
  }, [data, ready])

  return (
    <div className="flex min-h-0 flex-1 flex-col px-7 pb-4">
      <div ref={box} className="min-h-0 flex-1 overflow-hidden rounded-lg border border-line" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-ink-3 text-sm">
        {group && shown.map((c) => <Choice key={c} of={group} value={c} />)}
        {problem ? (
          <span className="text-bad">{problem}</span>
        ) : (
          missing > 0 && (
            <span>
              {missing === 1 ? '1 row has' : `${missing.toLocaleString()} rows have`} no place
            </span>
          )
        )}
      </div>
    </div>
  )
}
