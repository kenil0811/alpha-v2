// A site's sign-in on a server, where there is no screen: a live picture of the server's browser
// sent to the person's window, and what they click and type sent back. They sign in themselves, so
// Alpha never holds the password. It watches for the moment the page that asked for a sign-in opens
// without one, and says so.
import type { BrowserContext, CDPSession, Page } from 'playwright'

type Point = { x: number; y: number; button?: 'left' | 'right' | 'middle' }

export type LiveInput =
  | ({ kind: 'move' } & Point)
  | ({ kind: 'down' } & Point)
  | ({ kind: 'up' } & Point)
  | { kind: 'wheel'; x: number; y: number; dx: number; dy: number }
  | { kind: 'keydown'; key: string }
  | { kind: 'keyup'; key: string }
  | { kind: 'paste'; text: string }

// A page that is a sign-in: a password box, an address that says it signs in (Google's form draws
// its boxes after the page has loaded), or a box for the account's name on a page titled so.
export async function atSignIn(page: Page): Promise<boolean> {
  if ((await page.locator('input[type="password"]:visible').count()) > 0) return true
  if (SIGN_IN.test(new URL(page.url()).pathname)) return true
  const account = await page
    .locator('input[type="email"]:visible, input[autocomplete="username"]:visible')
    .count()
  return account > 0 && SIGN_IN.test(await page.title())
}
const SIGN_IN = /sign[ -_]?in|log[ -_]?in|ServiceLogin|identifier/i

export const LIVE_SIZE = { width: 1280, height: 800 }

// How the picture is sent: jpeg, good enough to read a form, small enough to feel immediate.
const QUALITY = 70
const CHECK_AFTER_MS = 1200
const CHECK_EVERY_MS = 4000

export class LiveBrowser {
  private context: BrowserContext
  private url: string
  private walled: () => Promise<boolean>
  private page: Page | null = null
  private cdp: CDPSession | null = null
  private frames: ((jpeg: string) => void) | null = null
  private inDone: (() => void) | null = null
  private pages: Page[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private poll: ReturnType<typeof setInterval> | null = null
  private checking = false
  private finished = false

  constructor(context: BrowserContext, url: string, walled: () => Promise<boolean>) {
    this.context = context
    this.url = url
    this.walled = walled
  }

  async start(frames: (jpeg: string) => void, done: () => void): Promise<void> {
    this.frames = frames
    this.inDone = done
    // a sign-in that opens its own window ("Sign in with…") is followed there and back
    this.context.on('page', this.opened)
    const page = await this.context.newPage()
    await page.setViewportSize(LIVE_SIZE)
    await this.show(page)
    await page.goto(this.url, { waitUntil: 'domcontentloaded' }).catch(() => undefined)
    this.poll = setInterval(() => this.soon(0), CHECK_EVERY_MS)
  }

  // Only what this sign-in's own pages opened: a reader's page in the same browser is not its own.
  private opened = (page: Page): void => {
    void page
      .opener()
      .then((from) => {
        if (this.finished || !from || !this.pages.includes(from)) return
        return this.show(page)
      })
      .catch(() => undefined)
  }

  private async show(page: Page): Promise<void> {
    await this.cdp?.detach().catch(() => undefined)
    this.page = page
    this.pages.push(page)
    page.on('framenavigated', (f) => {
      if (f === page.mainFrame()) this.soon(CHECK_AFTER_MS)
    })
    page.on('close', () => {
      this.pages = this.pages.filter((p) => p !== page)
      const back = this.pages.at(-1)
      if (this.page === page && back && !this.finished) void this.show(back).catch(() => undefined)
    })
    const cdp = await this.context.newCDPSession(page)
    this.cdp = cdp
    cdp.on('Page.screencastFrame', (f: { data: string; sessionId: number }) => {
      this.frames?.(f.data)
      void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined)
    })
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: QUALITY,
      maxWidth: LIVE_SIZE.width,
      maxHeight: LIVE_SIZE.height,
    })
  }

  private soon(ms: number): void {
    if (this.finished || this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.check()
    }, ms)
  }

  // Still at a sign-in (a password box, or the account's name asked first), nothing has happened yet. Otherwise a quiet look at the page that
  // asked for the sign-in, which opens without one once they are in.
  private async check(): Promise<void> {
    const page = this.page
    if (this.finished || this.checking || !page) return
    this.checking = true
    try {
      if (await atSignIn(page).catch(() => true)) return
      if (await this.walled().catch(() => true)) return
      this.finish()
    } finally {
      this.checking = false
    }
  }

  private finish(): void {
    if (this.finished) return
    this.finished = true
    this.inDone?.()
  }

  async input(e: LiveInput): Promise<void> {
    const page = this.page
    if (!page || this.finished) return
    if (e.kind === 'keydown' || e.kind === 'keyup') {
      const press = e.kind === 'keydown' ? page.keyboard.down : page.keyboard.up
      // a key the keyboard does not name (an accented letter) is typed as itself
      await press.call(page.keyboard, e.key).catch(async () => {
        if (e.kind === 'keydown' && e.key.length === 1) await page.keyboard.insertText(e.key)
      })
    } else if (e.kind === 'paste') await page.keyboard.insertText(e.text)
    else if (e.kind === 'wheel') {
      await page.mouse.move(e.x, e.y)
      await page.mouse.wheel(e.dx, e.dy)
    } else {
      await page.mouse.move(e.x, e.y)
      if (e.kind !== 'move') await page.mouse[e.kind]({ button: e.button ?? 'left' })
    }
    this.soon(CHECK_AFTER_MS)
  }

  async close(): Promise<void> {
    this.finished = true
    if (this.timer) clearTimeout(this.timer)
    if (this.poll) clearInterval(this.poll)
    this.context.off('page', this.opened)
    await this.cdp?.detach().catch(() => undefined)
    for (const p of this.pages) await p.close().catch(() => undefined)
    this.pages = []
  }
}
