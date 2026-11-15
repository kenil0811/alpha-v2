// A run is waited for a short while, then left to go on by itself.
import { describe, expect, it } from 'vitest'
import { within } from './waiting.ts'

const after = <T>(ms: number, value: T) => new Promise<T>((r) => setTimeout(() => r(value), ms))

describe('waiting for a run', () => {
  it('gives the outcome of a run that ends within the wait', async () => {
    expect(await within(after(5, 'read'), 1)).toEqual({ done: true, out: 'read' })
  })

  it('says a longer run is still going, and the run goes on to its end', async () => {
    let ended = false
    const run = after(60, 'read').then((v) => {
      ended = true
      return v
    })
    expect(await within(run, 0.01)).toEqual({ done: false })
    expect(ended).toBe(false)
    await run
    expect(ended).toBe(true)
  })

  it('passes on a failure within the wait, and holds none from a run that fails after it', async () => {
    await expect(within(Promise.reject(new Error('refused')), 1)).rejects.toThrow('refused')
    const failsLater = after(30, null).then(() => {
      throw new Error('cut short')
    })
    expect(await within(failsLater, 0.01)).toEqual({ done: false })
    await after(40, null) // the late failure lands with nobody waiting, and nothing is thrown
  })
})
