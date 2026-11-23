// What leaves is saved first (ui-rules L25): a finished task's save or a card's answer goes the
// moment it is made, the thing is held while it animates out, and a live update dropping it
// meanwhile does not take it from the list; a failure brings it back and says so.
import { describe, expect, it } from 'vitest'
import { hold, keepLeaving, leaveWith } from './motion.ts'

const id = (t: { id: string }) => t.id

describe('what leaves', () => {
  it('is sent at once, before its animation ends, and held while it animates', async () => {
    const said: string[] = []
    let end: () => void = () => undefined
    const animating = new Promise<void>((r) => {
      end = r
    })
    const going = leaveWith(
      'c1',
      async () => {
        said.push('sent')
      },
      async () => {
        said.push('animating')
        await animating
        said.push('animated')
      },
      () => said.push('back'),
    )
    // the answer went before the animation was over
    await Promise.resolve()
    expect(said).toEqual(['sent', 'animating'])
    // a live update dropped it meanwhile: it is still drawn where it was
    expect(keepLeaving([{ id: 'c2' }], [{ id: 'c1' }, { id: 'c2' }], id).map(id)).toEqual([
      'c1',
      'c2',
    ])
    end()
    await going
    expect(said).toEqual(['sent', 'animating', 'animated'])
    // once it has left, it is let go
    expect(keepLeaving([{ id: 'c2' }], [{ id: 'c1' }, { id: 'c2' }], id).map(id)).toEqual(['c2'])
  })

  it('comes back with its problem when it did not go', async () => {
    let back = false
    await expect(
      leaveWith(
        't1',
        async () => {
          throw new Error('The core said no.')
        },
        async () => undefined,
        () => {
          back = true
        },
      ),
    ).rejects.toThrow('The core said no.')
    expect(back).toBe(true)
    expect(keepLeaving([], [{ id: 't1' }], id)).toEqual([])
  })

  it('keeps nothing that is not on its way out', () => {
    const release = hold('x')
    expect(keepLeaving([{ id: 'b' }], [{ id: 'a' }, { id: 'b' }], id).map(id)).toEqual(['b'])
    release()
  })
})
