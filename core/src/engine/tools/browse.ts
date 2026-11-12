// browse: the acting browser's tool. Pages open as the person the work is for, in a tab of that
// work's own in their profile for the site, and come back as numbered elements from the page's
// accessibility tree. Reading, moving around and clicking a link, a menu, a row or a button that
// sends nothing go without asking; each step keeps a small picture in the record.
import { element, see } from '@alpha/connector-sdk'
import { z } from 'zod'
import { config } from '../../config.ts'
import { Refused } from '../../world/kinds.ts'
import type { ToolEntry } from '../registry.ts'
import { guardAsync, ok, type Tooling, tool } from './common.ts'

const ACTIONS = ['open', 'find', 'click', 'scroll', 'back', 'wait', 'picture', 'close'] as const

// A button or menu item whose words send something to other people or cannot be taken back.
export function asks(said: string): boolean {
  const first = said.split('\n')[0] ?? ''
  if (!/^- (?:button|menuitem)\b/.test(first)) return false
  const words = first.replace(/\bsign (?:in|up|out)\b/gi, '')
  const list = config.words().browse_asks.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`\\b(?:${list.join('|')})\\b`, 'i').test(words)
}

export function browseTools(t: Tooling): ToolEntry[] {
  const { world, here, hands } = t
  if (!hands) return []
  return [
    tool(
      'browse',
      'Use a website as the person, in a browser that keeps their sign-ins. Actions: open (url), find (words: the elements whose names hold them, on a big page), click (n: an element’s number), scroll (direction up or down), back, wait (words to wait for), picture (the page as drawn, for a page drawn on a canvas or to check a result), close. Every step returns the page as numbered elements; numbers hold until the page changes. Use look to read a page once; browse to work through a site. Typing into a site is not here yet.',
      {
        action: z.enum(ACTIONS),
        url: z.string().optional(),
        n: z.number().int().positive().optional(),
        words: z.string().optional(),
        direction: z.enum(['up', 'down']).optional(),
      },
      async ({ action, url, n, words, direction }) =>
        guardAsync(async () => {
          const cur = here.current
          // the person this work is for, and the work itself: one request, or the task it serves
          const browser = hands.browser().as(cur.user.id)
          const work = cur.root ?? cur.turn ?? 'chat'
          const limits = config.limits()
          const step = () => new Promise((r) => setTimeout(r, limits.browse_step_ms))
          if (action === 'close') {
            await browser.closeTab(work)
            return ok('Closed.')
          }
          if (action === 'open') {
            if (!url) throw new Refused('open needs the address.')
            await browser.tab(work, url).catch((err: { kind?: string; message?: string }) => {
              if (err.kind === 'sign_in') signInCard(url, cur.user.id, cur.turn)
              throw err
            })
          }
          const page = await browser.tab(work)
          const host = new URL(page.url()).host
          if (action === 'click') {
            if (!n) throw new Refused('click needs an element’s number.')
            const el = element(page, n)
            const said = await el.ariaSnapshot({ timeout: 5_000 }).catch(() => '')
            if (/^- (?:textbox|searchbox|combobox)\b/.test(said))
              throw new Refused('That is a box to type in: typing into a site comes with acting.')
            if (asks(said))
              throw new Refused(
                `${said.replace(/^- /, '').split('\n')[0]} sends something or cannot be taken back: that waits for acting, with the person's yes.`,
              )
            await el.click({ timeout: 10_000 })
            await step()
            await browser.settle(page, host)
          } else if (action === 'scroll') {
            await page.mouse.wheel(0, direction === 'up' ? -700 : 700)
            await step()
          } else if (action === 'back') {
            await page.goBack({ waitUntil: 'domcontentloaded' })
            await browser.settle(page, host)
          } else if (action === 'wait') {
            if (!words?.trim()) throw new Refused('wait needs the words to wait for.')
            await page.getByText(words.trim()).first().waitFor({ timeout: 20_000 })
          }
          const seen = await see(
            page,
            limits.browse_elements,
            action === 'find' ? words : undefined,
          )
          // the step's picture, kept by its hash for the record: the gate names it on the step's line
          here.picture = world.files.keepPicture(seen.picture)
          if (action === 'picture')
            return {
              content: [
                { type: 'text', text: `${host} · ${seen.title}` },
                { type: 'image', data: seen.picture.toString('base64'), mimeType: 'image/jpeg' },
              ],
            }
          return ok(
            [
              `${host} · ${seen.title}${seen.drawn ? ' (drawn on a canvas: use picture, positions and keys)' : ''}`,
              seen.elements || '(nothing here yet: wait, or scroll)',
              seen.more ? `… ${seen.more} more: scroll, or find by words` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          )
        }),
    ),
  ]

  // A site the person has not signed in to: the work waits on their Sign in card, as a run's does.
  function signInCard(url: string, user: string, turn: string | null): void {
    const host = new URL(url).host.toLowerCase()
    world.cards.open({
      kind: 'permission',
      gate: 'sign_in',
      words: `${host} wants you to sign in`,
      detail: `An agent is working on ${host} as you and met its sign-in. Sign in opens it in Alpha's browser, where you type your login yourself; Alpha never sees it.`,
      restsOn: [`work on ${host} for you`],
      options: ['Sign in', 'Not now'],
      call: { tool: 'site_sign_in', input: { host, url, schedule: null } },
      actor: { kind: 'system' },
      user,
      turn,
    })
  }
}
