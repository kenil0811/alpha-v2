// A dropped IMAP connection ends the call it was in, with the error, and never the process.
import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { sendOnce, withImapClient } from './index.ts'

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

// One send, once (final plan, call A, 28 Oct): an email Gmail took before the connection dropped
// is found in Sent and said sent, never sent again; one it never took is said not sent; Gmail asking
// to slow down is a busy problem the runtime waits out; a refusal is said as it is.
describe('sendOnce', () => {
  const m = { to: 'sam@grandbb.example', subject: 'Catching up', body: 'Hi Sam' }
  function gmail(opts: { takes: boolean; fails?: Error; filedAfter?: number }) {
    const sent: Record<string, unknown>[] = []
    let looks = 0
    return {
      sent,
      looks: () => looks,
      hands: {
        send: async (mail: Record<string, unknown>) => {
          if (opts.takes) sent.push(mail)
          if (opts.fails) throw opts.fails
          return { messageId: mail.messageId }
        },
        inSent: async (id: string) => {
          looks++
          return looks > (opts.filedAfter ?? 0) && sent.some((x) => x.messageId === id)
        },
        wait: async () => {},
      },
    }
  }
  const dropped = () => Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' })

  it('sends with a Message-ID of its own', async () => {
    const g = gmail({ takes: true })
    const out = await sendOnce('me@gmail.com', m, g.hands)
    expect(out).toMatchObject({ sent: true, to: m.to })
    expect(out.id).toMatch(/^<alpha-[\w-]+@gmail\.com>$/)
    expect(g.sent).toHaveLength(1)
  })

  it('says sent, once, when Gmail took it before the connection dropped', async () => {
    const g = gmail({ takes: true, fails: dropped(), filedAfter: 1 })
    const out = await sendOnce('me@gmail.com', m, g.hands)
    expect(out.words).toBe('Gmail took it before the connection dropped; it is in Sent.')
    expect([g.sent.length, g.looks()]).toEqual([1, 2])
  })

  it('says not sent when Gmail never took it, and sends nothing', async () => {
    const g = gmail({ takes: false, fails: dropped() })
    await expect(sendOnce('me@gmail.com', m, g.hands)).rejects.toThrow(
      'The email to sam@grandbb.example was not sent: the connection to Gmail dropped and Sent has no such message. Nothing went, so it can be sent again.',
    )
    expect(g.sent).toHaveLength(0)
  })

  it('makes "slow down" a busy problem, and says a refusal as it is', async () => {
    const slow = Object.assign(new Error('421 4.7.0 Try again later'), { responseCode: 421 })
    await expect(
      sendOnce('me@gmail.com', m, gmail({ takes: false, fails: slow }).hands),
    ).rejects.toMatchObject({
      kind: 'busy',
    })
    const limit = Object.assign(new Error('550 5.4.5 Daily user sending limit exceeded'), {
      responseCode: 550,
    })
    await expect(
      sendOnce('me@gmail.com', m, gmail({ takes: false, fails: limit }).hands),
    ).rejects.toThrow(
      "Gmail's sending limit for today is reached on me@gmail.com, so the email to sam@grandbb.example was not sent.",
    )
  })
})
