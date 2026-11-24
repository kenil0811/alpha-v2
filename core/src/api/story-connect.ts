// Set up Alpha's Connect: its tiles, drawn by code from what is loaded and connected (the
// redesign's calls 8 to 14). Mail, calendar and contacts, the person's computer, the apps on that
// computer (as Alpha Bridge's Apps reader lists them), the systems the installed modules read, and
// something they work from. Each tile says what it reads before anything is connected; every count on it comes
// from the world, never from a model's words.
import { config } from '../config.ts'
import { tableOf } from '../connectors/places.ts'
import { connectorsOf } from '../modules/runs/walls.ts'
import type { Connection } from '../world/connections.ts'
import type { Table } from '../world/shape/index.ts'
import { appsLeftOut } from '../world/story.ts'
import type { AccountLine, AccountsView } from './connector-types.ts'
import type { Ctx } from './ctx.ts'
import type { AppFound, ConnectTile, TileConnection } from './story-types.ts'

const MAIL = ['outlook', 'gmail']
const HERE = ['calendar', 'contacts'] // a Mac's own, on Alpha's own Mac
// the connectors whose accounts are lines: a provider's family on one line by its address
const FAMILY: Record<string, string> = { outlook: 'microsoft', gmail: 'google', google: 'google' }
const FAMILY_TITLE: Record<string, string> = { microsoft: 'Microsoft', google: 'Google' }
// what each reads, in the line's ⓘ
const READS: Record<string, string> = {
  outlook: 'mail from the last 90 days, calendar and contacts',
  gmail: 'mail from the last 90 days',
  google: 'calendar and contacts',
}
const MAIL_NOTE =
  'Alpha keeps each mail’s sender, subject and date, and reads a message’s words only when you ask about it.'

// Gmail's app password, guided where it is added, Google's own pages opening in a new tab.
const GMAIL_STEPS = [
  {
    words: 'Turn on 2-Step Verification for your Google account.',
    url: 'https://myaccount.google.com/signinoptions/twosv',
  },
  {
    words: 'Open Google’s app passwords page and make one called Alpha.',
    url: 'https://myaccount.google.com/apppasswords',
  },
  { words: 'Paste the 16 letters it shows below, with your address.', url: null },
]

// Who connected a connection, as the person reads it.
function byOf(ctx: Ctx, k: Connection): string {
  const [kind, id] = k.madeBy.split(/:(.*)/s)
  if (kind !== 'person') return 'Alpha'
  return id === ctx.user.id ? 'You' : (ctx.world.user(id ?? '')?.name ?? 'Someone')
}

// What a connection holds, counted by code: a mail connector's in mails, another's by its table.
function landedOf(ctx: Ctx, k: Connection): string[] {
  const c = ctx.engine.connectors?.find(k.connector)
  if (!c || k.state !== 'connected') return []
  return c.tables.flatMap((spec) => {
    const t = tableOf(ctx.world, c, spec.name)
    if (!t) return []
    const n = ctx.world.records.count(t.id)
    if (c.manifest.icon === 'mail') return [`${n} ${n === 1 ? 'mail' : 'mails'}`]
    const what = t.name.toLowerCase()
    return [`${n} ${n === 1 ? what.replace(/s$/, '') : what}`]
  })
}

// The connectors read as account lines: the providers' families, and any other mail.
function isLine(ctx: Ctx, connector: string): boolean {
  if (FAMILY[connector]) return true
  const m = ctx.engine.connectors?.find(connector)?.manifest
  return m?.icon === 'mail' && m.auth !== 'path'
}

