// The connector processes the Bridge runs on its computer, one a connector: the same child the
// core runs (core/src/connectors/child.ts) with the connector's own code, carried here in the
// Bridge. Each line it says goes up to Alpha, and each line from Alpha comes down to it, after the
// Bridge has looked at it: a call for a folder this computer does not lend is refused here,
// whatever Alpha asks (docs/rules.md, B2), and what is the computer's to answer (a secret, the
// browser, the Mac helper) is answered here, never by Alpha. A process reads only the folders lent
// when it started; when they change, it starts again before its next call, as the core's do.
import { type ChildProcess, spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

// How a child is started: the program and its words, or wrapped in the computer's sandbox.
export type Start = (
  connector: string,
  reads: string[],
) => Promise<{ command: string; args: string[]; shell: boolean }>

export interface Pipe {
  up(m: Record<string, unknown>): void // to Alpha
  lent(connector: string, account: string): boolean // this computer lends it now
  reads(connector: string): string[] // the folders it lends for this connector
  said(words: string): void // what the person running the Bridge sees
}

interface Running {
  child: ChildProcess
  reads: string // the folders it was started with
  inflight: Set<unknown> // the calls it has not answered yet
  quiet: boolean // started again by the Bridge: Alpha has its first word already
  ready: Promise<void>
}

// What the computer answers itself, and which no connector here needs yet.
const OWN = (method: string) =>
  method === 'secret' || method === 'helper' || method.startsWith('browser.')

export class Children {
  private running = new Map<string, Running>()
  private queue = new Map<string, Promise<void>>() // each connector's lines from Alpha, in order
  private start: Start
  private pipe: Pipe

  constructor(start: Start, pipe: Pipe) {
    this.start = start
    this.pipe = pipe
  }

  // Alpha asks for a connector's process: started fresh, or refused when nothing of it is lent.
  async open(connector: string): Promise<void> {
    this.stop(connector)
    try {
      await this.spawn(connector, false)
    } catch (err) {
      this.answer(connector, { t: 'failed', why: err instanceof Error ? err.message : String(err) })
    }
  }

  // A line from Alpha for a connector's process, after the ones before it.
  down(connector: string, line: string): void {
    const before = this.queue.get(connector) ?? Promise.resolve()
    const next = before.then(() => this.handle(connector, line)).catch(() => undefined)
    this.queue.set(connector, next)
  }

  stop(connector: string): void {
    const r = this.running.get(connector)
    if (!r) return
    this.running.delete(connector)
    r.child.stdin?.end()
    r.child.kill()
  }

  stopAll(): void {
    for (const c of [...this.running.keys()]) this.stop(c)
  }

  private async spawn(connector: string, quiet: boolean): Promise<Running> {
    const reads = this.pipe.reads(connector)
    if (!reads.length) throw new Error(`This computer does not lend anything for ${connector}.`)
    const how = await this.start(connector, reads)
    const child = spawn(how.command, how.args, {
      shell: how.shell,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let ok: () => void = () => undefined
    let fail: (e: Error) => void = () => undefined
    const r: Running = {
      child,
      reads: JSON.stringify(reads),
      inflight: new Set(),
      quiet,
      ready: new Promise<void>((y, n) => {
        ok = y
        fail = n
      }),
    }
    r.ready.catch(() => undefined)
    this.running.set(connector, r)
    let stderr = ''
    child.stderr?.on('data', (d) => {
      stderr = (stderr + String(d)).slice(-2000)
    })
    child.stdin?.on('error', () => undefined)
    createInterface({ input: child.stdout as NodeJS.ReadableStream }).on('line', (line) => {
      if (this.heard(connector, r, line)) ok()
    })
    child.on('exit', (code) => {
      const why =
        stderr.trim().split('\n').at(-1) ||
        `The ${connector} process on this computer ended (${code ?? 'stopped'}).`
      fail(new Error(why))
      if (this.running.get(connector) !== r) return
      this.running.delete(connector)
      this.pipe.up({ t: 'ended', connector, why })
    })
    return r
  }

  private async handle(connector: string, line: string): Promise<void> {
    let m: Record<string, unknown>
    try {
      m = JSON.parse(line)
    } catch {
      return
    }
    if (m.t === 'req') {
      const name = String(m.name ?? '')
      const account = typeof m.account === 'string' ? m.account : ''
      if (name !== connector || !this.pipe.lent(connector, account)) {
        this.pipe.said(`Refused a call for ${account || 'something'} this computer does not lend.`)
        return this.answer(connector, {
          t: 'res',
          id: m.id,
          error: {
            message: 'This computer does not lend that, so it was not read.',
            kind: 'blocked',
          },
        })
      }
    }
    let r = this.running.get(connector)
    if (!r) {
      this.pipe.up({
        t: 'ended',
        connector,
        why: `The ${connector} process is not running on this computer; it starts at the next call.`,
      })
      return
    }
    // its folders changed and nothing waits on it: it starts again with them, unseen by Alpha
    if (
      m.t === 'req' &&
      !r.inflight.size &&
      r.reads !== JSON.stringify(this.pipe.reads(connector))
    ) {
      this.stop(connector)
      r = await this.spawn(connector, true)
      await r.ready
    }
    if (m.t === 'req') r.inflight.add(m.id)
    r.child.stdin?.write(`${JSON.stringify(m)}\n`)
  }

  // A line its process said; true when it is the process's first word (ready).
  private heard(connector: string, r: Running, line: string): boolean {
    let m: Record<string, unknown>
    try {
      m = JSON.parse(line)
    } catch {
      return false
    }
    if (m.t === 'ready' || m.t === 'failed') {
      if (!r.quiet) this.answer(connector, m)
      return m.t === 'ready'
    }
    if (m.t === 'res') r.inflight.delete(m.id)
    if (m.t === 'host' && OWN(String(m.method))) {
      // the computer's own asks: none is set up here yet
      r.child.stdin?.write(
        `${JSON.stringify({
          t: 'hostReply',
          hid: m.hid,
          error: { message: 'That is not set up on this computer.', kind: 'other' },
        })}\n`,
      )
      return false
    }
    if (m.t === 'host' && m.method === 'keepFile') {
      const p = m.params as { name?: string } | null
      if (p?.name) this.pipe.said(`Sent ${p.name} to Alpha.`)
    }
    this.answer(connector, m)
    return false
  }

  private answer(connector: string, m: Record<string, unknown>): void {
    this.pipe.up({ t: 'line', connector, line: JSON.stringify(m) })
  }
}
