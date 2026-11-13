// A site's sign-in on a server, where there is no screen: a live picture of the server's browser
// sent to the person's window, and what they click and type sent back. They sign in themselves, so
// Alpha never holds the password. It watches for the moment the page that asked for a sign-in opens
// without one, and says so.
import type { BrowserContext, CDPSession, Page } from 'playwright'

// `held`: the modifier keys really down in the person's window at that moment. `count`: which
// press this is of quick presses in one place: the second makes a double click, as a folder's
// opening needs, where two single clicks only select it twice.
type Point = {
  x: number
  y: number
  button?: 'left' | 'right' | 'middle'
  held?: string[]
  count?: number
}

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

const MODIFIERS = ['Control', 'Shift', 'Alt', 'Meta']

// What the person did on the live picture, done on the page. `down` keeps the keys sent down and
// not yet up: a key whose release never arrived (the window lost the keys mid-press, as a
// screenshot's shortcut does) would stay held on the page, and a held Control makes every click a
// right click. So a press of the mouse lets go of any modifier the person is not really holding.
export async function inputTo(page: Page, e: LiveInput, down = new Set<string>()): Promise<void> {
  if (e.kind === 'keydown') down.add(e.key)
  if (e.kind === 'keyup') down.delete(e.key)
  if (e.kind === 'down' && e.held)
    for (const k of MODIFIERS)
      if (down.has(k) && !e.held.includes(k)) {
        down.delete(k)
        await page.keyboard.up(k).catch(() => undefined)
      }
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
    if (e.kind !== 'move')
      await page.mouse[e.kind]({ button: e.button ?? 'left', clickCount: e.count ?? 1 })
  }
}

// Every key the person's window sent down is let go: nothing stays held on the page after them.
export async function letGo(page: Page, down: Set<string>): Promise<void> {
  for (const k of new Set([...down, ...MODIFIERS])) await page.keyboard.up(k).catch(() => undefined)
  down.clear()
}

// A page's live picture, sent frame by frame until stopped.
export async function screencast(
  page: Page,
  frames: (jpeg: string) => void,
  size: { width: number; height: number },
): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page)
  cdp.on('Page.screencastFrame', (f: { data: string; sessionId: number }) => {
    frames(f.data)
    void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined)
  })
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: QUALITY,
    maxWidth: size.width,
    maxHeight: size.height,
  })
  return cdp
}

// A piece of work's tab, watched: the page an agent works on, as a live picture in the person's
// window. Watching sends nothing to the page; what the person does reaches it only while they hold
// it (the engine's hold), and follows the work when a click moves it to another tab.
export class LiveTab {
  private page: Page
  private cdp: CDPSession | null = null
  private frames: ((jpeg: string) => void) | null = null
  private stopped = false
  private down = new Set<string>() // the keys the person holds on the page

  constructor(page: Page) {
    this.page = page
  }

  // The page changes hands: no key of the person's stays held on it for the agent's next click.
  async letGo(): Promise<void> {
    if (!this.page.isClosed()) await letGo(this.page, this.down)
  }

  size(): { width: number; height: number } {
    return this.page.viewportSize() ?? LIVE_SIZE
  }

  async start(frames: (jpeg: string) => void): Promise<void> {
    this.frames = frames
    await this.show(this.page)
  }

  async show(page: Page): Promise<void> {
    if (this.stopped || !this.frames) return
    await this.cdp?.detach().catch(() => undefined)
    this.page = page
    this.cdp = await screencast(page, this.frames, this.size())
  }

  async input(e: LiveInput): Promise<void> {
    if (!this.stopped && !this.page.isClosed()) await inputTo(this.page, e, this.down)
  }

  async close(): Promise<void> {
    this.stopped = true
    await this.cdp?.detach().catch(() => undefined)
  }
}

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
  private sawSignIn = false // a sign-in was on screen in this picture
  private poll: ReturnType<typeof setInterval> | null = null
  private checking = false
  private finished = false
  private down = new Set<string>() // the keys the person holds on the page

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
    this.cdp = await screencast(page, (f) => this.frames?.(f), LIVE_SIZE)
  }

  private soon(ms: number): void {
    if (this.finished || this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.check()
    }, ms)
  }

  // Still at a sign-in (a password box, or the account's name asked first), nothing has happened
  // yet. Once a sign-in has been seen and is gone, a quiet look at the page that asked for it, which
  // opens without one once they are in. A site's home page with no sign-in on it never closes this:
  // the person goes to its sign-in, or presses that they are in.
  private async check(): Promise<void> {
    const page = this.page
    if (this.finished || this.checking || !page) return
    this.checking = true
    try {
      if (await atSignIn(page).catch(() => true)) {
        this.sawSignIn = true
        return
      }
      if (!this.sawSignIn) return
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
    await inputTo(page, e, this.down)
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