// Every account read, one line each (the person's own alone with `mine`, as Set up Alpha shows
// them; everyone's in Settings), the apps they left out, and each provider's sign-in.
export function accountsView(ctx: Ctx, mine: boolean): AccountsView {
  const { world, engine, user } = ctx
  const loaded = (name: string) => engine.connectors?.find(name)
  const signIn = engine.connectors?.signIn
  const own = (k: Connection) => k.madeBy === `person:${user.id}`
  const lines = new Map<string, AccountLine>()
  for (const k of world.connections.list()) {
    if (!isLine(ctx, k.connector) || (mine && !own(k))) continue
    const provider = FAMILY[k.connector] ?? k.connector
    const key = `${provider}:${k.account.trim().toLowerCase()}`
    const c = loaded(k.connector)
    const line = lines.get(key) ?? {
      key,
      provider,
      title: FAMILY_TITLE[provider] ?? c?.manifest.title ?? k.connector,
      account: k.account,
      state: 'connected' as AccountLine['state'],
      problem: null,
      landed: [],
      reads: [],
      by: byOf(ctx, k),
      mine: own(k) || user.role === 'owner',
      connections: [],
      adds: [],
    }
    line.connections.push({
      id: k.id,
      connector: k.connector,
      auth: c?.manifest.auth ?? 'secret',
      state: k.state,
    })
    line.landed.push(...landedOf(ctx, k))
    line.reads.push(READS[k.connector] ?? 'mail')
    // the line stands as its worst: one asking something of the person, then one disconnected,
    // then a first read running
    const s: AccountLine['state'] = ['needs_sign_in', 'broken', 'waiting'].includes(k.state)
      ? 'failed'
      : k.state === 'paused'
        ? 'off'
        : k.lastSyncAt
          ? 'connected'
          : 'reading'
    const rank = ['connected', 'reading', 'off', 'failed']
    if (rank.indexOf(s) > rank.indexOf(line.state)) {
      line.state = s
      line.problem = s === 'failed' ? k.health : null
    }
    lines.set(key, line)
  }
  const google = {
    loaded: !!loaded('google') || !!loaded('gmail'),
    ready: !!loaded('google') && !!signIn?.app('google'),
    mail: !!loaded('gmail'),
  }
  for (const line of lines.values())
    if (line.provider === 'google') {
      const has = (n: string) => line.connections.some((x) => x.connector === n)
      if (google.mail && !has('gmail')) line.adds.push('mail')
      if (google.ready && !has('google')) line.adds.push('calendar')
    }
  return {
    lines: [...lines.values()],
    left: appsLeftOut(world.db, user.id),
    google,
    microsoft: {
      loaded: !!loaded('outlook'),
      ready: !!loaded('outlook') && !!signIn?.app('microsoft'),
    },
    other: (engine.connectors?.known() ?? [])
      .filter((c) => !FAMILY[c.manifest.name] && isLine(ctx, c.manifest.name))
      .filter((c) => !engine.connectors?.onComputer(c))
      .map((c) => c.manifest.name),
    appPassword: GMAIL_STEPS,
    owner: user.role === 'owner',
    ownerName: world.users().find((u) => u.role === 'owner')?.name ?? 'the owner',
  }
}

// A line's connections, deleted together: a provider's family, by its address.
export function lineConnections(ctx: Ctx, provider: string, account: string): Connection[] {
  return ctx.world.connections
    .list()
    .filter(
      (k) =>
        isLine(ctx, k.connector) &&
        (FAMILY[k.connector] ?? k.connector) === provider &&
        k.account.trim().toLowerCase() === account.trim().toLowerCase(),
    )
}

