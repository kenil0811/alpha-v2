// Where a table's rows are on a map (T24): a latitude and a longitude by name and range, or a
// column of points by its values; never an address.
import { describe, expect, it } from 'vitest'
import { findPlace, pointOf } from './places.ts'

const f = (id: string, kind: string) => ({ id, name: id, kind })

describe('a table’s place', () => {
  it('is a latitude and a longitude whose values are in range', () => {
    const fields = [f('Name', 'text'), f('Lat', 'number'), f('Lng', 'number')]
    expect(findPlace(fields)).toEqual({ by: 'Lat', until: 'Lng' })
    const values = { Lat: [35.2, null], Lng: [-80.8, 200], Name: ['A', 'B'] }
    expect(findPlace(fields, (x) => values[x.id as keyof typeof values])).toBeNull()
  })

  it('is a column of points in most of its filled rows, and never an address', () => {
    const fields = [f('Address', 'text'), f('Where', 'text')]
    const values: Record<string, unknown[]> = {
      Address: ['123 Main St, Charlotte', '9 Elm St'],
      Where: ['35.2271, -80.8431', ' 35.3,-80.9 ', '', 'unknown'],
    }
    expect(findPlace(fields, (x) => values[x.id] ?? [])).toEqual({ by: 'Where', until: null })
    expect(findPlace(fields)).toBeNull()
    expect(pointOf('35.2271, -80.8431')).toEqual([35.2271, -80.8431])
    expect(pointOf('123 Main St, Charlotte')).toBeNull()
    expect(pointOf('95, 10')).toBeNull()
  })
})
