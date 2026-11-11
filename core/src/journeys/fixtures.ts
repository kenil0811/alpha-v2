// The recorded answers a journey's connectors give: the repository's, with the journey's own laid
// over them, copied to a folder of the journey's own so a made-up site can be said in them as
// {site} once it is served.
import { cpSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function fixturesFor(root: string, own: string | undefined, into: string): string {
  rmSync(into, { recursive: true, force: true })
  cpSync(root, into, { recursive: true })
  if (own) cpSync(join(root, 'journeys', own), into, { recursive: true })
  return into
}

// {site} in every recorded answer, said as the made-up site's address
export function fillSite(dir: string, url: string): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) fillSite(p, url)
    else if (name.endsWith('.json')) {
      const text = readFileSync(p, 'utf8')
      if (text.includes('{site}')) writeFileSync(p, text.replaceAll('{site}', url))
    }
  }
}
