// A dropped IMAP connection ends the call it was in, with the error, and never the process.
import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { withImapClient } from './index.ts'

class FakeImap extends EventEmitter {
  loggedOut = false
  async connect() {}
  async logout() {
    this.loggedOut = true
  }
}

describe('withImapClient', () => {
  it('gives the call its answer when nothing goes wrong, and logs out', async () => {
    const client = new FakeImap()
    expect(await withImapClient(client, async () => 42)).toBe(42)
    expect(client.loggedOut).toBe(true)
  })

  it('fails the call when the connection drops mid-way, and still logs out', async () => {
    const client = new FakeImap()
    const slow = withImapClient(client, () => new Promise<number>(() => {}))
    client.emit('error', new Error('Connection not available'))
    await expect(slow).rejects.toThrow(/Connection not available/)
    expect(client.loggedOut).toBe(true)
  })
})
