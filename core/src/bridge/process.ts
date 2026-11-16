// A connector process a person's computer runs, through the Bridge: the core's half of it. The
// same lines go down and come up as with a process the core starts itself (connectors/process.ts);
// they travel over the computer's one connection instead of a pipe. The computer answers its own
// asks (a secret, the browser, the Mac helper); the world's (keep a file, land rows, the cursor, a
// journal line) come here, as from any process. A computer that is not connected answers at once
// that it is away.
import { Problem, type ProblemKind } from '@alpha/connector-sdk'
import { ConnectorProcess, type Described } from '../connectors/process.ts'

// The computer's connection, as a process a computer runs needs it.
export interface Link {
  name: string // the computer's own name (Kenil's MacBook)
  online(): boolean
  paused(): boolean // its person paused it there
  send(m: Record<string, unknown>): void
}

export const awayWords = (name: string) =>
  `${name} is not connected now, so this did not run there. It runs once the computer is back.`
export const pausedWords = (name: string) =>
  `${name} is paused by its person, so this did not run there. It runs once they resume it.`

export class BridgedProcess extends ConnectorProcess {
  private link: Link
  private connector: string
  private starting: { ok: (d: Described[]) => void; fail: (e: Error) => void } | null = null

  constructor(entry: string, connector: string, link: Link) {
    super(entry)
    this.here = false
    this.connector = connector
    this.link = link
  }

  // The computer starts its connector process and says what it holds, as a process the core
  // starts does.
  protected override spawn(): Promise<Described[]> {
    if (!this.link.online()) return Promise.reject(new Problem(awayWords(this.link.name), 'away'))
    if (this.link.paused()) return Promise.reject(new Problem(pausedWords(this.link.name), 'away'))
    return new Promise<Described[]>((ok, fail) => {
      this.starting = { ok, fail }
      this.link.send({ t: 'start', connector: this.connector })
    })
  }

  // A line the computer's process said, carried up.
  heard(line: string): void {
    const s = this.starting
    this.read(
      line,
      (d) => {
        this.starting = null
        s?.ok(d)
      },
      (e) => {
        this.starting = null
        s?.fail(e)
      },
    )
  }

  // The computer's process ended (other), or the computer went away (away): what waits on it
  // learns so, and the next call starts it again.
  ended(why: string, kind: ProblemKind = 'away'): void {
    const err = new Problem(why, kind)
    this.starting?.fail(err)
    this.starting = null
    for (const a of this.pending.values()) a.fail(err)
    this.pending.clear()
    this.ready = null
  }

  protected override send(line: string): void {
    if (!this.link.online()) throw new Problem(awayWords(this.link.name), 'away')
    if (this.link.paused()) throw new Problem(pausedWords(this.link.name), 'away')
    this.link.send({ t: 'line', connector: this.connector, line: line.replace(/\n$/, '') })
  }

  override close(): void {
    if (this.link.online()) this.link.send({ t: 'stop', connector: this.connector })
    this.ended('The connector on the computer was stopped.')
  }
}
