// browse: the acting browser's tool. Pages open as the person the work is for, in a tab of that
// work's own in their profile for the site, and come back as numbered elements from the page's
// accessibility tree. Reading, moving around and clicking a link, a menu, a row or a button that
// sends nothing go without asking; typing, choosing and what cannot be taken back wait for the
// person's yes, which the gate asks before the step runs (../acting.ts). Each step keeps a small
// picture in the record.
import { element, press, pressAt, said, see, typeInto } from '@alpha/connector-sdk'
import { z } from 'zod'
import { config } from '../../config.ts'
import { Refused } from '../../world/kinds.ts'
import { handOver, tabOf } from '../acting.ts'
import type { ToolEntry } from '../registry.ts'
import { guardAsync, ok, type Result, type Tooling, tool } from './common.ts'

const ACTIONS = [
  'open',
  'read',
  'find',
  'click',
  'type',
  'key',
  'choose',
  'scroll',
  'back',
  'wait',
  'picture',
  'hand_over',
  'close',
] as const

export function browseTools(t: Tooling): ToolEntry[] {
  const { world, here, hands } = t
  if (!hands) return []
  const browsers = hands.browser
  return [
    tool(
      'browse',
      'Use a website as the person, in a browser that keeps their sign-ins. Actions: open (url), read (url: an address that gives text and not a page, such as a site’s own text export of a document, read as the person without leaving the page), find (words: the elements whose names hold them, on a big page), click (n: an element’s number as shown, such as 12 or f1e3; twice: true for a row that opens on a double click, as in a file list; a file that opens in a new tab is followed there; or x and y in place of n: a place in the picture, in its pixels, where a page drawn on a canvas has no element to name), type (text; n: the box to fill in place of what it holds, or no n to type where the cursor is, as on a page drawn on a canvas; enter: true to press Enter after), key (keys: one key or chord as the browser names it, such as Enter, Escape, ArrowDown, ControlOrMeta+a; a document’s end is Meta+ArrowDown where the browser runs on a Mac and Control+End elsewhere, so check where the cursor went before typing), choose (n: a list; option: its label), scroll (direction up or down), back, wait (words to wait for), picture (the page as drawn, for a page drawn on a canvas or to check a result), hand_over (words: why; asks the person onto the page for what only they can do, such as a code sent to their phone or a choice that is theirs: they take the page over in their window and hand it back), close. Every step returns the page’s address and the page as numbered elements: use the numbers from the newest view. Use look to read a page once; browse to work through a site. Typing, choosing and a button that sends to other people ask the person once for this work; a step that cannot be taken back asks each time. When a step waits on their card, stop and say so.',
      {
        action: z.enum(ACTIONS),
        url: z.string().optional(),
        n: z.union([z.number().int().positive(), z.string().regex(/^(?:f\d+e)?\d+$/)]).optional(),
        twice: z.boolean().optional(),
        x: z.number().min(0).optional(),
        y: z.number().min(0).optional(),
        words: z.string().optional(),
        text: z.string().optional(),
        enter: z.boolean().optional(),
        keys: z.string().optional(),
        option: z.string().optional(),
        direction: z.enum(['up', 'down']).optional(),
      },
      async ({ action, url, n, twice, x, y, words, text, enter, keys, option, direction }) =>
        guardAsync(async () => {
          const cur = here.current
          // a check page that did not clear by itself: the person is asked onto the page to pass
          // it themselves, and the rest of the work carries on
          const stopped = async (err: { kind?: string; message?: string }) => {
            if (err.kind !== 'blocked' || !/a person is there/.test(err.message ?? '')) throw err
            await handOver(world, browsers(), cur, cur.user, t.ctx().actor, err.message ?? '')
            return ok(
              `${err.message} The person is asked on a card to open the page and pass it themselves. Do not try to pass it. Do what else you can, then end your turn saying what waits; you are told when they hand the page back.`,
            )
          }
          return run().catch(stopped)
          async function run(): Promise<Result> {
            // the person this work is for, and the work itself: one request, or the task it serves
            const browser = browsers().as(cur.user.id)
            const work = tabOf(cur)
            const limits = config.limits()
            const step = () => new Promise((r) => setTimeout(r, limits.browse_step_ms))
            if (action === 'hand_over') {
              if (!words?.trim()) throw new Refused('hand_over needs the words: why you need them.')
              await handOver(world, browsers(), cur, cur.user, t.ctx().actor, words)
              return ok(
                'Asked the person onto the page, on a card in their window. Do not work on this page until they hand it back: do what else you can, then end your turn saying what waits. You are told when they hand it back.',
              )
            }
            if (action === 'close') {
              await browser.closeTab(work)
              return ok('Closed.')
            }
            if (action === 'read') {
              if (!url) throw new Refused('read needs the address.')
              const got = await browser
                .read(url, limits.browse_read_chars)
                .catch((err: { kind?: string }) => {
                  if (err.kind === 'sign_in') signInCard(url, cur.user.id, cur.turn)
                  throw err
                })
              return ok(
                `${new URL(url).host} · ${got.type}\n${got.text}${got.more ? `\n… ${got.more} more characters` : ''}`,
              )
            }
            if (action === 'open') {
              if (!url) throw new Refused('open needs the address.')
              await browser.tab(work, url).catch((err: { kind?: string; message?: string }) => {
                if (err.kind === 'sign_in') signInCard(url, cur.user.id, cur.turn)
                throw err
              })
            }
            let page = await browser.tab(work)
            let host = new URL(page.url()).host
            if (action === 'click') {
              const point = x !== undefined && y !== undefined ? { x, y } : null
              if (n === undefined && !point)
                throw new Refused('click needs an element’s number, or x and y in the picture.')
              if (n !== undefined && !said(page, n))
                throw new Refused(
                  `The page as last seen has no element ${n}: look at it again (find, or wait).`,
                )
              const opened =
                n !== undefined
                  ? await press(page, n, twice ?? false, limits.browse_step_ms)
                  : await pressAt(
                      page,
                      point as { x: number; y: number },
                      twice ?? false,
                      limits.browse_step_ms,
                    )
              if (opened) {
                page = await browser.follow(work, opened)
                host = new URL(page.url()).host
              }
              await browser.settle(page, host)
            } else if (action === 'type') {
              if (text === undefined) throw new Refused('type needs the text.')
              if (n !== undefined && !said(page, n))
                throw new Refused(
                  `The page as last seen has no element ${n}: look at it again (find, or wait).`,
                )
              await typeInto(page, text, n, enter ?? false)
              await step()
              await browser.settle(page, host)
            } else if (action === 'key') {
              if (!keys?.trim()) throw new Refused('key needs the keys, such as Enter.')
              await page.keyboard.press(keys.trim())
              await step()
              await browser.settle(page, host)
            } else if (action === 'choose') {
              if (n === undefined || option === undefined)
                throw new Refused('choose needs the list’s number and the option.')
              if (!said(page, n))
                throw new Refused(
                  `The page as last seen has no element ${n}: look at it again (find, or wait).`,
                )
              await element(page, n).selectOption({ label: option }, { timeout: 10_000 })
              await step()
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
                  {
                    type: 'text',
                    text: `${host} · ${seen.title} (a place in it is x, y in its pixels)`,
                  },
                  { type: 'image', data: seen.picture.toString('base64'), mimeType: 'image/jpeg' },
                ],
              }
            return ok(
              [
                `${seen.url.slice(0, 400)} · ${seen.title}${seen.drawn ? ' (drawn on a canvas: its words may not be here. read the site’s text export of it if it has one; else picture, a click by x and y, and keys)' : ''}`,
                seen.elements || '(nothing here yet: wait, or scroll)',
                seen.more ? `… ${seen.more} more: scroll, or find by words` : '',
              ]
                .filter(Boolean)
                .join('\n'),
            )
          }
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