export function connectTiles(ctx: Ctx, server: boolean): ConnectTile[] {
  const { world, engine, user } = ctx
  const owner = user.role === 'owner'
  const loaded = (name: string) => engine.connectors?.find(name)
  const mine = (k: Connection) => k.madeBy === `person:${user.id}`
  const line = (k: Connection): TileConnection => ({
    id: k.id,
    connector: k.connector,
    account: k.account,
    state: k.state,
    by: byOf(ctx, k),
    landed: landedOf(ctx, k),
  })
  const all = world.connections.list()
  const of = (names: string[], everyone: boolean) =>
    all.filter((k) => names.includes(k.connector) && (everyone || mine(k))).map(line)
  const tile = (
    t: Pick<ConnectTile, 'key' | 'kind' | 'title' | 'reads'> & Partial<ConnectTile>,
  ): ConnectTile => ({
    connectors: [],
    steps: [],
    connections: [],
    landed: [],
    note: null,
    waits: null,
    apps: [],
    reader: null,
    server,
    ...t,
  })

  // mail, calendar and contacts: every account one line, added from one Add, as many as wished;
  // the window draws them from accountsView (routes/connect.ts)
  const tiles: ConnectTile[] = []
  const lineNames = (engine.connectors?.known() ?? [])
    .map((c) => c.manifest.name)
    .filter((n) => isLine(ctx, n))
  if (lineNames.length)
    tiles.push(
      tile({
        key: 'accounts',
        kind: 'accounts',
        title: 'Mail, calendar and contacts',
        reads: 'Your Google, Microsoft and other mail accounts',
        note: MAIL_NOTE,
        connectors: lineNames,
        connections: of(lineNames, false),
      }),
    )

  // calendar and contacts: a Mac's own here, Outlook's with its mail, a computer's through Alpha
  // Bridge; and what has landed in Alpha's own Calendar and Network
  const here = server ? [] : HERE.filter((n) => loaded(n))
  tiles.push(
    tile({
      key: 'calendar',
      kind: 'calendar',
      title: 'Calendar and contacts',
      reads: server ? 'Your meetings and the people in them' : 'This Mac’s calendars and contacts',
      connectors: here,
      connections: of(here, false),
      landed: calendarCounts(ctx),
      note: server
        ? 'Outlook brings them with your mail; a Mac’s own calendar and contacts come through Alpha Bridge on that Mac. Read, never written back.'
        : 'Read, never written back.',
      waits: server ? 'Come with Outlook or Alpha Bridge' : null,
    }),
  )
  // the person's computer: Alpha Bridge on a server, folders by their path on Alpha's own Mac
  // what else Alpha Bridge reads, beyond a folder and a Mac's calendar and contacts
  const readers = (engine.connectors?.known() ?? [])
    .filter((c) => engine.connectors?.onComputer(c))
    .filter((c) => !['folder', ...HERE].includes(c.manifest.name))
    .map((c) => c.manifest.title)
  tiles.push(
    tile({
      key: 'computer',
      kind: 'computer',
      title: server ? 'Your computer' : 'This Mac',
      reads: server ? 'A folder you lend through Alpha Bridge' : 'Folders on this Mac',
      connectors: server ? [] : loaded('folder') ? ['folder'] : [],
      connections: server ? [] : of(['folder'], false),
      note: server
        ? `Read only while your computer is on.${readers.length ? ` Alpha Bridge can also read ${words(readers)}, each only once you turn it on.` : ''}`
        : 'Their files are read, never written back.',
    }),
  )

  // the apps the person uses: on their computer, where Alpha Bridge's Apps reader comes with this
  // Alpha, and the work apps among their mail's senders
  if (owner) {
    const reader = loaded('apps')
    const k = reader && all.find((x) => x.connector === reader.manifest.name && mine(x))
    tiles.push(
      tile({
        key: 'apps',
        kind: 'apps',
        title: 'Apps you use',
        reads: reader ? 'Apps on your computer and in your mail' : 'Work apps found in your mail',
        note: `${reader ? 'Alpha Bridge lists the apps on your computer once you turn on Apps: when each was last used and how often. ' : ''}Work apps are also found among your mail’s senders. Alpha connects the ones it can, or signs in to their site.`,
        apps: appsUsed(ctx, reader ? tableOf(world, reader, 'Apps') : undefined),
        reader: reader ? { id: k ? k.id : null, read: !!k?.lastSyncAt } : null,
      }),
    )
  }

  // the systems the installed modules read (QuickBooks for Accounting), connected for everyone
  const systems = new Map<string, string[]>()
  for (const m of world.shape.modules())
    for (const name of connectorsOf(m.dir))
      if (!MAIL.includes(name) && name !== 'google')
        systems.set(name, [...(systems.get(name) ?? []), m.name])
  for (const [name, modules] of systems) {
    const c = (engine.connectors?.known() ?? []).find((x) => x.manifest.name.toLowerCase() === name)
    if (!c) continue
    const connections = of([c.manifest.name], true)
    // a member sees what the firm connected; connecting it is the owner's
    if (!owner && !connections.length) continue
    tiles.push(
      tile({
        key: c.manifest.name,
        kind: 'connector',
        title: c.manifest.title,
        reads: `Read for ${words(modules)}`,
        connectors: owner ? [c.manifest.name] : [],
        connections,
      }),
    )
  }

  if (owner)
    tiles.push(
      tile({
        key: 'file',
        kind: 'file',
        title: 'Something you work from',
        reads: 'A spreadsheet, export or PDF to build from',
        note: 'The Module builder makes a module from it while you carry on.',
      }),
    )
  return tiles
}

