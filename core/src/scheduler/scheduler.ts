// The scheduler: one tick a minute. What fell due while the Mac slept is journaled, and one
// catch-up runs on waking. A job that fails says so: a line each time, and a card on Home after
// it has failed twice in a row, which closes itself when the job next works (docs/rules.md, R1).
import type { World } from '../world/world.ts'

export interface Due {
  name?: string // how the person reads it, when it fails
  cardAfter?: number // failures in a row before the card; two unless it says
  run(now: number): Promise<void>
}

export const JOB_FAILED = 'job_failed'

export class Scheduler {
  private world: World
  private due: Due[]
  private owner: string | null
  private notify: () => void // the window hears of a card opened or closed
  private timer: ReturnType<typeof setInterval> | null = null
  private last = Date.now()
  private ticking = false
  private failures = new Map<string, number>() // jobs failing now, how many in a row
  private settled = new Set<string>() // jobs seen working since the start

  constructor(world: World, due: Due[], options: { owner?: string; notify?: () => void } = {}) {
    this.world = world
    this.due = due
    this.owner = options.owner ?? null
    this.notify = options.notify ?? (() => {})
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
      for (const d of this.due) await this.runOne(d, now)
    } finally {
      this.ticking = false
    }
  }

  private cardOf(name: string) {
    return this.world.cards
      .waiting()
      .find((c) => c.call?.tool === JOB_FAILED && (c.call.input as { job?: string }).job === name)
  }

  private async runOne(d: Due, now: number): Promise<void> {
    const name = d.name ?? 'A background job'
    try {
      await d.run(now)
    } catch (err) {
      this.failed(d, name, err instanceof Error ? err.message : String(err))
      return
    }
    // working again, or for the first time since a start that may have left its card waiting
    if (!this.failures.delete(name) && this.settled.has(name)) return
    this.settled.add(name)
    const card = this.cardOf(name)
    if (!card) return
    this.world.cards.withdraw(card.id, { kind: 'system' }, `${name} works again.`)
    this.notify()
  }

  private failed(d: Due, name: string, why: string): void {
    const times = (this.failures.get(name) ?? 0) + 1
    this.failures.set(name, times)
    this.world.line({
      actor: { kind: 'system' },
      kind: 'job_failed',
      words: `${name} did not work: ${why}`,
      data: { job: name, times },
    })
    if (times < (d.cardAfter ?? 2) || this.cardOf(name)) return
    this.world.cards.open({
      kind: 'suggestion',
      words: `${name} is not working`,
      detail: 'Alpha tries again every minute, and this closes by itself when it works.',
      options: ['Understood'],
      call: { tool: JOB_FAILED, input: { job: name } },
      actor: { kind: 'system' },
      user: this.owner,
    })
    this.notify()
  }
}
