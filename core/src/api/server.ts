// The api the window talks to (design §2, §14): HTTP and a websocket on loopback. Every request,
// HTTP or websocket, checks its Host, its Origin and the per-install token.
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Cell, renderPage, sheetBytes } from '@alpha/connector-files'
import { chromePath } from '@alpha/connector-sdk'
import fastifyStatic from '@fastify/static'
import websocket from '@fastify/websocket'
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify'
import { z } from 'zod'
import { config } from '../config.ts'
import { connectorOf, KNOWN } from '../connectors/service.ts'
import type { Engine, EngineEvent } from '../engine/engine.ts'
import {
  applyShape,
  describeShape,
  instructionsFile,
  MAINTAINED_SHAPE,
  type ShapeAction,
} from '../engine/tools.ts'
import { stillBeingRead } from '../files/documents.ts'
import {
  type Agent,
  agents,
  nextRun,
  readAgent,
  setAgentState,
  whenWords,
} from '../modules/agents.ts'
import { DRAFT } from '../modules/drafts.ts'
import {
  install,
  installedKits,
  recordChange,
  takeBack,
  unseenChanges,
  update,
  yours,
} from '../modules/kits.ts'
import { installPack } from '../modules/packs.ts'
import { moduleNetwork, PROPOSE_TASKS, type RunRow, unmetNeeds } from '../modules/runs.ts'
import { pageAnswer, pageDocument, pagesOf, printPage } from '../pages/pages.ts'
import type { Setup } from '../setup.ts'
import type { Card } from '../world/cards.ts'
import { FIELD_KINDS, type Provenance, Refused } from '../world/kinds.ts'
import { phoneWords } from '../world/phones.ts'
import { findField, type Module } from '../world/shape.ts'
import type { Task } from '../world/tasks.ts'
import type { View } from '../world/views.ts'
import type { User } from '../world/world.ts'
import type {
  AboutRows,
  CardView,
  ConnectorsView,
  FileView,
  FoundRow,
  Health,
  HistoryView,
  InstructionView,
  Layout,
  Me,
  ModelView,
  ModuleSummary,
  ModuleView,
  PeopleView,
  PermissionView,
  PersonView,
  RowFileView,
  RunView,
  SavedView,
  SetupView,
  SourceView,
  Stream,
  StreamLine,
  TableView,
  TaskLineView,
  TasksView,
  TaskView,
  TodayView,
  WorkingModuleView,
  YoursView,
} from './types.ts'

export const VERSION = '0.1.0'

// What the stream shows: the person's sentences, Alpha's replies, the steps and what they made.
const STREAM_KINDS = [
  'said',
  'replied',
  'error',
  'limit',
  'noticed',
  'card_opened',
  'card_closed',
  'card_used',
  'call',
  'called',
  'made',
  'shaped',
  'wrote',
  'changed',
  'removed',
  'filed',
  'remembered',
  'kept',
  'told',
  'reminder',
]

export interface ServerOptions {
  engine?: Engine
  user?: User
  token?: string
  ports?: number[] // the core's and the dev window's
  windowDir?: string // the built window, served at / when it is there
  browsers?: string // where the core's own browser is kept, for printing pages
  setup?: Setup // what this Mac still needs: Claude's sign-in, connections, the readers' downloads
  shell?: { seen: number } // when Alpha's Mac app last asked for notices: it shows them, not the core
  kits?: { now: string | null } // what the core is still setting up after it started listening
}

