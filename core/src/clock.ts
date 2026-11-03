// A demo's clock (ALPHA_CLOCK=2026-01-05T09:00): the core runs as if it were then, moving on from
// there in real time, so seeded dates read as they would that day. Imported first in main.ts, before
// anything reads the time; the window takes the same now from /api/health. Never set on a real install.
const at = process.env.ALPHA_CLOCK
if (at) {
  const shift = Date.parse(at) - Date.now()
  if (Number.isNaN(shift)) throw new Error(`ALPHA_CLOCK is not a time: ${at}`)
  const Real = Date
  class Shifted extends Real {
    constructor(...args: unknown[]) {
      if (args.length) super(...(args as [string]))
      else super(Real.now() + shift)
    }
    static override now() {
      return Real.now() + shift
    }
  }
  globalThis.Date = Shifted as DateConstructor
}
export const shifted = !!at
