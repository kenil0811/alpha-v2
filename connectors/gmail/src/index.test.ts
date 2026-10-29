// A dropped IMAP connection ends the call it was in, with the error, and never the process.
import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { type Draft, sendOnce, withImapClient } from './index.ts'

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

  // Kenil, 29 Oct: "send it" after a draft sends that draft, not a new email beside it.
  const saved = (over: Partial<Draft> = {}): Draft => ({
    to: ['sam@grandbb.example'],
    cc: [],
    bcc: [],
    subject: 'Catching up',
    body: 'Hi Sam\n',
    attachments: [],
    raw: Buffer.from(
      'Date: Thu, 1 Oct 2026 09:00:00 +0000\r\nMessage-ID: <d1@gmail.com>\r\nTo: sam@grandbb.example\r\nSubject: Catching up\r\n\r\nHi Sam\r\n',
    ),
    ...over,
  })
  function drafts(d: Draft | null) {
    const g = gmail({ takes: true })
    const removed: string[] = []
    return {
      ...g,
      removed,
      hands: {
        ...g.hands,
        draft: async (id: string) => (id === '<d1@gmail.com>' ? d : null),
        removeDraft: async (id: string) => {
          removed.push(id)
        },
      },
    }
  }

  it('sends a named draft as it is in Drafts, under its own Message-ID, then takes it out of Drafts', async () => {
    const g = drafts(saved())
    const out = await sendOnce('me@gmail.com', { ...m, draft: '<d1@gmail.com>' }, g.hands)
    expect(out).toMatchObject({ sent: true, to: m.to, id: '<d1@gmail.com>' })
    expect(g.sent).toHaveLength(1)
    const mail = g.sent[0] as { raw: Buffer; envelope: { from: string; to: string[] } }
    expect(mail.envelope).toEqual({ from: 'me@gmail.com', to: ['sam@grandbb.example'] })
    // the draft's own words and Message-ID, dated when it goes
    expect(String(mail.raw)).toContain('Message-ID: <d1@gmail.com>')
    expect(String(mail.raw)).toContain('\r\n\r\nHi Sam')
    expect(String(mail.raw)).not.toContain('1 Oct 2026')
    expect(g.removed).toEqual(['<d1@gmail.com>'])
  })

  // Kenil's run, 29 Oct 16:22: Alpha had the draft's id and still sent a new email beside it, so
  // Gmail itself sends the draft in Drafts that is this very email
  it('sends the draft in Drafts that is the same email when the send names none', async () => {
    const g = drafts(saved())
    const same = { ...g.hands, sameDraft: async () => ({ ...saved(), id: '<d1@gmail.com>' }) }
    const out = await sendOnce('me@gmail.com', m, same)
    expect(out).toMatchObject({ id: '<d1@gmail.com>' })
    expect(out.words).toMatch(/your draft/)
    expect(String((g.sent[0] as { raw: Buffer }).raw)).toContain('Message-ID: <d1@gmail.com>')
    expect(g.removed).toEqual(['<d1@gmail.com>'])
    // no such draft: a new email, as before
    const none = drafts(null)
    const fresh = await sendOnce('me@gmail.com', m, { ...none.hands, sameDraft: async () => null })
    expect(fresh.id).toMatch(/^<alpha-/)
    expect(none.removed).toEqual([])
  })

  it('refuses a draft changed since the card, or gone, and sends nothing', async () => {
    const changed = drafts(saved({ body: 'Hi Sam, see you Friday' }))
    await expect(
      sendOnce('me@gmail.com', { ...m, draft: '<d1@gmail.com>' }, changed.hands),
    ).rejects.toThrow(/not what the card showed \(its text\)/)
    const more = drafts(saved({ cc: ['ann@grandbb.example'], attachments: ['menu.pdf'] }))
    await expect(
      sendOnce('me@gmail.com', { ...m, draft: '<d1@gmail.com>' }, more.hands),
    ).rejects.toThrow(/its Cc, its attachments/)
    const gone = drafts(null)
    await expect(
      sendOnce('me@gmail.com', { ...m, draft: '<d1@gmail.com>' }, gone.hands),
    ).rejects.toMatchObject({ kind: 'gone' })
    expect([changed.sent, more.sent, gone.sent, changed.removed]).toEqual([[], [], [], []])
  })
})