export function buildServer(options: ServerOptions = {}): FastifyInstance {
  const app = Fastify({ bodyLimit: 200 * 1024 * 1024 })
  // the window it serves, by its index (whose asset names change with every build)
  const build = (() => {
    const index = options.windowDir ? join(options.windowDir, 'index.html') : null
    return index && existsSync(index)
      ? createHash('sha256').update(readFileSync(index)).digest('hex').slice(0, 12)
      : null
  })()
  app.get('/api/health', async (): Promise<Health> => ({ ok: true, version: VERSION, build }))

  const { engine, user, token } = options
  if (!engine || !user) return app
  const world = engine.world
  const hosts = new Set((options.ports ?? []).flatMap((p) => [`127.0.0.1:${p}`, `localhost:${p}`]))

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api') && !req.url.startsWith('/ws')) return
    if (req.url === '/api/health') return
    const host = req.headers.host ?? ''
    const origin = req.headers.origin
    const given = req.headers['x-alpha-token'] ?? (req.query as { t?: string }).t
    if (hosts.size && !hosts.has(host)) return deny(reply, 'This address is not Alpha’s.')
    if (origin && hosts.size && !hosts.has(origin.replace(/^https?:\/\//, '')))
      return deny(reply, 'This page is not Alpha’s.')
    if (token && given !== token)
      return deny(reply, 'Open Alpha from the address the core printed.')
  })

  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => done(null, body))

  const layoutOf = (): Layout => {
    const folded = world.preference(user.id, 'rail_folded_modules')
    const panel = Number(world.preference(user.id, 'panel_width'))
    return {
      railFolded: world.preference(user.id, 'rail_folded') === 'yes',
      folded: folded ? (JSON.parse(folded) as string[]) : [],
      panel: Number.isFinite(panel) && panel > 0 ? panel : null,
    }
  }

  app.get('/api/me', async (): Promise<Me> => {
    const theme = world.preference(user.id, 'theme')
    return {
      user: { id: user.id, name: user.name },
      tenant: world.tenant,
      theme: theme === 'light' || theme === 'dark' ? theme : 'mac',
      layout: layoutOf(),
    }
  })

  // How the person left the window: the rail, its folds, the side conversation's width.
  app.post('/api/layout', async (req): Promise<Layout> => {
    const given = z
      .object({
        railFolded: z.boolean().optional(),
        folded: z.array(z.string()).optional(),
        panel: z.number().int().positive().nullable().optional(),
      })
      .parse(req.body)
    if (given.railFolded !== undefined)
      world.setPreference(user.id, 'rail_folded', given.railFolded ? 'yes' : null)
    if (given.folded !== undefined)
      world.setPreference(
        user.id,
        'rail_folded_modules',
        given.folded.length ? JSON.stringify(given.folded) : null,
      )
    if (given.panel !== undefined)
      world.setPreference(user.id, 'panel_width', given.panel === null ? null : String(given.panel))
    return layoutOf()
  })

  app.post('/api/appearance', async (req) => {
    const { theme } = z.object({ theme: z.enum(['mac', 'light', 'dark']) }).parse(req.body)
    world.setPreference(user.id, 'theme', theme === 'mac' ? null : theme)
    return { ok: true }
  })

  // Find (⌘K): rows by their words, each opening where it is.
  app.get('/api/find', async (req): Promise<FoundRow[]> => {
    const { words } = z.object({ words: z.string().trim().min(1) }).parse(req.query)
    const people: FoundRow[] = [
      ...world.people.list('person', words).slice(0, 5),
      ...world.people.list('company', words).slice(0, 3),
    ].map((p) => ({
      label: p.name,
      hint: p.kind === 'company' ? 'Company' : (p.companies[0] ?? p.emails[0] ?? 'Person'),
      href: `#/people/${p.id}`,
    }))
    return [
      ...people,
      ...world
        .search(words, 12)
        .filter((h) => h.what === 'record')
        .flatMap((h) => {
          const rec = world.records.get(h.id)
          if (!rec || rec.table.hidden) return []
          return [
            {
              label: world.rowName(rec.table, rec.record.values),
              hint: rec.table.name,
              href: `#/table/${rec.table.id}/${h.id}`,
            },
          ]
        })
        .slice(0, 8),
    ]
  })

  app.get('/api/stream', async (req): Promise<Stream> => {
    const q = z
      .object({
        after: z.coerce.number().optional(),
        before: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      })
      .parse(req.query)
    const lines = world
      .lines({
        user: user.id,
        kinds: STREAM_KINDS,
        ...(q.after !== undefined ? { after: q.after } : {}),
        ...(q.before !== undefined ? { before: q.before } : {}),
        limit: q.limit ?? 400,
      })
      .map(
        (l): StreamLine => ({
          id: l.id,
          at: l.at,
          actor: l.actor.kind,
          kind: l.kind,
          words: l.words,
          turn: l.turn,
          card: l.card,
          module: moduleOf(l.module),
          data:
            l.kind === 'told'
              ? { about: aboutRows(l.data.about), agent: l.data.agent ?? null }
              : shown(l.kind, l.data),
        }),
      )
    return {
      lines,
      cards: world.cards.waiting(user.id).map(cardOut),
      busy: engine.busy(user),
      running: (engine.hands?.runner.runs(50) ?? [])
        .filter((r) => r.state === 'running')
        .map((r) => ({
          id: r.id,
          name: (r.agent && agents(world).find((a) => a.id === r.agent)?.name) || 'A try',
          module: r.module,
        })),
      attention: world.connections
        .list()
        .filter((k) => k.state === 'needs_sign_in')
        .map((k) => ({
          connector: k.connector,
          title: connectorOf(k.connector).manifest.title,
          connection: k.id,
          inBrowser: connectorOf(k.connector).manifest.auth === 'browser',
        })),
      tasks: world.tasks.counts(),
      reading: engine.connectors?.reading() ?? [],
      settingUp: options.kits?.now ?? null,
      lastId: world.lastLineId(),
    }
  })

  app.post('/api/say', async (req) => {
    const { words, from } = z
      .object({ words: z.string().trim().min(1), from: z.string().optional() })
      .parse(req.body)
    const m = from ? world.shape.module(from) : undefined
    return { turn: engine.say(user, words, m ? { id: m.id, name: m.name } : null) }
  })

  app.post('/api/stop', async () => {
    await engine.stop(user)
    return { ok: true }
  })

  // A card as the window shows it; a file from the mail with its place and the rows to pick.
  const cardOut = (c: Card): CardView => ({
    ...cardView(c),
    filing: engine.hands?.intake?.view(c) ?? null,
    draft: engine.hands?.drafts?.view(c) ?? null,
    match: c.kind === 'match' ? world.people.matchView(c.id) : null,
    review: engine.hands?.runner?.reviews.view(c) ?? null,
    proposed: engine.hands?.runner?.proposedView(c) ?? null,
  })
  // An agent's proposed tasks: those the person kept are added (by their place in the card).
  app.post('/api/cards/:id/tasks', async (req): Promise<CardView | null> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { take } = z.object({ take: z.array(z.number().int().min(0)) }).parse(req.body)
    const runner = engine.hands?.runner
    if (!runner) throw new Refused('Agents are not set up in this core.')
    const out = runner.adopt(id, take, user.id)
    live()
    return cardOut(out)
  })
  // An agent's rows on a card: the person's choice on some, or on every one not yet decided.
  app.post('/api/cards/:id/rows', async (req): Promise<CardView | null> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { rows, value } = z
      .object({ rows: z.union([z.array(z.string()).min(1), z.literal('rest')]), value: z.string() })
      .parse(req.body)
    const reviews = engine.hands?.runner?.reviews
    if (!reviews) throw new Refused('Agents are not set up in this core.')
    reviews.choose(id, rows, value, asPerson)
    live()
    const c = world.cards.get(id)
    return c ? cardOut(c) : null
  })
  // An agent's draft: sent as it is or as the person changed it (with Always when offered), or
  // held with a reason.
  app.post('/api/cards/:id/send', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const body = z
      .object({
        message: z
          .object({
            to: z.string(),
            cc: z.string().optional(),
            subject: z.string(),
            body: z.string(),
          })
          .nullable()
          .optional(),
        always: z.boolean().optional(),
      })
      .parse(req.body ?? {})
    const drafts = engine.hands?.drafts
    if (!drafts) throw new Refused('Drafts are not set up in this core.')
    const m = body.message
    const message = m
      ? { to: m.to, subject: m.subject, body: m.body, ...(m.cc ? { cc: m.cc } : {}) }
      : null
    const out = await drafts.send(id, message, user, body.always ?? false)
    live()
    return cardOut(out)
  })
  app.post('/api/cards/:id/hold', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { reason, words } = z
      .object({ reason: z.string(), words: z.string().max(400).default('') })
      .parse(req.body ?? {})
    const drafts = engine.hands?.drafts
    if (!drafts) throw new Refused('Drafts are not set up in this core.')
    const out = drafts.hold(id, reason, words, user)
    live()
    return cardOut(out)
  })
  // Standing permissions, as Settings lists them, and Revoke.
  app.get(
    '/api/permissions',
    async (): Promise<PermissionView[]> =>
      world.permissions.list().map((p) => ({
        id: p.id,
        sentence: p.sentence,
        grantedBy: byWords(p.grantedBy),
        grantedAt: p.grantedAt,
        uses: p.uses,
        lastUsedAt: p.lastUsedAt,
        revokedAt: p.revokedAt,
      })),
  )
  app.post('/api/permissions/:id/revoke', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    world.permissions.revoke(id, { actor: person, user: user.id })
    live()
    return { ok: true }
  })
  // A file from the mail: filed on the row the person settled on, as its kind (Replace takes the
  // row's other file of that kind off), or declined with their reason.
  app.post('/api/cards/:id/file', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const body = z
      .object({
        row: z.string().nullable(),
        kind: z.string().nullable(),
        replace: z.boolean().optional(),
        always: z.boolean().optional(),
      })
      .parse(req.body)
    const intake = engine.hands?.intake
    if (!intake) throw new Refused('Files from the mail are not on here.')
    const out = intake.file(id, body, user)
    live()
    return cardOut(out)
  })
  app.post('/api/cards/:id/decline', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { reason } = z.object({ reason: z.string().max(400).default('') }).parse(req.body ?? {})
    const intake = engine.hands?.intake
    if (!intake) throw new Refused('Files from the mail are not on here.')
    const out = intake.decline(id, reason.trim(), user)
    live()
    return cardOut(out)
  })

  app.post('/api/cards/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { answer } = z.object({ answer: z.string().min(1) }).parse(req.body)
    try {
      const c = world.cards.get(id)
      if (c?.call?.tool === DRAFT) return cardOut(await engine.answerDraft(user, id, answer))
      // a yes on proposed tasks adds them all; the card's own list keeps some
      if (c?.call?.tool === PROPOSE_TASKS && answer === c.options[0] && engine.hands?.runner) {
        const out = engine.hands.runner.adopt(id, 'all', user.id)
        live()
        return cardOut(out)
      }
      // a maintained kit's shape change (decision 3b): asked of the maintainer as a drafted
      // email, or done now and counted as a change of the person's they have not seen
      if (c?.call?.tool === MAINTAINED_SHAPE && c.module) {
        const a = c.call.input as unknown as ShapeAction
        const kit = installedKits(world).find((k) => k.module === c.module)
        const m = world.shape.module(c.module)
        if (!kit?.maintainer || !m) throw new Refused('That kit is not maintained any more.')
        const change = describeShape(a)
        const words = `${change[0]?.toUpperCase() ?? ''}${change.slice(1)}`
        if (answer === c.options[1]) {
          const said = applyShape(world, a, { actor: person, user: user.id })
          recordChange(world, m.id, words, a, user.id)
          const out = world.cards.answer(id, answer, person, `Done now: ${said}`)
          live()
          return cardOut(out)
        }
        const drafts = engine.hands?.drafts
        if (drafts)
          await drafts.propose(
            {
              agent: 'Alpha',
              module: m.id,
              kind: 'request to the maintainer',
              key: null,
              connector: 'gmail',
              message: {
                to: kit.maintainer.address,
                subject: `A change to ${kit.kit} asked from Alpha`,
                body: `${words}.\n\nAsked in ${m.name} (${kit.kit} ${kit.version}) on ${new Date().toDateString()}.`,
              },
              about: null,
              note: `For ${kit.maintainer.name} to put in the kit's next version.`,
            },
            null,
          )
        else
          world.line({
            actor: person,
            kind: 'noted',
            words: `To ask ${kit.maintainer.name} (${kit.maintainer.address}): ${words}.`,
            user: user.id,
            module: m.id,
          })
        const out = world.cards.answer(
          id,
          answer,
          person,
          `Asked ${kit.maintainer.name}: ${words}.`,
        )
        live()
        return cardOut(out)
      }
      return cardOut(engine.answer(user, id, answer))
    } catch (err) {
      if (err instanceof Refused) return reply.code(409).send({ problem: err.message })
      throw err
    }
  })

  // People (design §4, §14): everyone or every company, a page each, and the person's word on
  // them: a name, Unmerge, and each pair of a match card merged or kept apart.
  const asPerson = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
  app.get('/api/people', async (req): Promise<PeopleView> => {
    const { kind, words } = z
      .object({
        kind: z.enum(['person', 'company']).default('person'),
        words: z.string().default(''),
      })
      .parse(req.query)
    return {
      kind,
      days: config.people().contact_days,
      lines: world.people
        .list(kind, words)
        .map((p) => ({ ...p, phones: p.phones.map(phoneWords) })),
      people: world.people.count('person'),
      companies: world.people.count('company'),
      sources: world.shape
        .tables()
        .filter((t) => t.people)
        .map((t) => t.name),
    }
  })

  const personOut = (id: string): PersonView | undefined => {
    const p = world.people.get(id)
    if (!p) return undefined
    const from = new Map<string, { table: string | null; name: string; count: number }>()
    for (const s of p.sources) {
      const name = s.table ? (world.shape.table(s.table)?.name ?? 'A table') : 'You'
      const seen = from.get(name) ?? { table: s.table, name, count: 0 }
      seen.count++
      from.set(name, seen)
    }
    return {
      id: p.id,
      kind: p.kind,
      name: p.name,
      emails: p.keys.email ?? [],
      phones: (p.keys.phone ?? []).map(phoneWords),
      profile: p.keys.profile?.[0] ?? null,
      domains: p.keys.domain ?? [],
      merged: p.merged,
      companies: p.companies,
      people: p.people,
      from: [...from.values()],
      contact: p.contact,
      rows: world.people.rowsNaming(p.id).flatMap((r) => {
        const rec = world.records.get(r.record)
        return rec
          ? [
              {
                table: rec.table.name,
                module: rec.table.module.name,
                name: world.rowName(rec.table, rec.record.values),
                field: r.field,
                href: `#/table/${r.table}/${r.record}`,
              },
            ]
          : []
      }),
      history: world.people.history(p.id).map((h) => ({
        at: h.at,
        channel: h.channel,
        by: h.by,
        about: h.about,
        href: `#/table/${h.table}/${h.record}`,
      })),
      createdAt: p.createdAt,
    }
  }

  app.get('/api/people/:id', async (req, reply): Promise<PersonView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const p = personOut(id)
    if (!p) return reply.code(404).send({ problem: 'That one is not there.' })
    return p
  })

  app.post('/api/people/:id/name', async (req): Promise<PersonView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { name } = z.object({ name: z.string().trim().min(1) }).parse(req.body)
    world.people.name(id, name, asPerson)
    live()
    return personOut(id)
  })

  app.post('/api/people/:id/unmerge', async (req): Promise<PersonView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const alone = world.people.unmerge(id, asPerson)
    live()
    return personOut(alone.id)
  })

  app.post('/api/people/:id/you', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const emails = world.people.isYou(id, asPerson)
    live()
    return { emails }
  })

  app.post('/api/people/pairs/:id', async (req): Promise<CardView | null> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { merge } = z.object({ merge: z.boolean() }).parse(req.body)
    world.people.decidePair(id, merge, asPerson)
    live()
    const card = world.people.pairs().find((p) => p.id === id)?.card
    const c = card ? world.cards.get(card) : undefined
    return c ? cardOut(c) : null
  })

  app.post('/api/cards/:id/merge-same', async (req): Promise<CardView | null> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    world.people.mergeSamePlace(id, asPerson)
    live()
    const c = world.cards.get(id)
    return c ? cardOut(c) : null
  })

  // Tasks (Kenil's plan, 21 Oct): the saved lists, a task's page, and the person's own word on
  // them: added, changed, moved, done, removed.
  const today = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const inDays = (n: number) => {
    const d = new Date(Date.now() + n * 86_400_000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const placeOf = (p: Task['place']) => {
    const rowName = (table: string, row: string) => {
      const t = world.shape.table(table)
      const r = world.records.get(row)
      return t && r ? world.rowName(t, r.record.values) : 'a row'
    }
    const words = world.tasks.placeWords(p, rowName)
    const href =
      p.row && p.table
        ? `#/table/${p.table}/${p.row}`
        : p.table
          ? `#/table/${p.table}`
          : p.module && p.page
            ? `#/module/${p.module}/page/${p.page}`
            : p.module
              ? `#/module/${p.module}`
              : null
    return { words, path: words === 'nowhere yet' ? [] : words.split(' › '), href }
  }
  // the tasks a card waits on the person for: about the task, or from a run serving it
  const waitingCards = () =>
    new Set([
      ...world.cards
        .waiting()
        .map((c) => (c.call?.input as { task?: string } | undefined)?.task)
        .filter((x): x is string => !!x),
      ...world.cards.waitingTasks(),
    ])
  const workingOn = () =>
    new Set(
      (engine.hands?.runner.runs(50) ?? [])
        .filter((r) => r.state === 'running' && r.task)
        .map((r) => r.task as string),
    )
  const lineOf = (t: Task, waiting: Set<string>, working = workingOn()): TaskLineView => {
    const kids = world.tasks.children(t.id)
    return {
      id: t.id,
      title: t.title,
      state: t.state,
      due: t.due,
      overdue:
        !!t.due && ['todo', 'doing', 'waiting'].includes(t.state) && t.due.slice(0, 10) < today(),
      remindAt: t.remindAt,
      repeat: t.repeat,
      priority: t.priority,
      owner: world.tasks.ownerWords(t),
      ownerKind: t.owner.kind,
      place: placeOf(t.place),
      parent: t.parent,
      children: kids.length,
      childrenDone: kids.filter((k) => k.state === 'done').length,
      waitingForYou: waiting.has(t.id),
      working: working.has(t.id),
    }
  }
  const LISTS: Record<string, () => Task[]> = {
    today: () => world.tasks.list({ open: true, dueBy: today() }),
    week: () => world.tasks.list({ open: true, dueBy: inDays(7) }),
    overdue: () => world.tasks.list({ open: true, dueBy: inDays(-1) }),
    waiting: () => {
      const w = waitingCards()
      return world.tasks.list({ open: true }).filter((t) => t.state === 'waiting' || w.has(t.id))
    },
    // the tasks given to agents, the ones they work on now first
    agents: () => {
      const w = workingOn()
      return world.tasks
        .list({ open: true, owner: { kind: 'agent' } })
        .sort((a, b) => Number(w.has(b.id)) - Number(w.has(a.id)))
    },
    open: () => world.tasks.list({ open: true }),
    done: () =>
      world.tasks
        .list()
        .filter((t) => t.state === 'done' || t.state === 'dropped')
        .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
        .slice(0, 200),
  }
  app.get('/api/tasks', async (req): Promise<TasksView> => {
    const q = z
      .object({
        list: z.string().default('open'),
        module: z.string().optional(),
        table: z.string().optional(),
        row: z.string().optional(),
      })
      .parse(req.query)
    const waiting = waitingCards()
    const on =
      q.module || q.table || q.row
        ? {
            module: q.module ?? null,
            table: q.table ?? null,
            row: q.row ?? null,
            field: null,
            page: null,
          }
        : null
    const tasks = on ? world.tasks.list({ on }) : (LISTS[q.list] ?? (LISTS.open as () => Task[]))()
    const working = workingOn()
    return {
      list: q.list,
      lines: tasks.map((t) => lineOf(t, waiting, working)),
      counts: Object.fromEntries(
        Object.entries(LISTS).map(([k, f]) => [k, k === 'done' ? 0 : f().length]),
      ),
    }
  })

  const taskOut = (id: string): TaskView | undefined => {
    const t = world.tasks.get(id)
    if (!t) return undefined
    const waiting = waitingCards()
    const row = t.place.row ? world.records.get(t.place.row) : undefined
    const values = row
      ? row.table.fields.flatMap((f) => {
          const v = row.record.values[f.slug]
          if (v === null || v === undefined || v === '') return []
          const words =
            typeof v === 'object' && v && 'amount' in (v as object)
              ? `${(v as { amount: number }).amount.toLocaleString()} ${(v as { currency: string }).currency}`
              : f.kind === 'person'
                ? (world.people.names([String(v)])[String(v)] ?? String(v))
                : Array.isArray(v)
                  ? v.join(', ')
                  : String(v)
          return [{ field: f.name, value: words }]
        })
      : []
    const parent = t.parent ? world.tasks.get(t.parent) : undefined
    // who can own it: the person, Alpha, and the agents that take tasks
    const all = agents(world)
    const owners = [
      { kind: 'person' as const, id: user.id, name: 'You' },
      { kind: 'alpha' as const, id: null, name: 'Alpha' },
      ...all
        .filter((a) => a.tasks || a.id === t.owner.id)
        .map((a) => ({ kind: 'agent' as const, id: a.id, name: a.name })),
    ]
    const agent = t.owner.kind === 'agent' ? all.find((a) => a.id === t.owner.id) : undefined
    const runner = engine.hands?.runner
    const cards = world.cards.ofTask(t.id)
    return {
      ...lineOf(t, waiting),
      notes: t.notes,
      remindedAt: t.remindedAt,
      madeBy: t.madeBy.startsWith('person')
        ? 'You'
        : t.madeBy.startsWith('agent:')
          ? t.madeBy.slice(6)
          : 'Alpha',
      placedBy: t.placedBy,
      placedWhy: t.placedWhy,
      createdAt: t.createdAt,
      doneAt: t.doneAt,
      parentTitle: parent?.title ?? null,
      subtasks: world.tasks.children(t.id).map((k) => lineOf(k, waiting)),
      touches: t.refs.map((r) => {
        if (r.kind === 'person')
          return {
            kind: r.kind,
            name: world.people.names([r.ref])[r.ref] ?? r.ref,
            href: `#/people/${r.ref}`,
          }
        if (r.kind === 'row') {
          const rec = world.records.get(r.ref)
          return {
            kind: r.kind,
            name: rec ? world.rowName(rec.table, rec.record.values) : 'a row no longer there',
            href: rec ? `#/table/${rec.table.id}/${r.ref}` : null,
          }
        }
        return {
          kind: r.kind,
          name: world.files.file(r.ref)?.name ?? r.ref,
          href: `#/file/${r.ref}`,
        }
      }),
      context: {
        values,
        siblings:
          t.place.module || t.place.table
            ? world.tasks
                .list({ open: true, on: { ...t.place, field: null } })
                .filter((x) => x.id !== t.id && x.parent !== t.id)
                .slice(0, 20)
                .map((x) => lineOf(x, waiting))
            : [],
      },
      history: world
        .lines({ kinds: ['task', 'reminder'] })
        .filter((l) => (l.data as { task?: string; tasks?: string[] }).task === t.id)
        .slice(-40)
        .reverse()
        .map((l) => ({ at: l.at, words: l.words })),
      owners,
      agent: agent
        ? {
            name: agent.name,
            on: agent.state === 'on',
            takes: agent.tasks,
            said:
              world
                .lines({ kinds: ['task'] })
                .filter(
                  (l) =>
                    (l.data as { task?: string }).task === t.id &&
                    l.actor.kind === 'agent' &&
                    !l.words.startsWith(`${agent.name} started on`),
                )
                .at(-1)?.words ?? null,
            runs: (runner?.runsOf(t.id) ?? [])
              .reverse()
              .sort((a, b) => Number(b.state === 'running') - Number(a.state === 'running'))
              .map(runOut),
          }
        : null,
      cards: [
        ...cards.filter((c) => c.state === 'waiting'),
        ...cards.filter((c) => c.state !== 'waiting').reverse(),
      ].map(cardOut),
    }
  }

  // the task a run served, when it served one
  const taskOfRun = (run: string): string | null =>
    (engine.hands?.runner.runs(200) ?? []).find((r) => r.id === run)?.task ?? null
  // What Alpha's Mac app shows as notifications (Kenil's plan, 21 Oct): reminders that came and
  // cards that began waiting on the person since the app last asked, each with the place a click
  // opens. Asked first with no cursor, it gives only where to start, so nothing old comes back.
  app.get('/api/notices', async (req) => {
    const { after } = z.object({ after: z.coerce.number().optional() }).parse(req.query)
    if (options.shell) options.shell.seen = Date.now()
    const last = world.lastLineId()
    if (after === undefined) return { last, notices: [] }
    const notices: {
      id: string
      title: string
      subtitle: string | null
      body: string
      open: string
    }[] = []
    for (const l of world.lines({ after, kinds: ['reminder', 'card_opened'] })) {
      if (l.kind === 'reminder') {
        const t = world.tasks.get(String((l.data as { task?: string }).task ?? ''))
        if (!t) continue
        const place = placeOf(t.place).words
        notices.push({
          id: `line-${l.id}`,
          title: 'Reminder',
          subtitle: place === 'nowhere yet' ? null : place,
          body: t.title,
          open: `#/tasks/${t.id}`,
        })
        continue
      }
      const c = world.cards.get(String((l.data as { card?: string }).card ?? l.card ?? ''))
      if (c?.state !== 'waiting' || (c.user && c.user !== user.id)) continue
      const task = c.run ? taskOfRun(c.run) : null
      notices.push({
        id: `card-${c.id}`,
        title: 'Needs you',
        subtitle: c.module ? (world.shape.module(c.module)?.name ?? null) : null,
        body: c.words,
        open: task ? `#/tasks/${task}` : '#/',
      })
    }
    return { last, notices }
  })

  // Start the agent a task is given to on it; its run goes on after this answers.
  app.post('/api/tasks/:id/start', async (req): Promise<TaskView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const runner = engine.hands?.runner
    if (!runner) throw new Refused('Agents are not set up in this core.')
    runner.startTask(id, { user: user.id, turn: null }).run.catch(() => undefined)
    live()
    return taskOut(id)
  })

  app.get('/api/tasks/:id', async (req, reply): Promise<TaskView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const t = taskOut(id)
    if (!t) return reply.code(404).send({ problem: 'That task is not there.' })
    return t
  })

  const TaskBody = z.object({
    title: z.string().optional(),
    notes: z.string().nullable().optional(),
    due: z.string().nullable().optional(),
    remindAt: z.string().nullable().optional(),
    repeat: z.string().nullable().optional(),
    priority: z.enum(['high', 'normal', 'low']).optional(),
    owner: z
      .object({ kind: z.enum(['person', 'alpha', 'agent']), id: z.string().nullable().optional() })
      .optional(),
    parent: z.string().nullable().optional(),
    on: z
      .object({
        module: z.string().optional(),
        table: z.string().optional(),
        row: z.string().optional(),
        field: z.string().optional(),
        page: z.string().optional(),
      })
      .nullable()
      .optional(),
  })
  // only what was sent: a field left out is left as it is
  const given = <T extends object>(o: T) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

  app.post('/api/tasks', async (req): Promise<TaskView | undefined> => {
    const b = TaskBody.parse(req.body)
    const t = world.tasks.add(
      { ...given(b), title: b.title ?? '', ...(b.on ? { placedBy: 'person' } : {}) } as Parameters<
        typeof world.tasks.add
      >[0],
      asPerson,
    )
    live()
    return taskOut(t.id)
  })

  app.post('/api/tasks/:id', async (req): Promise<TaskView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const b = TaskBody.parse(req.body)
    world.tasks.change(
      id,
      {
        ...given(b),
        ...(b.on !== undefined ? { placedBy: 'person', placedWhy: null } : {}),
      } as Parameters<typeof world.tasks.change>[1],
      asPerson,
    )
    live()
    return taskOut(id)
  })

  app.post('/api/tasks/:id/state', async (req): Promise<TaskView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { state } = z
      .object({ state: z.enum(['todo', 'doing', 'waiting', 'done', 'dropped']) })
      .parse(req.body)
    world.tasks.setState(id, state, asPerson)
    live()
    return taskOut(id)
  })

  // the person's own removal, from their window: their word is the ask
  app.delete('/api/tasks/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const n = world.tasks.remove([id], asPerson)
    live()
    return { removed: n }
  })

  // open tasks per row of a table, for the counts beside its rows
  app.get('/api/tables/:id/tasks', async (req): Promise<Record<string, number>> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const counts: Record<string, number> = {}
    for (const t of world.tasks.list({
      open: true,
      on: { module: null, table: id, row: null, field: null, page: null },
    }))
      if (t.place.row) counts[t.place.row] = (counts[t.place.row] ?? 0) + 1
    return counts
  })

  // The modules the window shows: each with a page or a table in sight, and the modules they sit
  // inside (a module only of a connection's hidden tables stays out).
  // What an agent needs that is not there, in words, from its file.
  const needsOf = (m: Module, a: Agent): string | null => {
    const path = join(m.dir, a.file)
    if (!existsSync(path)) return null
    try {
      const missing = unmetNeeds(world, readAgent(path))
      return missing.length ? `needs ${missing.join(' and ')}` : null
    } catch {
      return null
    }
  }

  const summaries = (): ModuleSummary[] => {
    const all = world.shape.modules().map((m) => ({
      id: m.id,
      name: m.name,
      parent: m.parent,
      pages: pagesOf(m),
      tables: world.shape
        .tables(m.id)
        .filter((t) => !t.hidden)
        .map((t) => ({ id: t.id, name: t.name, rows: world.records.count(t.id) })),
    }))
    const shown = new Set<string>()
    for (const m of all) {
      if (!m.tables.length && !m.pages.length) continue
      for (let p: ModuleSummary | undefined = m; p && !shown.has(p.id); ) {
        shown.add(p.id)
        p = all.find((x) => x.id === p?.parent)
      }
    }
    return all.filter((m) => shown.has(m.id))
  }

  app.get('/api/modules', async (): Promise<ModuleSummary[]> => summaries())

  // A module inside another, or at the top level: the person's word, kept over a kit's.
  app.post('/api/modules/:id/place', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { within } = z.object({ within: z.string().nullable() }).parse(req.body)
    const m = world.shape.place(id, within, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { id: m.id, parent: m.parent }
  })

  // In the sidebar or out of it (Settings › Connections).
  app.post('/api/tables/:id/sidebar', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { shown } = z.object({ shown: z.boolean() }).parse(req.body)
    const t = world.shape.setHidden(id, !shown, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    return { id: t.id, hidden: t.hidden }
  })

  // The person sets a value in the window (a board's column, a Home line's Pass, Correct it in the
  // source panel): their own word, journaled, and the value's source. The world checks its kind.
  app.post('/api/tables/:id/rows/:row', async (req) => {
    const { id, row } = z.object({ id: z.string(), row: z.string() }).parse(req.params)
    const { field, value } = z.object({ field: z.string(), value: z.unknown() }).parse(req.body)
    const t = world.shape.table(id)
    const f = t?.fields.find((x) => x.name === field)
    if (!t || !f) throw new Refused('That field is not there.')
    if (f.kind === 'relation' || f.kind === 'file' || f.kind === 'person')
      throw new Refused(`${f.name} is set by asking Alpha, not from here.`)
    const r = world.records.list(t.id).find((x) => x.id === row)
    if (!r) throw new Refused(`${t.name} has no such row.`)
    const said =
      value && typeof value === 'object' && 'amount' in value
        ? String((value as { amount: unknown }).amount)
        : String(value)
    const line = world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'set',
      words: `Set ${field} to ${said} on ${world.rowName(t, r.values)}`,
      data: { table: t.id, row, field, value },
      user: user.id,
      module: t.module.id,
    })
    // typing over a figure a script worked out keeps that figure beside theirs, with Reset
    const was = r.provenance[f.slug]
    world.records.change(
      t.id,
      [
        {
          id: row,
          values: { [field]: value },
          provenance: { kind: 'stated', source: { message: line.id } },
        },
      ],
      { actor: { kind: 'person', id: user.id }, user: user.id },
    )
    if (was?.kind === 'computed' && r.values[f.slug] !== undefined)
      world.records.keepBeside(t.id, row, {
        [f.name]: {
          value: r.values[f.slug],
          ...(was.source.formula ? { formula: was.source.formula } : {}),
          ...(was.source.note ? { note: was.source.note } : {}),
        },
      })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  // The person adds a row in the window: each value theirs, the line saying so its source.
  app.post('/api/tables/:id/rows', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { values } = z.object({ values: z.record(z.string(), z.unknown()) }).parse(req.body)
    const t = world.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    const given = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== '' && v !== null && v !== undefined),
    )
    if (!Object.keys(given).length) throw new Refused('Give the row at least one value.')
    const line = world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'set',
      words: `Added a row to ${t.name}`,
      data: { table: t.id, values: given },
      user: user.id,
      module: t.module.id,
    })
    const [row] = world.records.add(
      t.id,
      [{ values: given, provenance: { kind: 'stated', source: { message: line.id } } }],
      { actor: { kind: 'person', id: user.id }, user: user.id },
    )
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { id: row }
  })

  // Many rows at once from the window: a paste, or a field set on ticked rows. Each value is the
  // person's word, with one line as its source; what is set by asking Alpha is refused.
  app.post('/api/tables/:id/rows/many', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const Values = z.record(z.string(), z.unknown())
    const body = z
      .object({
        set: z.array(z.object({ row: z.string(), values: Values })).default([]),
        add: z.array(z.object({ values: Values })).default([]),
      })
      .parse(req.body)
    const t = world.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    if (!body.set.length && !body.add.length) throw new Refused('There is nothing to put in.')
    for (const v of [...body.set, ...body.add])
      for (const name of Object.keys(v.values)) {
        const f = findField(t, name)
        if (f.kind === 'relation' || f.kind === 'file' || f.kind === 'person')
          throw new Refused(`${f.name} is set by asking Alpha, not from here.`)
      }
    const words = [
      body.set.length
        ? `set values on ${body.set.length} row${body.set.length === 1 ? '' : 's'}`
        : '',
      body.add.length ? `added ${body.add.length} row${body.add.length === 1 ? '' : 's'}` : '',
    ]
      .filter(Boolean)
      .join(' and ')
    const line = world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'set',
      words: `In ${t.name}, ${words}`,
      data: { table: t.id, set: body.set, add: body.add },
      user: user.id,
      module: t.module.id,
    })
    const ctx = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
    const provenance = { kind: 'stated' as const, source: { message: line.id } }
    if (body.set.length)
      world.records.change(
        t.id,
        body.set.map((s) => ({ id: s.row, values: s.values, provenance })),
        ctx,
      )
    const added = body.add.length
      ? world.records.add(
          t.id,
          body.add.map((a) => ({ values: a.values, provenance })),
          ctx,
        )
      : []
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { changed: body.set.length, added: added.length }
  })

  // The person removes rows they ticked, having said yes in the window; the journal keeps them.
  app.post('/api/tables/:id/rows/remove', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { rows } = z.object({ rows: z.array(z.string()).min(1) }).parse(req.body)
    const removed = world.records.remove(id, rows, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { removed }
  })

  // The person adds a field from the table's header.
  app.post('/api/tables/:id/fields', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const f = z
      .object({
        name: z.string().trim().min(1),
        kind: z.enum(FIELD_KINDS),
        choices: z.array(z.string().trim().min(1)).optional(),
        relatesTo: z.string().optional(),
      })
      .parse(req.body)
    world.shape.addFields(
      id,
      [
        {
          name: f.name,
          kind: f.kind,
          ...(f.choices ? { choices: f.choices } : {}),
          ...(f.relatesTo ? { relatesTo: f.relatesTo } : {}),
        },
      ],
      { actor: { kind: 'person', id: user.id }, user: user.id },
    )
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  // Export: exactly the rows and columns the person was looking at, as CSV or Excel.
  app.post('/api/tables/:id/export', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const body = z
      .object({
        rows: z.array(z.string()),
        fields: z.array(z.string()),
        as: z.enum(['csv', 'xlsx']),
      })
      .parse(req.body)
    const t = world.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    const fields = body.fields.map((f) => findField(t, f))
    const byId = new Map(world.records.list(t.id).map((r) => [r.id, r]))
    const names = new Map<string, string>()
    for (const f of fields)
      if (f.kind === 'relation' && f.relatesTo) {
        const other = world.shape.table(f.relatesTo)
        if (other)
          for (const r of world.records.list(other.id))
            names.set(r.id, world.rowName(other, r.values))
      }
    const people = world.people.names(
      fields
        .filter((f) => f.kind === 'person')
        .flatMap((f) => [...byId.values()].map((r) => r.values[f.slug]))
        .filter((v): v is string => typeof v === 'string'),
    )
    const cell = (kind: string, v: unknown): Cell => {
      if (v === null || v === undefined) return null
      if (kind === 'person') return people[String(v)] ?? String(v)
      if (kind === 'money' && typeof v === 'object') return (v as { amount: number }).amount
      if (kind === 'number') return Number(v)
      if (kind === 'relation')
        return (Array.isArray(v) ? v : [v]).map((x) => names.get(String(x)) ?? '').join(', ')
      if (Array.isArray(v)) return v.join(', ')
      return String(v)
    }
    const rows = body.rows
      .map((r) => byId.get(r))
      .filter((r) => !!r)
      .map((r) => fields.map((f) => cell(f.kind, r.values[f.slug])))
    const bytes = sheetBytes(
      t.name,
      fields.map((f) => f.name),
      rows,
      body.as,
    )
    return reply
      .header(
        'content-type',
        body.as === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .header(
        'content-disposition',
        `attachment; filename="${encodeURIComponent(t.name)}.${body.as}"`,
      )
      .send(Buffer.from(bytes))
  })

  app.get('/api/tables/:id/rows/:row/history', async (req): Promise<HistoryView[]> => {
    const { row } = z.object({ id: z.string(), row: z.string() }).parse(req.params)
    const { field } = z.object({ field: z.string() }).parse(req.query)
    return world.records
      .history(row, field)
      .map((h) => ({ value: h.value, source: h.provenance ? sourceView(h.provenance) : null }))
  })

  app.get('/api/tables/:id', async (req, reply): Promise<TableView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const t = world.shape.table(id)
    if (!t) return reply.code(404).send({ problem: 'That table is not there.' })
    return {
      id: t.id,
      name: t.name,
      module: { id: t.module.id, name: t.module.name },
      documents: t.documents,
      fields: t.fields.map((f) => ({
        id: f.id,
        name: f.name,
        slug: f.slug,
        kind: f.kind,
        choices: f.choices,
        tones: f.tones,
        many: f.many,
      })),
      views: world.views.list(t.id).map(savedView),
      rows: world.records.list(t.id).map((r) => ({
        id: r.id,
        values: r.values,
        sources: Object.fromEntries(
          Object.entries(r.provenance).map(([k, p]) => [k, sourceView(p)]),
        ),
      })),
      names: {
        ...Object.fromEntries(
          t.fields
            .filter((f) => f.kind === 'relation' && f.relatesTo)
            .flatMap((f) => {
              const other = world.shape.table(f.relatesTo as string)
              return other
                ? world.records.list(other.id).map((r) => [r.id, world.rowName(other, r.values)])
                : []
            }),
        ),
        // the people its person fields hold, by name
        ...world.people.names(
          t.fields
            .filter((f) => f.kind === 'person')
            .flatMap((f) => world.records.list(t.id).map((r) => r.values[f.slug]))
            .filter((v): v is string => typeof v === 'string'),
        ),
      },
    }
  })

  app.post('/api/files', async (req) => {
    const name = decodeURIComponent(String(req.headers['x-file-name'] ?? 'file'))
    const mime = String(req.headers['content-type'] ?? 'application/octet-stream')
    const body = req.body as Buffer
    const out = engine.drop(user, new Uint8Array(body), name, mime)
    return { name: out.file.name, readable: out.readable, pieces: out.document?.chunks ?? 0 }
  })

  // A row's files, and a file dropped on a row: filed there at once, as the person's.
  const person = { kind: 'person' as const, id: user.id }
  const live = () => engine.events.emit('event', { type: 'lines', user: user.id })
  const byWords = (madeBy: string): string => {
    const [kind, id] = madeBy.split(/:(.*)/s)
    if (kind === 'person') return id === user.id ? 'You' : (world.user(id ?? '')?.name ?? 'Someone')
    if (kind === 'agent' || kind === 'connector') return id ?? kind
    if (kind === 'system') return 'Its kit'
    return 'Alpha'
  }
  const rowOf = (params: unknown) => {
    const { id, row } = z.object({ id: z.string(), row: z.string() }).parse(params)
    const t = world.shape.table(id)
    const rec = world.records.get(row)
    if (!t || rec?.table.id !== t.id) throw new Refused('That row is not there.')
    return rec
  }
  const rowFiles = (record: string): RowFileView[] =>
    world.rowFiles(record).map((f) => ({
      hash: f.file.hash,
      name: f.file.name,
      size: f.file.size,
      mime: f.file.mime,
      kind: f.kind,
      by: byWords(f.placedBy),
      at: f.placedAt,
      read: f.document ? 'read' : stillBeingRead(f.file.hash) ? 'reading' : 'kept',
    }))
  app.get(
    '/api/tables/:id/rows/:row/files',
    async (req): Promise<RowFileView[]> => rowFiles(rowOf(req.params).record.id),
  )
  app.post('/api/tables/:id/rows/:row/files', async (req): Promise<RowFileView[]> => {
    const rec = rowOf(req.params)
    const name = decodeURIComponent(String(req.headers['x-file-name'] ?? 'file'))
    const mime = String(req.headers['content-type'] ?? 'application/octet-stream')
    const kind = req.headers['x-file-kind']
      ? decodeURIComponent(String(req.headers['x-file-kind']))
      : null
    const out = engine.drop(user, new Uint8Array(req.body as Buffer), name, mime)
    world.placeFile(out.file.hash, rec.record.id, kind, { actor: person, user: user.id })
    live()
    return rowFiles(rec.record.id)
  })
  app.post('/api/tables/:id/rows/:row/files/:hash', async (req): Promise<RowFileView[]> => {
    const rec = rowOf(req.params)
    const { hash } = z.object({ hash: z.string() }).parse(req.params)
    const { kind, off } = z
      .object({ kind: z.string().nullable().optional(), off: z.boolean().optional() })
      .parse(req.body ?? {})
    if (off) world.unplaceFile(hash, rec.record.id, { actor: person, user: user.id })
    else world.placeFile(hash, rec.record.id, kind ?? null, { actor: person, user: user.id })
    live()
    return rowFiles(rec.record.id)
  })

  // A document as the window shows it at a value's place, and a PDF's page drawn.
  app.get('/api/files/:hash/view', async (req, reply): Promise<FileView | undefined> => {
    const { hash } = z.object({ hash: z.string() }).parse(req.params)
    const f = world.files.file(hash)
    if (!f) return reply.code(404).send({ problem: 'That file is not there.' })
    const doc = world.files.document(hash)
    const base = { hash, name: f.name, mime: f.mime }
    if (!doc) return { ...base, kind: stillBeingRead(hash) ? 'reading' : 'kept' }
    const chunks = world.files.chunks(doc.id)
    if (doc.kind === 'sheet') {
      const sheets = new Map<string, NonNullable<FileView['sheets']>[number]['cells']>()
      for (const c of chunks) {
        const sheet = c.position.sheet ?? 'Sheet'
        const cell = c.position.cell ?? ''
        if (!sheets.has(sheet)) sheets.set(sheet, [])
        sheets.get(sheet)?.push({
          cell,
          row: c.position.row ?? Number(cell.replace(/^[A-Z]+/, '')),
          col: columnOf(cell),
          words: c.words,
        })
      }
      return {
        ...base,
        kind: 'sheet',
        sheets: [...sheets].map(([name, cells]) => ({ name, cells })),
      }
    }
    if (doc.kind === 'pdf')
      return {
        ...base,
        kind: 'pdf',
        pages: Math.max(1, ...chunks.map((c) => c.position.page ?? 1)),
      }
    return {
      ...base,
      kind: 'text',
      lines: chunks.map((c, i) => ({ line: c.position.line ?? i + 1, words: c.words })),
    }
  })
  app.get('/api/files/:hash/page/:n', async (req, reply) => {
    const { hash, n } = z
      .object({ hash: z.string(), n: z.coerce.number().int().min(1) })
      .parse(req.params)
    const f = world.files.file(hash)
    if (!f || !(f.mime === 'application/pdf' || /\.pdf$/i.test(f.name)))
      return reply.code(404).send({ problem: 'That is not a PDF.' })
    const dir = join(world.paths.dir, 'cache', 'pages')
    const png = join(dir, `${hash}-${n}.png`)
    if (!existsSync(png)) {
      const page = await renderPage(world.files.path(hash), n, world.paths.envs)
      mkdirSync(dir, { recursive: true })
      writeFileSync(png, page.png)
    }
    return reply
      .type('image/png')
      .header('cache-control', 'private, max-age=86400')
      .send(readFileSync(png))
  })

  app.get('/api/files/:hash', async (req, reply) => {
    const { hash } = z.object({ hash: z.string() }).parse(req.params)
    const f = world.files.file(hash)
    if (!f) return reply.code(404).send({ problem: 'That file is not there.' })
    return reply
      .type(f.mime)
      .header('content-disposition', `inline; filename="${encodeURIComponent(f.name)}"`)
      .send(world.files.bytes(hash))
  })

  app.get('/api/connectors', async (): Promise<ConnectorsView> => {
    return {
      connectors: KNOWN.map((c) => ({
        name: c.manifest.name,
        title: c.manifest.title,
        auth: c.manifest.auth,
        account: c.manifest.account,
        ...(c.manifest.secret ? { secret: c.manifest.secret } : {}),
      })),
      connections: world.connections.list().map((k) => ({
        id: k.id,
        connector: k.connector,
        title: connectorOf(k.connector).manifest.title,
        account: k.account,
        inBrowser: connectorOf(k.connector).manifest.auth === 'browser',
        state: k.state,
        health: k.health,
        lastSyncAt: k.lastSyncAt,
        settings:
          k.state === 'needs_sign_in' && k.connector === 'contacts'
            ? 'contacts'
            : k.state === 'needs_sign_in' && k.connector === 'calendar'
              ? 'calendars'
              : null,
        tables: connectorOf(k.connector).tables.flatMap((spec) => {
          const t = world.shape.table(spec.name)
          return t ? [{ id: t.id, name: t.name, hidden: t.hidden }] : []
        }),
      })),
    }
  })

  // The person connects in Alpha's own form: the secret goes to the Keychain, never the world.
  app.post('/api/connections', async (req) => {
    const b = z
      .object({
        connector: z.string(),
        account: z.string().trim().min(1),
        secret: z.string().optional(),
      })
      .parse(req.body)
    const c = await engine.connect(user, b.connector, b.account, b.secret ?? null)
    return { id: c.id, state: c.state }
  })

  app.delete('/api/connections/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    await engine.disconnect(user, id)
    return { ok: true }
  })

  // A connection read as the person (LinkedIn): its site opens in its own window of Google Chrome,
  // where they sign in themselves; when they quit it, the connection is read.
  app.post('/api/connections/:id/sign-in', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const conn = world.connections.get(id)
    if (!conn) throw new Refused('That connection is not there.')
    const c = connectorOf(conn.connector)
    const url = c.manifest.signIn
    if (c.manifest.auth !== 'browser' || !url)
      throw new Refused(`${c.manifest.title} is not signed in to in a browser.`)
    const hands = engine.hands
    if (!hands) throw new Refused('Alpha has no browser here.')
    if (!chromePath()) throw new Refused('Signing in to a site needs Google Chrome on this Mac.')
    void (async () => {
      await hands.browser().signIn(url)
      await engine.sync(user, id).catch(() => undefined)
      live()
    })().catch(() => undefined)
    return { opened: true }
  })

  app.post('/api/connections/:id/sync', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    await engine.sync(user, id)
    return { ok: true }
  })

  // Kits and agents (design §10, §11): what each module does on its own.
  app.get('/api/working', async (): Promise<WorkingModuleView[]> => {
    const kits = new Map(installedKits(world).map((k) => [k.module, k]))
    const running = new Set(
      (engine.hands?.runner.runs(200) ?? [])
        .filter((r) => r.state === 'running')
        .map((r) => r.agent),
    )
    return world.shape
      .modules()
      .map((m) => {
        const k = kits.get(m.id)
        return {
          id: m.id,
          name: m.name,
          kit: k
            ? {
                name: k.kit,
                version: k.version,
                source: k.source,
                api: k.api,
                maintainer: k.maintainer,
                changes: k.maintainer ? unseenChanges(world, m.id) : 0,
              }
            : null,
          agents: agents(world, m.id).map((a) => ({
            id: a.id,
            name: a.name,
            state: a.state,
            description: a.description,
            needs: needsOf(m, a),
            when: whenWords(a.trigger),
            lastRunAt: a.lastRunAt,
            running: running.has(a.id),
          })),
        }
      })
      .filter((m) => m.kit || m.agents.length)
  })

  // A kit is installed from a folder on this Mac, or updated from one by the ownership rule.
  app.post('/api/kits', async (req) => {
    const { folder } = z.object({ folder: z.string().trim().min(1) }).parse(req.body)
    const m = await install(world, folder, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { module: m.id }
  })

  // A kit pack sent as a file: kept unpacked in Alpha's folder, then installed, or its kit updated.
  app.post('/api/kits/pack', async (req) => {
    const name = decodeURIComponent(String(req.headers['x-file-name'] ?? 'kit.alphakit'))
    const dir = mkdtempSync(join(tmpdir(), 'alpha-kit-'))
    try {
      const file = join(dir, name.replace(/[^\w.-]/g, '_'))
      writeFileSync(file, req.body as Buffer)
      const words = await installPack(world, file, join(world.paths.dir, '..', '..', 'kits'), {
        actor: person,
        user: user.id,
      })
      live()
      return { words }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  app.post('/api/kits/:module/update', async (req) => {
    const { module } = z.object({ module: z.string() }).parse(req.params)
    const { folder } = z.object({ folder: z.string().trim().optional() }).parse(req.body ?? {})
    const m = world.shape.module(module)
    const k = installedKits(world).find((x) => x.module === m?.id)
    if (!m || !k) throw new Refused('That module did not come from a kit.')
    const report = await update(world, m.name, folder || k.source, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return report
  })

  // What of a kit is the person's now (decision 3), and the kit's version of one thing back.
  app.get('/api/kits/:module/yours', async (req): Promise<YoursView> => {
    const { module } = z.object({ module: z.string() }).parse(req.params)
    return yours(world, module)
  })
  app.post('/api/kits/:module/yours/back', async (req) => {
    const { module } = z.object({ module: z.string() }).parse(req.params)
    const what = z
      .union([
        z.object({ kind: z.literal('file'), path: z.string() }),
        z.object({ kind: z.literal('row'), table: z.string(), key: z.string() }),
        z.object({ kind: z.literal('view'), table: z.string(), name: z.string() }),
      ])
      .parse(req.body)
    const words = await takeBack(world, module, what, { actor: person, user: user.id })
    live()
    return { words }
  })
  // a field the kit no longer uses, removed with its values, by the person
  app.post('/api/kits/:module/fields/remove', async (req) => {
    const { module } = z.object({ module: z.string() }).parse(req.params)
    const { table, field } = z.object({ table: z.string(), field: z.string() }).parse(req.body)
    const t = world.shape.table(table)
    if (!t || t.module.id !== module) throw new Refused('That table is not there.')
    world.shape.removeHiddenField(t.id, field, { actor: person, user: user.id })
    live()
    return { ok: true }
  })

  app.post('/api/agents/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { state } = z.object({ state: z.enum(['on', 'paused']) }).parse(req.body)
    setAgentState(world, id, state, user.id)
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  // A site's sign-in: it opens in the person's own Google Chrome on this Mac, they sign in there
  // themselves, and when they quit that Chrome the card is answered and the agent that met the
  // sign-in runs again.
  app.post('/api/cards/:id/sign-in', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const card = world.cards.get(id)
    const input = (card?.call?.input ?? {}) as { url?: string; agent?: string | null }
    if (card?.state !== 'waiting' || card.call?.tool !== 'site_sign_in' || !input.url)
      throw new Refused('That sign-in is not waiting.')
    const hands = engine.hands
    if (!hands) throw new Refused('Alpha has no browser here.')
    if (!chromePath()) throw new Refused('Signing in to a site needs Google Chrome on this Mac.')
    const url = input.url
    void (async () => {
      await hands.browser().signIn(url)
      world.cards.answer(id, 'Sign in', { kind: 'person', id: user.id })
      const agent = agents(world).find((a) => a.id === input.agent)
      if (agent) await hands.runner.runAgent(agent, { user: user.id, turn: null })
      engine.events.emit('event', { type: 'lines', user: user.id })
    })().catch(() => undefined)
    return { opened: true }
  })

  // Every agent of a module on, or paused, at once (a kit's readers start paused).
  app.post('/api/modules/:id/agents', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { state } = z.object({ state: z.enum(['on', 'paused']) }).parse(req.body)
    const m = world.shape.module(id)
    if (!m) throw new Refused('That module is not there.')
    const list = agents(world, m.id)
    for (const a of list) setAgentState(world, a.id, state, user.id)
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { changed: list.length }
  })

  // Run an agent now; its outcome reaches Activity, not this answer.
  app.post('/api/agents/:id/run', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const runner = engine.hands?.runner
    const a = agents(world).find((x) => x.id === id)
    if (!runner || !a) throw new Refused('That agent is not there.')
    void runner.runAgent(a, { user: user.id, turn: null }).catch(() => undefined)
    return { ok: true }
  })

  app.get('/api/modules/:id', async (req, reply): Promise<ModuleView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const m = world.shape.module(id)
    if (!m) return reply.code(404).send({ problem: 'That module is not there.' })
    const k = installedKits(world).find((x) => x.module === m.id)
    const running = new Set(
      (engine.hands?.runner.runs(200) ?? [])
        .filter((r) => r.state === 'running')
        .map((r) => r.agent),
    )
    const notes = join(m.dir, 'NOTES.md')
    const everyModule = world.shape.modules()
    const everyAgent = agents(world)
    const waiting = world.cards.waiting(user.id)
    const openTasks = world.tasks.list({ open: true })
    return {
      id: m.id,
      name: m.name,
      kit: k ? { name: k.kit, version: k.version } : null,
      agents: agents(world, m.id).map((a) => ({
        id: a.id,
        name: a.name,
        state: a.state,
        description: a.description,
        needs: needsOf(m, a),
        when: whenWords(a.trigger),
        lastRunAt: a.lastRunAt,
        running: running.has(a.id),
      })),
      sites: moduleNetwork(m).length,
      notes: existsSync(notes) ? readFileSync(notes, 'utf8') : '',
      parent: m.parent,
      pages: pagesOf(m),
      tables: world.shape
        .tables(m.id)
        .filter((t) => !t.hidden)
        .map((t) => ({ id: t.id, name: t.name, rows: world.records.count(t.id) })),
      modules: summaries()
        .filter((c) => c.parent === m.id)
        .map((c) => {
          // what goes on in it counts what sits inside it too
          const within = new Set([c.id])
          for (let grew = true; grew; ) {
            grew = false
            for (const x of everyModule)
              if (x.parent && within.has(x.parent) && !within.has(x.id)) {
                within.add(x.id)
                grew = true
              }
          }
          const its = everyAgent.filter((a) => within.has(a.module))
          return {
            ...c,
            kit: installedKits(world).find((x) => x.module === c.id)?.kit ?? null,
            agents: its.filter((a) => a.state === 'on').length,
            running: its.filter((a) => running.has(a.id)).length,
            needs: waiting.filter((x) => x.module && within.has(x.module)).length,
            tasks: openTasks.filter((t) => t.place.module && within.has(t.place.module)).length,
          }
        }),
    }
  })

  // Reset: a value the person typed over goes back to what Alpha works it out as, kept beside it.
  app.post('/api/tables/:id/rows/:row/reset', async (req) => {
    const { id, row } = z.object({ id: z.string(), row: z.string() }).parse(req.params)
    const { field } = z.object({ field: z.string() }).parse(req.body)
    const t = world.shape.table(id)
    const f = t?.fields.find((x) => x.name === field || x.slug === field)
    if (!t || !f) throw new Refused('That field is not there.')
    const r = world.records.list(t.id).find((x) => x.id === row)
    const beside = r?.provenance[f.slug]?.beside
    if (!r || !beside) throw new Refused(`${f.name} has no figure of Alpha's to go back to.`)
    world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'set',
      words: `Reset ${f.name} to Alpha's figure on ${world.rowName(t, r.values)}`,
      data: { table: t.id, row, field: f.name },
      user: user.id,
      module: t.module.id,
    })
    world.records.change(
      t.id,
      [
        {
          id: row,
          values: { [f.name]: beside.value },
          provenance: {
            kind: 'computed',
            source: {
              formula: beside.formula ?? 'Alpha’s figure',
              ...(beside.note ? { note: beside.note } : {}),
            },
          },
        },
      ],
      { actor: { kind: 'person', id: user.id }, user: user.id },
    )
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  // A module's page (design §13): the document its frame shows, the answers to what it asks (its
  // module's rows, read-only), and the page printed to a PDF with the choices the window had.
  const pageModule = (id: string) => {
    const m = world.shape.module(id)
    if (!m) throw new Refused('That module is not there.')
    return m
  }
  app.get('/api/modules/:id/pages/:name', async (req) => {
    const { id, name } = z.object({ id: z.string(), name: z.string() }).parse(req.params)
    const m = pageModule(id)
    const page = pagesOf(m).find((p) => p.name === name)
    if (!page) throw new Refused(`${m.name} has no page called ${name}.`)
    return { ...page, html: pageDocument(m, name) }
  })
  app.post('/api/modules/:id/pages/:name/ask', async (req) => {
    const { id } = z.object({ id: z.string(), name: z.string() }).parse(req.params)
    const { op, args } = z
      .object({ op: z.string(), args: z.record(z.string(), z.unknown()).default({}) })
      .parse(req.body)
    return { value: pageAnswer(world, pageModule(id), op, args) }
  })
  app.post('/api/modules/:id/pages/:name/pdf', async (req, reply) => {
    const { id, name } = z.object({ id: z.string(), name: z.string() }).parse(req.params)
    const { inputs } = z
      .object({ inputs: z.record(z.string(), z.string()).default({}) })
      .parse(req.body ?? {})
    if (!options.browsers) throw new Refused('Alpha has no browser here to print with.')
    const pdf = await printPage(world, pageModule(id), name, {
      browsers: options.browsers,
      inputs,
      as: 'pdf',
    })
    return reply.type('application/pdf').send(pdf)
  })

  // What Alpha remembers, each line removable by the person (the instructions files, design §6).
  const instructionLines = (who: 'me' | 'everyone') => {
    const file = instructionsFile(world, who === 'me' ? user.id : null)
    return existsSync(file)
      ? readFileSync(file, 'utf8')
          .split('\n')
          .filter((l) => l.startsWith('- '))
          .map((l) => l.slice(2).trim())
      : []
  }

  app.get(
    '/api/instructions',
    async (): Promise<InstructionView[]> => [
      ...instructionLines('me').map((words) => ({ for: 'me' as const, words })),
      ...instructionLines('everyone').map((words) => ({ for: 'everyone' as const, words })),
    ],
  )

  app.post('/api/instructions/remove', async (req) => {
    const b = z.object({ for: z.enum(['me', 'everyone']), words: z.string() }).parse(req.body)
    const file = instructionsFile(world, b.for === 'me' ? user.id : null)
    if (!existsSync(file)) throw new Refused('There is nothing remembered there.')
    const lines = readFileSync(file, 'utf8').split('\n')
    const at = lines.findIndex((l) => l.startsWith('- ') && l.slice(2).trim() === b.words)
    if (at < 0) throw new Refused('That is not remembered.')
    lines.splice(at, 1)
    writeFileSync(file, lines.join('\n'))
    world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'forgot',
      words: `Will no longer remember: ${b.words}`,
      data: { for: b.for },
      user: user.id,
    })
    return { ok: true }
  })

  const modelView = (): ModelView => ({
    desk: config.models().desk,
    route: engine.route?.name ?? 'subscription',
    hasKey: engine.route?.hasKey ?? false,
  })
  app.get('/api/model', async (): Promise<ModelView> => modelView())
  // This Mac's setup, for the first open and Settings, and the readers' downloads started on asking.
  app.get(
    '/api/setup',
    async (): Promise<SetupView | null> => (options.setup ? options.setup.view() : null),
  )
  app.post('/api/setup/signin', async () => ({ started: options.setup?.signIn() ?? false }))
  // System Settings opened at the pane where the person turns Alpha Helper on (Contacts or
  // Calendars): the one switch macOS keeps outside Alpha after a no.
  app.post('/api/setup/settings', async (req) => {
    const { pane } = z.object({ pane: z.enum(['contacts', 'calendars']) }).parse(req.body)
    if (process.platform === 'darwin')
      execFile(
        '/usr/bin/open',
        [
          `x-apple.systempreferences:com.apple.preference.security?Privacy_${pane === 'contacts' ? 'Contacts' : 'Calendars'}`,
        ],
        () => undefined,
      )
    return { ok: true }
  })
  app.post('/api/setup/prepare', async () => {
    options.setup?.prepare()
    return { ok: true }
  })
  app.post('/api/setup/awake', async (req) => {
    const { on } = z.object({ on: z.boolean() }).parse(req.body)
    options.setup?.setKeepAwake(on)
    return { ok: true }
  })
  // The route, the person's choice: their own subscription, or an API key kept in the Keychain.
  app.post('/api/model', async (req): Promise<ModelView> => {
    const { route, key } = z
      .object({ route: z.enum(['subscription', 'key']), key: z.string().max(400).optional() })
      .parse(req.body)
    if (!engine.route) throw new Refused('The route is not set up in this core.')
    await engine.route.set(route, key ?? null, user.id)
    engine.rerouted()
    live()
    return modelView()
  })

  // Saved views: the person makes, saves, renames, makes default and removes them.
  const ViewBody = z.object({
    name: z.string(),
    config: z.unknown(),
    isDefault: z.boolean().optional(),
  })
  app.post('/api/tables/:id/views', async (req): Promise<SavedView> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const body = ViewBody.parse(req.body)
    return savedView(
      world.views.save(
        { table: id, ...body },
        { actor: { kind: 'person', id: user.id }, user: user.id },
      ),
    )
  })
  app.put('/api/views/:id', async (req, reply): Promise<SavedView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const v = world.views.get(id)
    if (!v) return reply.code(404).send({ problem: 'That view is not there.' })
    const body = ViewBody.partial().parse(req.body)
    return savedView(
      world.views.save(
        {
          table: v.table,
          id,
          name: body.name ?? v.name,
          config: body.config ?? v.config,
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        },
        { actor: { kind: 'person', id: user.id }, user: user.id },
      ),
    )
  })
  app.delete('/api/views/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    world.views.remove(id, { actor: { kind: 'person', id: user.id }, user: user.id })
    return { ok: true }
  })

  app.get('/api/activity', async (): Promise<RunView[]> => activity())

  // Today: what changed since the person last cleared it, and each clock agent's next run.
  app.get('/api/today', async (): Promise<TodayView> => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    // never cleared yet: since the start of today
    const since = world.preference(user.id, 'seen_at') ?? start.toISOString()
    const changed = activity()
      .filter(
        (r) => r.startedAt > since && r.state !== 'running' && (!r.quiet || r.state === 'failed'),
      )
      .map((r) => ({ ...r, steps: [] }))
    const now = Date.now()
    const modules = new Map(world.shape.modules().map((m) => [m.id, m.name]))
    const coming = agents(world)
      .filter((a) => a.state === 'on')
      .flatMap((a) => {
        const next = nextRun(a.trigger, a.lastRunAt, now)
        if (!next) return []
        const moduleName = modules.get(a.module) ?? ''
        return [{ agent: a.id, name: a.name, module: a.module, moduleName, at: next.toISOString() }]
      })
      .sort((a, b) => a.at.localeCompare(b.at))
    return { since, changed, coming }
  })

  // The person cleared what changed: Today's list starts again from now.
  app.post('/api/today/seen', async () => {
    world.setPreference(user.id, 'seen_at', new Date().toISOString())
    return { ok: true }
  })

  // Activity: agents' runs and connections' reads, newest first. A run that ended having changed
  // nothing is quiet, so the window can fold it.
  function runOut(r: RunRow): RunView {
    const CHANGES = new Set(['landed', 'wrote', 'changed', 'removed', 'told', 'card_opened'])
    const steps = world
      .lines({
        run: r.id,
        kinds: ['run_step', 'told', 'landed', 'wrote', 'changed', 'removed', 'card_opened', 'task'],
      })
      .map((l) => ({ id: l.id, at: l.at, kind: l.kind, words: l.words }))
    return {
      id: r.id,
      kind: 'run',
      name: (r.agent && agents(world).find((a) => a.id === r.agent)?.name) || 'A try',
      module: r.module ? (world.shape.module(r.module)?.name ?? null) : null,
      moduleId: r.module,
      startedAt: r.startedAt,
      ms: r.endedAt ? Date.parse(r.endedAt) - Date.parse(r.startedAt) : null,
      state: r.state,
      words: r.words,
      tokens: r.tokens, // a script's own work uses none; a document read by the model does
      quiet: r.state === 'ok' && !steps.some((st) => CHANGES.has(st.kind)),
      steps,
    }
  }
  const activity = (): RunView[] => {
    const runs: RunView[] = (engine.hands?.runner.runs(100) ?? []).map(runOut)
    const reads: RunView[] = world.lines({ kinds: ['connection_read'], limit: 200 }).map((l) => ({
      id: `read-${l.id}`,
      kind: 'read',
      name: String(l.data.name ?? 'A connection'),
      module: null,
      moduleId: null,
      startedAt: new Date(Date.parse(l.at) - Number(l.data.ms ?? 0)).toISOString(),
      ms: Number(l.data.ms ?? 0),
      state: l.data.state === 'failed' ? 'failed' : 'ok',
      words: l.words,
      tokens: null,
      quiet: l.data.quiet === true,
      steps: [],
    }))
    return [...runs, ...reads].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 200)
  }

  app.post('/api/runs/:id/stop', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    return { stopped: engine.hands?.runner.stop(id) ?? false }
  })

  void app.register(websocket)
  void app.register(async (scope) => {
    scope.get('/ws', { websocket: true }, (socket) => {
      const send = (e: EngineEvent) => {
        if (e.user === user.id) socket.send(JSON.stringify({ ...e, user: undefined }))
      }
      engine.events.on('event', send)
      socket.on('close', () => engine.events.off('event', send))
    })
  })

  if (options.windowDir && existsSync(options.windowDir))
    void app.register(fastifyStatic, { root: options.windowDir, prefix: '/' })

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof z.ZodError)
      return reply.code(400).send({ problem: 'That request is not right.' })
    if (err instanceof Refused) return reply.code(409).send({ problem: err.message })
    reply.code(500).send({ problem: 'Something went wrong in the core.' })
  })

  return app

  function moduleOf(id: string | null): { id: string; name: string } | null {
    const m = id ? world.shape.module(id) : undefined
    return m ? { id: m.id, name: m.name } : null
  }

  function aboutRows(about: unknown): AboutRows | null {
    const a = about as
      | { table: string; rows: string[]; choice?: { field: string; value: string; label: string } }
      | undefined
    const t = a ? world.shape.table(a.table) : undefined
    if (!a || !t) return null
    const field = a.choice ? t.fields.find((f) => f.name === a.choice?.field) : undefined
    const byId = new Map(world.records.list(t.id).map((r) => [r.id, r]))
    return {
      table: t.id,
      rows: a.rows.flatMap((id) => {
        const r = byId.get(id)
        if (!r) return []
        const v = field ? r.values[field.slug] : null
        return [{ id, name: world.rowName(t, r.values), value: typeof v === 'string' ? v : null }]
      }),
      choice: a.choice ?? null,
    }
  }

  function sourceView(p: Provenance): SourceView {
    const at = p.at
    switch (p.kind) {
      case 'stated': {
        const line = p.source.message !== undefined ? world.lineById(p.source.message) : null
        const beside = p.beside
          ? {
              beside: {
                value: p.beside.value,
                words: `Alpha works it out${p.beside.formula ? ` with ${p.beside.formula}` : ''}`,
                ...(p.beside.note ? { note: p.beside.note } : {}),
              },
            }
          : {}
        if (line?.kind === 'set')
          return { kind: 'stated', words: 'You set it in your window', at, ...beside }
        const words = line?.words
        return {
          kind: 'stated',
          words: words
            ? `You said “${words}”`
            : p.source.card
              ? 'You accepted it on a card'
              : 'You said it',
          at,
          ...beside,
        }
      }
      case 'looked_up': {
        if (p.source.file) {
          const f = world.files.findFile(p.source.file)
          return {
            kind: 'looked_up',
            words: `From ${f?.name ?? 'a file'}${p.source.page ? `, page ${p.source.page}` : ''}${p.source.sheet ? `, ${p.source.sheet}` : ''}${p.source.cell ? ` ${p.source.cell}` : ''}`,
            at,
            open: {
              file: f?.hash ?? p.source.file,
              ...(p.source.cell ? { cell: p.source.cell } : {}),
              ...(p.source.sheet ? { sheet: p.source.sheet } : {}),
              ...(p.source.page ? { page: p.source.page } : {}),
              ...(p.source.box ? { box: p.source.box } : {}),
              ...(p.source.line ? { line: p.source.line } : {}),
            },
          }
        }
        const by = p.source.connector?.startsWith('agent:')
          ? `, read by ${p.source.connector.slice('agent:'.length)}`
          : ''
        if (p.source.url)
          return {
            kind: 'looked_up',
            words: `From ${URL.canParse(p.source.url) ? new URL(p.source.url).host : p.source.url}${by}`,
            at,
            open: { url: p.source.url },
          }
        if (p.source.connector === 'kit')
          return {
            kind: 'looked_up',
            words: `Set up by the kit ${p.source.account ?? ''}`.trim(),
            at,
          }
        if (by) return { kind: 'looked_up', words: `Read by ${by.slice(', read by '.length)}`, at }
        return { kind: 'looked_up', words: 'Looked up', at }
      }
      case 'computed':
        return {
          kind: 'computed',
          words: p.source.formula ? `Computed: ${p.source.formula}` : 'Computed from other values',
          at,
          ...(p.source.note ? { note: p.source.note } : {}),
        }
      case 'estimated':
        return { kind: 'estimated', words: `Estimated: ${p.basis ?? ''}`.trim(), at }
      case 'assumed':
        return { kind: 'assumed', words: `Assumed: ${p.basis ?? ''}`.trim(), at }
    }
  }
}

