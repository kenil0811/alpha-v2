// A demo's clock: when the core runs as if it were another day (ALPHA_CLOCK, core/src/clock.ts),
// the window's now is the core's, moving on in real time, so "today" and "overdue" agree.
export function shiftClock(now: string) {
  const shift = Date.parse(now) - Date.now()
  if (Number.isNaN(shift) || Math.abs(shift) < 60_000) return
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