const words = (list: string[]) =>
  list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : (list[0] ?? '')

// What landed in Alpha's own Calendar and Network, counted: this month's events, and the people
// and organizations met in mail and meetings.
function calendarCounts(ctx: Ctx): string[] {
  const { world } = ctx
  const out: string[] = []
  const cal = world.shape.ownModule('calendar')
  const events = cal && world.shape.ownTable(cal.id, 'Events')
  const starts = events?.fields.find((f) => f.name === 'Starts')?.slug
  if (events && starts) {
    const month = new Date().toLocaleDateString('en-CA').slice(0, 7) // this Alpha's own month
    const n = world.records
      .list(events.id)
      .filter((r) => String(r.values[starts] ?? '').startsWith(month)).length
    if (n) out.push(`${n} ${n === 1 ? 'event' : 'events'} this month`)
  }
  const people = world.people.count('person')
  const orgs = world.people.count('company')
  if (people || orgs)
    out.push(
      `${people} ${people === 1 ? 'person' : 'people'} and ${orgs} ${orgs === 1 ? 'organization' : 'organizations'} in Network`,
    )
  return out
}

// The apps the person uses: those on their computer used lately (Alpha Bridge's Apps reader) and
// the work apps among their mail's senders, each matched against the work apps Alpha knows
// (core/config/apps.yaml) for how Alpha reaches it.
function appsUsed(ctx: Ctx, apps: Table | undefined): AppFound[] {
  const { world, engine } = ctx
  const slug = (t: Table, name: string) => t.fields.find((f) => f.name === name)?.slug ?? name
  const desktop = apps
    ? world.records.list(apps.id).map((r) => ({
        name: String(r.values[slug(apps, 'App')] ?? ''),
        last: (r.values[slug(apps, 'Last used')] as string | null | undefined) ?? null,
        times: (r.values[slug(apps, 'Times used')] as number | null | undefined) ?? null,
      }))
    : []
  const mail = new Map<string, number>()
  for (const name of MAIL) {
    const c = engine.connectors?.find(name)
    const t = c && tableOf(world, c, 'Mail')
    if (t) for (const [d, n] of sendersOf(ctx, t)) mail.set(d, (mail.get(d) ?? 0) + n)
  }
  const connected = new Set(
    world.connections
      .list()
      .filter((k) => k.state === 'connected')
      .map((k) => k.connector),
  )
  const mine = world.computers.of(ctx.user.id)
  return appsAmong({ desktop, mail }, config.apps(), Date.now(), {
    ships: (name) => !!engine.connectors?.find(name),
    connected: (name) => connected.has(name),
    // a reader is on only on the person's own computer, never someone else's
    reads: (reader) =>
      mine.some((pc) =>
        world.connections.on(pc.id).some((k) => k.connector === reader && k.state === 'connected'),
      ),
    left: new Set(appsLeftOut(world.db, ctx.user.id).map((n) => n.toLowerCase())),
  })
}

