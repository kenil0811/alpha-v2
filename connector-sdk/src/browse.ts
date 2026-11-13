// What an agent sees of a page it browses: the page as numbered elements from its accessibility
// tree, the tree a screen reader reads (role, name, value and state, inside the list, form or
// dialog each sits in), and a small picture of it. The numbers are the snapshot's own references,
// so a click finds the element the agent saw; each view numbers the page afresh. An element inside
// a frame keeps its frame in its number (f1e3).
import type { Page } from 'playwright'

export interface Seen {
  url: string
  title: string
  elements: string // one element a line, [n] before each the agent can act on
  more: number // elements past the limit: reached by scroll, or find by words
  drawn: boolean // the page's main part is drawn on a canvas (a Doc): use picture, positions and keys
  picture: Buffer // a small JPEG of the page as it is now
}

// The snapshot's lines, tidied for reading: references as [n] at the front, nameless containers
// and pointer marks left out.
export function compact(snapshot: string): string[] {
  return snapshot
    .split('\n')
    .filter((l) => !/^\s*- generic(?: \[[^\]]*\])*:?$/.test(l))
    .map((l) => {
      const m = / \[ref=(f\d+)?e(\d+)\]/.exec(l)
      const ref = m ? (m[1] ? `${m[1]}e${m[2]}` : m[2]) : undefined
      const tidy = l
        .replace(/ \[ref=(?:f\d+)?e\d+\]/, '')
        .replace(/ \[(?:cursor=pointer|active)\]/g, '')
        .replace(/^(\s*)- /, '$1')
      return ref ? tidy.replace(/^(\s*)/, `$1[${ref}] `) : tidy
    })
    .filter((l) => l.trim())
}

// Each page's last view, to say what a numbered element is without another snapshot: a snapshot of
// any part of a page numbers it afresh, and the agent's numbers would stop working.
const lastSeen = new WeakMap<Page, string[]>()

export async function see(page: Page, limit: number, words?: string): Promise<Seen> {
  const lines = compact(await page.ariaSnapshot({ mode: 'ai' }))
  lastSeen.set(page, lines)
  const want = words?.trim().toLowerCase()
  const picked = want ? lines.filter((l) => l.toLowerCase().includes(want)) : lines
  const shown = picked.slice(0, Math.max(1, limit))
  const drawn = await page
    .evaluate(() => {
      const c = [...document.querySelectorAll('canvas')]
      const area = window.innerWidth * window.innerHeight
      return c.some((x) => x.clientWidth * x.clientHeight > area / 3)
    })
    .catch(() => false)
  return {
    url: page.url(),
    title: await page.title().catch(() => ''),
    elements: shown.join('\n'),
    more: picked.length - shown.length,
    drawn,
    picture: await page.screenshot({ type: 'jpeg', quality: 45, scale: 'css' }),
  }
}

// The element the agent named by its number, as the last snapshot saw it.
export type Ref = number | string
export const element = (page: Page, n: Ref) =>
  page.getByRef(/^\d+$/.test(String(n)) ? `e${n}` : String(n))

// What the page's last view said an element is, such as `button "Share"`: '' when it showed none.
export function said(page: Page, n: Ref): string {
  const tag = `[${n}] `
  const line = lastSeen.get(page)?.find((l) => l.trimStart().startsWith(tag))
  return line ? line.trimStart().slice(tag.length).replace(/:$/, '') : ''
}

// The dialog an element sits in, by its name in the page's last view: '' when it is in none.
export function dialogOf(page: Page, n: Ref): string {
  const lines = lastSeen.get(page) ?? []
  const tag = `[${n}] `
  const at = lines.findIndex((l) => l.trimStart().startsWith(tag))
  if (at < 0) return ''
  let depth = (lines[at] ?? '').search(/\S/)
  for (let i = at - 1; i >= 0 && depth > 0; i--) {
    const l = lines[i] ?? ''
    const d = l.search(/\S/)
    if (d >= depth) continue
    depth = d
    const m = /^(?:\[[^\]]+\] )?(?:dialog|alertdialog)(?: "([^"]*)")?/.exec(l.trimStart())
    if (m) return m[1] ?? ''
  }
  return ''
}

// What has the keys now: whether it takes text or sits in a form, its own words, and its dialog's.
export async function focused(
  page: Page,
): Promise<{ editable: boolean; words: string; dialog: string }> {
  return page
    .evaluate(() => {
      let a: Element | null = document.activeElement
      while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement
      const h = a as HTMLElement | null
      const box = h?.closest('[role=dialog],[role=alertdialog],dialog')
      return {
        editable:
          !!h &&
          (h.isContentEditable ||
            /^(INPUT|TEXTAREA|SELECT)$/.test(h.tagName) ||
            !!h.closest('form') ||
            h.tagName === 'IFRAME'),
        words:
          h && /^(BUTTON|A)$/.test(h.tagName)
            ? (h.innerText || h.getAttribute('aria-label') || '').slice(0, 80)
            : '',
        dialog: box
          ? (
              box.getAttribute('aria-label') ||
              box.querySelector('h1,h2,h3')?.textContent ||
              ''
            ).slice(0, 120)
          : '',
      }
    })
    .catch(() => ({ editable: true, words: '', dialog: '' }))
}

