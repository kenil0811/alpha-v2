// Draws the shell's icons from Alpha's mark as the rail draws it (the ink tile, the serif A):
// the app's icon (source.png, which `cargo tauri icon` turns into the bundle's sizes) and the menu
// bar's mark, plain and with a dot when something waits on the person (black on clear: macOS draws
// it as a template, in the menu bar's own colour).
//   node mac/icons/make.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
process.env.PLAYWRIGHT_BROWSERS_PATH = join(ROOT, '.data', 'browsers')
const { webkit } = await import(join(ROOT, 'window', 'node_modules', 'playwright', 'index.mjs'))
const font = readFileSync(
  join(
    ROOT,
    'window/node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2',
  ),
).toString('base64')
const face = `@font-face { font-family: Serif; src: url(data:font/woff2;base64,${font}); font-weight: 200 900; }`

// the app's icon: macOS's grid, the tile 824 of 1024 with the canvas's A on the ink
const app = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="100" y="100" width="824" height="824" rx="186" fill="#16202b"/>
  <text x="512" y="700" text-anchor="middle" font-family="Serif" font-weight="600" font-size="560" fill="#fcfcfd">A</text>
</svg>`

// the menu bar's mark, 18 points drawn at 2x: the tile with the A cut out of it
const tray = (
  dot: boolean,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
  <defs><mask id="m">
    <rect width="36" height="36" fill="white"/>
    <text x="${dot ? 15 : 18}" y="${dot ? 27 : 27}" text-anchor="middle" font-family="Serif" font-weight="700" font-size="${dot ? 22 : 24}" fill="black">A</text>
    ${dot ? '<circle cx="29" cy="7" r="8.5" fill="black"/>' : ''}
  </mask></defs>
  <rect x="${dot ? 2 : 3}" y="${dot ? 5 : 3}" width="${dot ? 26 : 30}" height="${dot ? 26 : 30}" rx="7" fill="black" mask="url(#m)"/>
  ${dot ? '<circle cx="29" cy="7" r="5.5" fill="black"/>' : ''}
</svg>`

const browser = await webkit.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
const draw = async (svg: string, size: number, out: string) => {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>${face} html,body{margin:0;background:transparent}</style>${svg}`)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(200)
  await page.screenshot({ path: join(import.meta.dirname, out), omitBackground: true })
}
await draw(app, 1024, 'source.png')
await draw(tray(false), 36, 'tray.png')
await draw(tray(true), 36, 'tray-waiting.png')
await browser.close()
console.log('Drew source.png, tray.png and tray-waiting.png')
