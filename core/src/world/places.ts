// Where a table's rows are on a map (ui-rules T24): a latitude and a longitude, two number columns
// whose names say so and whose values fall in range, or one column of points ("35.2271, -80.8431")
// in most of its rows. The core's view checks and the window's layout picker both read this one
// list, so a table is a map in the same cases in both. Nothing here is geocoded: an address is
// not a place until something turns it into one.

export interface PlaceField {
  id: string
  name: string
  kind: string
}

// The map's place: the latitude and the longitude, or one column of points (`until` empty).
export interface Place {
  by: string
  until: string | null
}

const LAT = /\blat(itude)?\b/i
const LNG = /\b(lng|lon|long|longitude)\b/i
const POINT = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

// A point's two numbers from words like "35.2271, -80.8431", in range, or none.
export function pointOf(v: unknown): [number, number] | null {
  const m = typeof v === 'string' ? POINT.exec(v) : null
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null
}

const within = (values: unknown[], limit: number) =>
  values.every((v) => v === null || v === undefined || v === '' || Math.abs(Number(v)) <= limit)

// Every place the table holds, from its columns' names and, where rows are given, their values: a
// latitude and a longitude first, then each column whose filled rows are mostly points.
export function placesOf<F extends PlaceField>(
  fields: F[],
  values?: (field: F) => unknown[],
): Place[] {
  const numbers = fields.filter((f) => f.kind === 'number')
  const lat = numbers.find((f) => LAT.test(f.name) && (!values || within(values(f), 90)))
  const lng = numbers.find((f) => LNG.test(f.name) && (!values || within(values(f), 180)))
  const out: Place[] = lat && lng ? [{ by: lat.id, until: lng.id }] : []
  if (!values) return out
  for (const f of fields.filter((x) => x.kind === 'text')) {
    const filled = values(f).filter((v) => typeof v === 'string' && v.trim())
    if (filled.length && filled.filter((v) => pointOf(v)).length * 2 > filled.length)
      out.push({ by: f.id, until: null })
  }
  return out
}

// The table's first place, or none.
export const findPlace = <F extends PlaceField>(
  fields: F[],
  values?: (field: F) => unknown[],
): Place | null => placesOf(fields, values)[0] ?? null

// Whether a map's own place still holds: a points column, or a latitude with its longitude.
export function placeHolds(fields: PlaceField[], by: string | null, until: string | null): boolean {
  const f = fields.find((x) => x.id === by)
  if (!f) return false
  if (f.kind === 'text') return until === null
  const g = fields.find((x) => x.id === until)
  return f.kind === 'number' && g?.kind === 'number'
}