// The page as it is now with one element outlined, or one place ringed, for the card that asks
// about a step on it.
export async function outlined(
  page: Page,
  n?: Ref,
  point?: { x: number; y: number },
): Promise<Buffer> {
  const found =
    n === undefined
      ? null
      : await element(page, n)
          .boundingBox({ timeout: 2_000 })
          .catch(() => null)
  // a place the step is about, where no element names it: a ring around it
  const box = found ?? (point ? { x: point.x - 14, y: point.y - 14, width: 28, height: 28 } : null)
  if (box)
    await page
      .evaluate((b) => {
        const d = document.createElement('div')
        d.id = 'alpha-outline'
        d.style.cssText = `position:fixed;left:${b.x - 4}px;top:${b.y - 4}px;width:${b.width + 8}px;height:${b.height + 8}px;border:3px solid #e11d48;border-radius:6px;z-index:2147483647;pointer-events:none;box-sizing:border-box`
        document.documentElement.appendChild(d)
      }, box)
      .catch(() => undefined)
  try {
    return await page.screenshot({ type: 'jpeg', quality: 45, scale: 'css' })
  } finally {
    if (box)
      await page
        .evaluate(() => document.getElementById('alpha-outline')?.remove())
        .catch(() => undefined)
  }
}

// Types into the element the agent named, in place of what it held, or where the keys are now (a
// page drawn on a canvas takes its text there); then Enter, when asked.
export async function typeInto(
  page: Page,
  text: string,
  n: Ref | undefined,
  enter: boolean,
): Promise<void> {
  if (n === undefined) await page.keyboard.type(text, { delay: 12 })
  else {
    const el = element(page, n)
    await el.fill(text, { timeout: 10_000 }).catch(async () => {
      await el.click({ timeout: 10_000 })
      await page.keyboard.type(text, { delay: 12 })
    })
  }
  if (enter) await page.keyboard.press('Enter')
}

// A click, and the new tab it opened (a file opened from a list), for the work to go on in.
async function clicking(
  page: Page,
  wait: number,
  click: () => Promise<void>,
): Promise<Page | null> {
  const opened: Page[] = []
  const onPage = (p: Page) => opened.push(p)
  page.context().on('page', onPage)
  try {
    await click()
    await new Promise((r) => setTimeout(r, wait))
  } finally {
    page.context().off('page', onPage)
  }
  return opened[0] ?? null
}

// Clicks the element the agent named, once or twice (a row that opens on a double click).
export function press(page: Page, n: Ref, twice: boolean, wait: number): Promise<Page | null> {
  const el = element(page, n)
  return clicking(page, wait, () =>
    twice ? el.dblclick({ timeout: 10_000 }) : el.click({ timeout: 10_000 }),
  )
}

// Clicks a place on the page as drawn, by its position in the picture: where a page drawn on a
// canvas has no element to name.
export function pressAt(
  page: Page,
  at: { x: number; y: number },
  twice: boolean,
  wait: number,
): Promise<Page | null> {
  return clicking(page, wait, () =>
    twice ? page.mouse.dblclick(at.x, at.y) : page.mouse.click(at.x, at.y),
  )
}

// What is at a place on the page, said as a view says an element (button "Share"), and the dialog
// it sits in: so a click by position is judged as a click by number is.
export async function whatAt(
  page: Page,
  at: { x: number; y: number },
): Promise<{ what: string; dialog: string }> {
  return page
    .evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y) as HTMLElement | null
      const el =
        (hit?.closest(
          'button,[role=button],[role=menuitem],a[href],input,textarea,select,[contenteditable=true]',
        ) as HTMLElement | null) ?? hit
      if (!el) return { what: '', dialog: '' }
      const tag = el.tagName
      const type = (el.getAttribute('type') ?? '').toLowerCase()
      const given = el.getAttribute('role')
      const role =
        given === 'menuitem'
          ? 'menuitem'
          : tag === 'BUTTON' ||
              given === 'button' ||
              (tag === 'INPUT' && /^(submit|button)$/.test(type))
            ? 'button'
            : tag === 'A'
              ? 'link'
              : /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || el.isContentEditable
                ? 'textbox'
                : tag === 'CANVAS'
                  ? 'canvas'
                  : 'generic'
      const name = (
        el.getAttribute('aria-label') ||
        (el as HTMLInputElement).value ||
        el.innerText ||
        ''
      )
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80)
      const box = el.closest('[role=dialog],[role=alertdialog],dialog')
      return {
        what: `${role} "${name}"`,
        dialog: box
          ? (box.getAttribute('aria-label') || box.querySelector('h1,h2,h3')?.textContent || '')
              .trim()
              .slice(0, 120)
          : '',
      }
    }, at)
    .catch(() => ({ what: '', dialog: '' }))
}
