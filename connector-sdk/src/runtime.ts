// What every connection's calls go through: pacing per account, retries, a journal
// line per call, fixture record and replay, and the health judgement after a sync. A call that
// changes something (a send, a write) is never tried again when it failed in passing: whether it
// was done is unknown, and doing it twice is worse than saying so (final plan, call A, 28 Oct). A
// service asking to wait (429, "too many requests") did nothing, so any call waits it out and tries
// again, for as long as it asked, up to a bound.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { RateLimiter } from 'limiter'
import { type Call, type Host, type Manifest, Problem, type SyncResult } from './connector.ts'

export interface Judgements {
  retries: number // attempts after the first, for a read that failed in passing
  busyWaitMs: number // the most a call waits in all for a service that asked it to wait
  fewerRowsRatio: number // a sync holding less than this share of last time's rows is suspect
  quietDays: number // nothing new for this long is worth saying
}

export interface Fixtures {
  dir: string
  mode: 'record' | 'replay'
}

export interface CallOptions {
  judgements: Judgements
  fixtures?: Fixtures
  sleep?: (ms: number) => Promise<void>
  once?: boolean // it changes something: never tried again when its fate is unknown
}

export const TRANSIENT =
  /ECONNRESET|ETIMEDOUT|EPIPE|ECONNREFUSED|EAI_AGAIN|socket hang up|timed out|temporar/i

// How long a service asked to wait, when it said "too many requests": a Problem of kind busy, or an
// HTTP 429 with its Retry-After (seconds, or a date); none said, a wait that grows each time.
export function busyFor(err: unknown, tries: number): number | null {
  const grows = 5000 * 2 ** tries
  if (err instanceof Problem) return err.kind === 'busy' ? (err.retryAfterMs ?? grows) : null
  const e = err as { status?: unknown; statusCode?: unknown; headers?: unknown }
  if (e?.status !== 429 && e?.statusCode !== 429) return null
  const h = e.headers as { get?: (k: string) => string | null } | Record<string, string> | undefined
  const said =
    typeof h?.get === 'function'
      ? h.get('retry-after')
      : (h as Record<string, string> | undefined)?.['retry-after']
  if (!said) return grows
  const secs = Number(said)
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000)
  const at = Date.parse(said)
  return Number.isNaN(at) ? grows : Math.max(0, at - Date.now())
}

// One pace per account, shared by every call made for it in this process.
const paces = new Map<string, { limiter: RateLimiter; day: string; used: number }>()

function pace(manifest: Manifest, account: string) {
  const key = `${manifest.name}:${account.toLowerCase()}`
  let p = paces.get(key)
  if (!p) {
    p = {
      limiter: new RateLimiter({ tokensPerInterval: manifest.pace.perMinute, interval: 'minute' }),
      day: '',
      used: 0,
    }
    paces.set(key, p)
  }
  return p
}

function fixtureFile(f: Fixtures, name: string, args: unknown): string {
  const hash = createHash('sha256')
    .update(JSON.stringify(args ?? null))
    .digest('hex')
    .slice(0, 10)
  return join(f.dir, `${name}-${hash}.json`)
}

export function makeCall(manifest: Manifest, host: Host, options: CallOptions): Call {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  return {
    host,
    async call<T>(name: string, args: unknown, fn: () => Promise<T>): Promise<T> {
      const f = options.fixtures
      if (f?.mode === 'replay') {
        // The answer recorded for exactly this call, else one recorded for any call of its name
        // (a send or a draft whose words the model chooses).
        const exact = fixtureFile(f, name, args)
        const any = join(f.dir, `${name}-any.json`)
        const file = existsSync(exact) ? exact : any
        if (!existsSync(file))
          throw new Problem(`No recorded answer for ${manifest.title} ${name}.`)
        host.journal(`${manifest.title}: ${name}`, { call: name, ok: true, replayed: true })
        return JSON.parse(readFileSync(file, 'utf8')) as T
      }
      const p = pace(manifest, host.account)
      const today = new Date().toISOString().slice(0, 10)
      if (p.day !== today) {
        p.day = today
        p.used = 0
      }
      if (manifest.pace.perDay !== undefined && p.used >= manifest.pace.perDay)
        throw new Problem(
          `${manifest.title} has used today's share of calls for ${host.account}; it carries on tomorrow.`,
        )
      let attempt = 0
      let waits = 0
      let waited = 0
      while (true) {
        await p.limiter.removeTokens(1)
        p.used++
        try {
          const out = await fn()
          host.journal(`${manifest.title}: ${name}`, { call: name, ok: true, attempt })
          if (f?.mode === 'record') {
            mkdirSync(f.dir, { recursive: true })
            writeFileSync(fixtureFile(f, name, args), JSON.stringify(out, null, 1))
          }
          return out
        } catch (err) {
          const words = err instanceof Error ? err.message : String(err)
          // the service asked to wait: nothing was done, so wait and try again, within the bound
          const busy = busyFor(err, waits)
          if (busy !== null) {
            if (waited + busy <= options.judgements.busyWaitMs) {
              waits++
              waited += busy
              await sleep(busy)
              continue
            }
            host.journal(`${manifest.title}: ${name} did not work`, {
              call: name,
              ok: false,
              attempt,
              error: words,
              waited,
            })
            throw new Problem(
              `${manifest.title} asked Alpha to wait longer than ${Math.round(options.judgements.busyWaitMs / 60000)} minutes, so ${name} was not done. Try again later.`,
              'busy',
            )
          }
          const passing = !(err instanceof Problem) && TRANSIENT.test(words)
          if (passing && !options.once && attempt < options.judgements.retries) {
            attempt++
            await sleep(1000 * 4 ** (attempt - 1))
            continue
          }
          host.journal(`${manifest.title}: ${name} did not work`, {
            call: name,
            ok: false,
            attempt,
            error: words,
          })
          throw err
        }
      }
    },
  }
}

// After a sync: whether the connection looks healthy, in words, or null when it does.
export function judgeHealth(
  before: { rows: number | null; lastNewAt: string | null },
  result: SyncResult,
  judgements: Judgements,
  now = new Date(),
): string | null {
  if (
    before.rows !== null &&
    before.rows >= 10 &&
    result.rows < before.rows * judgements.fewerRowsRatio
  )
    return `Fewer rows than last time: ${result.rows}, where there were ${before.rows}.`
  if (!result.sawNew && before.lastNewAt) {
    const days = (now.getTime() - Date.parse(before.lastNewAt)) / 86_400_000
    if (days >= judgements.quietDays) return `Nothing new for ${Math.floor(days)} days.`
  }
  return null
}
