// A panel beside the page, with the assistant open: when there is no room, the panel gives way and
// the assistant stays. A5's 600px for the page hold.
import { describe, expect, it } from 'vitest'
import { NO_LAYOUT } from './layout.ts'
import { besideWidth, roomBeside } from './room.ts'

describe('room for a panel beside the page', () => {
  const open = { ...NO_LAYOUT, assistant: 'open' as const }
  it('is there on a wide window: the rail, the page’s 600px, 320px beside, the assistant', () => {
    expect(roomBeside(1600, open, true)).toBe(true) // 216 + 600 + 320 + 320 = 1456
  })
  it('is not on a laptop’s window with the assistant open: the panel gives way, as today', () => {
    expect(roomBeside(1280, open, true)).toBe(false)
  })
  it('is there on the same window with the assistant folded to its strip', () => {
    expect(roomBeside(1280, { ...open, assistant: 'folded' }, false)).toBe(true) // 216 + 600 + 320 + 80
  })
  it('counts a wider assistant and a folded rail', () => {
    expect(roomBeside(1456, { ...open, panel: 480 }, true)).toBe(false)
    expect(roomBeside(1480, { ...open, panel: 480, railFolded: true }, true)).toBe(true) // 80 + 600 + 320 + 480
  })
  it('starts a page opened beside at 480px where there is room, never less than 320px', () => {
    expect(besideWidth(1680, open, true)).toBe(480) // 1680 - 216 - 600 - 320 = 544
    expect(besideWidth(1500, open, true)).toBe(364)
    expect(besideWidth(1280, open, true)).toBe(320)
  })
})
