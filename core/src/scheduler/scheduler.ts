// The scheduler (design §11): one tick a minute. What fell due while the Mac slept is journaled,
// and one catch-up runs on waking.
import type { World } from '../world/world.ts'

export interface Due {
  run(now: number): Promise<void>
}

export class Scheduler {
  private world: World
  private due: Due[]
  private timer: ReturnType<typeof setInterval> | null = null
  private last = Date.now()
  private ticking = false

  constructor(world: World, due: Due[]) {
    this.world = world
    this.due = due
  }

  start(everyMs = 60_000): void {
    this.last = Date.now()
    this.timer = setInterval(() => void this.tick(everyMs), everyMs)
    this.timer.unref()
    void this.tick(everyMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async tick(everyMs: number, now = Date.now()): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      const gap = now - this.last
      if (gap > everyMs * 2.5) {
        const minutes = Math.round(gap / 60_000)
        this.world.line({
          actor: { kind: 'system' },
          kind: 'woke',
          words: `The Mac was asleep for ${minutes} minute${minutes === 1 ? '' : 's'}; catching up once on what fell due.`,
          data: { asleepMs: gap },
        })
      }
      this.last = now
      for (const d of this.due) await d.run(now).catch(() => undefined)
    } finally {
      this.ticking = false
    }
  }
}
