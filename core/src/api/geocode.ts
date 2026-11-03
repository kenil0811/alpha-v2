// Where a place is on the map (Vikas, 3 Nov: Network's map on OpenStreetMap): "Chesterfield, MO"
// asked of OpenStreetMap's Nominatim once, at most one a second as its policy asks, and kept in
// the tenant's folder. Only the place's words go out; a place with no comma (Zoom, Phone) is
// never asked. A lookup that fails is kept as not found, so it is not asked again.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type Found = { lat: number; lon: number } | null
const asking = new Set<string>() // tenant folders with lookups under way

export function placesKnown(dir: string): Record<string, Found> {
  const f = join(dir, 'places.json')
  try {
    return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as Record<string, Found>) : {}
  } catch {
    return {}
  }
}

export const askable = (place: string) => place.includes(',')

// looks up, one a second in the background, the places not known yet; the next read has them
export function lookUp(dir: string, places: string[]): void {
  const known = placesKnown(dir)
  const todo = [...new Set(places)].filter((p) => askable(p) && !(p in known))
  if (!todo.length || asking.has(dir)) return
  asking.add(dir)
  void (async () => {
    try {
      for (const place of todo) {
        let found: Found = null
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`,
            { headers: { 'user-agent': 'Alpha (a small-business app)' } },
          )
          const [hit] = r.ok ? ((await r.json()) as { lat: string; lon: string }[]) : []
          if (hit) found = { lat: Number(hit.lat), lon: Number(hit.lon) }
        } catch {
          // offline: asked again on a later read
          continue
        }
        const now = placesKnown(dir)
        now[place] = found
        writeFileSync(join(dir, 'places.json'), JSON.stringify(now))
        await new Promise((ok) => setTimeout(ok, 1100))
      }
    } finally {
      asking.delete(dir)
    }
  })()
}
