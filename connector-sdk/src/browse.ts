// What an agent sees of a page it browses: the page as numbered elements from its accessibility
// tree, the tree a screen reader reads (role, name, value and state, inside the list, form or
// dialog each sits in), and a small picture of it. The numbers are the snapshot's own references,
// so a click finds the element the agent saw; they hold until the page changes. An element inside
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

export async function see(page: Page, limit: number, words?: string): Promise<Seen> {
  const lines = compact(await page.ariaSnapshot({ mode: 'ai' }))
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

// Clicks the element the agent named, once or twice (a row that opens on a double click). A new
// tab the click opened (a file opened from a list) comes back, for the work to go on in.
export async function press(
  page: Page,
  n: Ref,
  twice: boolean,
  wait: number,
): Promise<Page | null> {
  const opened: Page[] = []
  const onPage = (p: Page) => opened.push(p)
  page.context().on('page', onPage)
  try {
    const el = element(page, n)
    if (twice) await el.dblclick({ timeout: 10_000 })
    else await el.click({ timeout: 10_000 })
    await new Promise((r) => setTimeout(r, wait))
  } finally {
    page.context().off('page', onPage)
  }
  return opened[0] ?? null
}
