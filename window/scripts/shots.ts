// Screenshots of every screen, in light and dark, at a large and a small window, for looking at a
// change before it is called done (the window redesign's check). Taken in WebKit, the engine of
// Safari and of the Mac shell, set up once in .data/browsers.
//   pnpm shots "http://127.0.0.1:4710/?t=<token>"
// Shots go to .data/shots/<time>/, named screen-theme-size.png.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
process.env.PLAYWRIGHT_BROWSERS_PATH = join(ROOT, '.data', 'browsers')
const { webkit } = await import('playwright')

const SIZES = [
  { width: 1440, height: 900 },
  { width: 1024, height: 700 },
]
const THEMES = ['light', 'dark'] as const

const address = process.argv[2]
if (!address || !URL.canParse(address)) {
  console.error('Give the address the core printed: pnpm shots "http://127.0.0.1:4700/?t=…"')
  process.exit(1)
}
const url = new URL(address)
const token = url.searchParams.get('t') ?? ''
const base = `${url.origin}/?t=${token}`

if (!existsSync(webkit.executablePath())) {
  console.log('Setting up WebKit for the shots, once…')
  const cli = join(
    createRequire(import.meta.url).resolve('playwright/package.json'),
    '..',
    'cli.js',
  )
  execFileSync(process.execPath, [cli, 'install', 'webkit'], { stdio: 'inherit' })
}

// The screens: Home, Activity, Settings, every table, and a board for each table with a choice.
const modules = (await (
  await fetch(`${url.origin}/api/modules`, { headers: { 'x-alpha-token': token } })
).json()) as { tables: { id: string; name: string }[] }[]
const screens: { name: string; hash: string; board?: boolean }[] = [
  { name: 'home', hash: '#/' },
  { name: 'activity', hash: '#/activity' },
  { name: 'settings', hash: '#/settings' },
  { name: 'parts', hash: '#/parts' },
]
for (const t of modules.flatMap((m) => m.tables)) {
  const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  screens.push({ name: `table-${slug}`, hash: `#/table/${t.id}` })
  screens.push({ name: `board-${slug}`, hash: `#/table/${t.id}`, board: true })
}

const out = join(
  ROOT,
  '.data',
  'shots',
  new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'),
)
mkdirSync(out, { recursive: true })
const browser = await webkit.launch()
let taken = 0
for (const size of SIZES)
  for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: size, colorScheme: theme })
    for (const s of screens) {
      // a fresh load each time: a change of hash alone keeps the last screen's state
      await page.goto('about:blank')
      await page.goto(`${base}${s.hash}`)
      await page.waitForSelector('nav')
      if (s.board) {
        const board = page.getByRole('button', { name: 'Board', exact: true })
        if (!(await board.count())) continue // a table with no choice to group by has no board
        await board.click()
      }
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(400)
      await page.screenshot({
        path: join(out, `${s.name}-${theme}-${size.width}x${size.height}.png`),
      })
      taken++
    }
    await page.close()
  }
await browser.close()
console.log(`${taken} shots in ${out}`)
