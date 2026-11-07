// A plugin's screens in the window (onboarding in Alpha, 2 Nov): found when the window is built,
// each at its own place, with a row on Home.
import { describe, expect, it } from 'vitest'
import { placeOf } from '../place.ts'
import { SCREENS, screenOf } from './screens.ts'

describe('a plugin’s screens', () => {
  it('are found in the plugins’ folders, each at #/p/<name>; the base has none', () => {
    expect(SCREENS).toEqual([])
    expect(placeOf('#/p/onboarding')).toEqual({ at: 'plugin', name: 'onboarding' })
    expect(placeOf('#/p/Not-a-name')).not.toMatchObject({ at: 'plugin' })
    expect(screenOf('nowhere')).toBeNull()
  })
})
