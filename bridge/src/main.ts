// The alpha-bridge command, on a person's computer:
//   alpha-bridge pair <link>      pair this computer with the Alpha whose link it is (Your computers)
//   alpha-bridge lend <folder>    lend Alpha a folder here: what is put in it is read in Alpha
//                                 (or calendar, contacts: a Mac's own, through Alpha's helper)
//   alpha-bridge unlend <folder>  stop lending it
//   alpha-bridge list             what this computer is paired with and what it lends
//   alpha-bridge browser on|off   let Alpha sign in to sites here and work on them (Chrome)
//   alpha-bridge run              connect and stay connected; Alpha reads only while this runs
// The key stays in this computer's Keychain or Credential Manager; the rest is in its own folder.
import { unwatchFile, watchFile } from 'node:fs'
import { Bridge, VERSION } from './bridge.ts'
import { helper, LENDS_HERE, start } from './code.ts'
import { type Config, fileOf, homeOf, readConfig } from './config.ts'
import { storeOf } from './keys.ts'
import { browserHere, lendHere, pairHere, serve, siteHere } from './serve.ts'

const say = (words: string) => console.log(words)
const stamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function paired(home: string): Config {
  const c = readConfig(home)
  if (!c)
    throw new Error('This computer is not paired yet: alpha-bridge pair <the link from Alpha>.')
  return c
}

async function main(args: string[]): Promise<void> {
  const home = homeOf()
  const [what, arg] = args
  if (what === 'pair') {
    if (!arg) throw new Error('Give the link: alpha-bridge pair <the link from Alpha>.')
    const c = await pairHere(home, storeOf(), arg)
    say(`Paired with ${new URL(c.alpha).host} as ${c.name}.`)
    say('Next: alpha-bridge lend <a folder>, then alpha-bridge run.')
    return
  }
  // the app's own way in: told what to do, and saying what it does, in lines (serve.ts)
  if (what === 'serve') return serve(home, storeOf(), start)
  if (what === 'lend' || what === 'unlend') {
    paired(home)
    say(lendHere(home, arg, what === 'lend'))
    if (what === 'lend') say('Alpha reads it while alpha-bridge run is going.')
    return
  }
  if (what === 'browser') {
    paired(home)
    say(browserHere(home, arg === 'on'))
    return
  }
  if (what === 'list') {
    const c = paired(home)
    say(`Paired with ${new URL(c.alpha).host} as ${c.name}.`)
    say(c.lends.length ? 'Lends:' : 'Lends nothing yet.')
    for (const l of c.lends) say(`  ${l.connector === 'folder' ? l.account : l.connector}`)
    return
  }
  if (what === 'run') {
    paired(home)
    const bridge = new Bridge({
      helper,
      home,
      lendSite: (site, on) => siteHere(home, site, on),
      lendReader: (connector, on) => {
        lendHere(home, connector, on)
      },
      lendsHere: LENDS_HERE,
      lendBrowser: (on) => {
        browserHere(home, on)
      },
      config: () => paired(home),
      keys: storeOf(),
      start,
      said: (w) => say(`${stamp()}  ${w}`),
    })
    // a lend or an unlend made in another window reaches Alpha within seconds
    watchFile(fileOf(home), { interval: 2000 }, () => bridge.changed())
    const end = () => {
      unwatchFile(fileOf(home))
      bridge.stop()
      process.exit(0)
    }
    process.on('SIGINT', end)
    process.on('SIGTERM', end)
    say(`Alpha Bridge ${VERSION}. Leave this window open; Ctrl+C stops it.`)
    bridge.run()
    return
  }
  say(
    [
      `Alpha Bridge ${VERSION}`,
      '  alpha-bridge pair <link>      pair this computer (the link is in Alpha, Your computers)',
      '  alpha-bridge lend <folder>    lend Alpha a folder here',
      '  alpha-bridge unlend <folder>  stop lending it',
      '  alpha-bridge list             what this computer lends',
      '  alpha-bridge run              connect; Alpha reads only while this runs',
    ].join('\n'),
  )
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