// A row as a person names it: its first text value.
// A cell's column as a number: A is 1, Z 26, AA 27.
function columnOf(cell: string): number {
  let n = 0
  for (const ch of cell.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

function deny(reply: FastifyReply, words: string) {
  return reply.code(403).send({ problem: words })
}

function savedView(v: View): SavedView {
  return { id: v.id, name: v.name, config: v.config, isDefault: v.isDefault, madeBy: v.madeBy }
}

function cardView(c: Card): CardView {
  const input = (c.call?.input ?? {}) as { connector?: unknown; host?: unknown }
  return {
    id: c.id,
    kind: c.kind,
    state: c.state,
    words: c.words,
    detail: c.detail,
    gate: c.gate,
    connector: c.gate === 'sign_in' && typeof input.connector === 'string' ? input.connector : null,
    site:
      c.gate === 'sign_in' && c.call?.tool === 'site_sign_in' && typeof input.host === 'string'
        ? input.host
        : null,
    options: c.options,
    cannotUndo: c.cannotUndo,
    answer: c.answer,
    restsOn: c.restsOn,
    module: c.module,
  }
}

// The window gets words, not the tools' inputs.
function shown(kind: string, data: Record<string, unknown>): Record<string, unknown> {
  if (kind === 'call') return { call: data.call }
  if (kind === 'called') return { call: data.call, ok: data.ok }
  if (kind === 'card_closed') return { state: data.state, answer: data.answer ?? null }
  if (kind === 'made' || kind === 'wrote' || kind === 'shaped') return { table: data.table ?? null }
  return {}
}