interface Known {
  recent_days: number
  shown: number
  min_mails: number
  apps: {
    name: string
    sites: string[]
    connector?: string | undefined
    desktop?: string[] | undefined
  }[]
  readers?: { name: string; reader: 'browsing' | 'apps' | 'ai-work' }[] | undefined
}

// One list of both: the computer's apps used in the config's last days, and the known work apps
// with at least so many mails from their sites' domains; an app seen both ways shows once, and one
// the person left out never. Those Alpha can connect or sign in to first, then the most used, so
// many at most.
export function appsAmong(
  seen: {
    desktop: { name: string; last: string | null; times: number | null }[]
    mail: Map<string, number>
  },
  known: Known,
  now: number,
  here: {
    ships: (connector: string) => boolean
    connected: (connector: string) => boolean
    reads?: (reader: string) => boolean // a reader on the person's own computer is on
    left?: Set<string> // what the person left out, lower case: never listed
  },
): AppFound[] {
  const since = now - known.recent_days * 86_400_000
  const plain = (s: string) =>
    s
      .toLowerCase()
      .replace(/\.app$/, '')
      .trim()
  // a site's own domain, which its mail comes from: quickbooks.intuit.com's is intuit.com
  const domain = (site: string) => site.split('.').slice(-2).join('.')
  const out = new Map<string, AppFound>()
  const reach = (a: Known['apps'][number] | undefined, name: string) => {
    const connector = a?.connector && here.ships(a.connector) ? a.connector : null
    const reader = (known.readers ?? []).find((r) => plain(r.name) === plain(name))?.reader ?? null
    return {
      site: a?.sites[0] ?? null,
      connector,
      connected: !!connector && here.connected(connector),
      reader,
      reading: !!reader && (here.reads ?? here.connected)(reader),
    }
  }
  for (const r of seen.desktop) {
    if (!r.name || !r.last || Date.parse(r.last) < since) continue
    const n = plain(r.name)
    const a = known.apps.find((x) =>
      [x.name, ...(x.desktop ?? [])].some((k) => n === plain(k) || n.startsWith(`${plain(k)} `)),
    )
    const name = a?.name ?? r.name.replace(/\.app$/, '')
    out.set(name, { name, last: r.last, times: r.times, mails: 0, ...reach(a, name) })
  }
  for (const a of known.apps) {
    let mails = 0
    const own = new Set(a.sites.map(domain))
    for (const [d, n] of seen.mail)
      if ([...own].some((s) => d === s || d.endsWith(`.${s}`))) mails += n
    if (mails < known.min_mails) continue
    const was = out.get(a.name)
    out.set(
      a.name,
      was
        ? { ...was, mails }
        : { name: a.name, last: null, times: null, mails, ...reach(a, a.name) },
    )
  }
  const can = (a: AppFound) => (a.connector || a.site ? 1 : 0)
  return [...out.values()]
    .filter((a) => !here.left?.has(a.name.toLowerCase()))
    .sort(
      (a, b) =>
        can(b) - can(a) ||
        (b.times ?? 0) - (a.times ?? 0) ||
        b.mails - a.mails ||
        String(b.last).localeCompare(String(a.last)),
    )
    .slice(0, known.shown)
}

// A mail table's senders by their domain, read once for each size of the table: Connect asks
// again while rows land.
const senders = new Map<string, Map<string, number>>()
function sendersOf(ctx: Ctx, t: Table): Map<string, number> {
  const { world } = ctx
  const key = `${t.id}:${world.records.count(t.id)}`
  const kept = senders.get(key)
  if (kept) return kept
  const from = t.fields.find((f) => f.name === 'From address')?.slug
  const out = new Map<string, number>()
  if (from)
    for (const r of world.records.list(t.id)) {
      const d = String(r.values[from] ?? '')
        .split('@')[1]
        ?.toLowerCase()
        .trim()
      if (d) out.set(d, (out.get(d) ?? 0) + 1)
    }
  for (const k of senders.keys()) if (k.startsWith(`${t.id}:`)) senders.delete(k)
  senders.set(key, out)
  return out
}
