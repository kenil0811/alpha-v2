// Each module's one signal for the rail's dot (Batch E, 66.18): the strongest of what waits and
// runs in it.
import type { Stream } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { moduleSignals } from './signals.ts'

const card = (kind: string, module: string | null) => ({ kind, module }) as Stream['cards'][number]

describe('a module’s signal', () => {
  it('is the strongest of its cards and runs', () => {
    const stream = {
      cards: [
        card('suggestion', 'm1'),
        card('permission', 'm1'),
        card('question', 'm2'),
        card('suggestion', 'm3'),
        card('question', null),
      ],
      running: [
        { id: 'r', name: 'Scout', module: 'm4' },
        { id: 'r2', name: 'Doc', module: 'm2' },
      ],
    } as unknown as Stream
    expect(moduleSignals(stream)).toEqual({ m1: 'yes', m2: 'now', m3: 'read', m4: 'running' })
    expect(moduleSignals(null)).toEqual({})
  })
})
