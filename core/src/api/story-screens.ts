// Set up Alpha's own chapters: what each screen shows, drawn at once from state, and what its act
// does. Every count and every "connected" comes from code (the redesign's call 3). A plugin's
// chapters are its own (api/routes/story.ts).
import { z } from 'zod'
import { config } from '../config.ts'
import { tableOf } from '../connectors/places.ts'
import { isClaudeToken } from '../engine/route.ts'
import type { Connection } from '../world/connections.ts'
import { Refused } from '../world/kinds.ts'
import { businessCase } from '../world/shape/manifest.ts'
import { progressOf } from '../world/story.ts'
import {
  nameOfDomain,
  setWorkspace,
  workspaceFor,
  workspaceName,
  workspacePicture,
  workspaceSite,
  workspaceUse,
} from '../world/workspace.ts'
import type { Ctx } from './ctx.ts'
import { connectTiles } from './story-connect.ts'
import type {
  ClaudeScreen,
  ConnectScreen,
  DoneScreen,
  HereScreen,
  PeopleScreen,
  WelcomeScreen,
  WorkspaceScreen,
} from './story-types.ts'

export interface StoryRoom {
  modelSet: () => Promise<boolean>
  onServer: boolean // a server takes Claude as a token; a Mac signs in in the browser
  linkFor: (link: string) => string // a one-time link as the person will open it
  plugins: boolean // a plugin has steps in this person's story (the interview's Off your plate)
}

// The three promises on Hello (call 25), in plain words, no app terms (proposed, Vikas 23 Nov): the
// never-use list in one sentence, no list or switch.
export const PROMISES = [
  'I only look at what you give me permission to.',
  'I never keep anything about banking, health, passwords, legal matters or personal money.',
  'Nothing about you is saved without your approval.',
]

// How to bring an app's data in by hand, where Alpha has no way into it: a browser's history
// exported, anything else exported from its settings; either brought to New module's Import.
export function byHand(app: string): string[] {
  const bring = 'Bring the file to me with New module › Import, and I’ll read it.'
  return /\b(browser|chrome|safari|firefox|edge|brave|opera|arc|dia|vivaldi)\b/i.test(app)
    ? [`In ${app}, open History and export it, or save it from Settings.`, bring]
    : [`In ${app}, look in Settings for Export, and save what it exports.`, bring]
}

export function storyScreens(ctx: Ctx, room: StoryRoom) {
  const { world, engine, user, options, views } = ctx
  const first = () => user.name.split(/\s+/)[0] ?? user.name
  const owner = () => world.users().find((u) => u.role === 'owner')
  const workspace = () => workspaceName(world.db) ?? `${owner()?.name ?? 'The owner'}’s workspace`
  const actor = { kind: 'person' as const, id: user.id }

  // who set a connection up, in words
  const byWords = (k: Connection) => {
    const [kind, id] = k.madeBy.split(/:(.*)/s)
    if (kind !== 'person') return 'Alpha'
    return id === user.id ? 'You' : (world.user(id ?? '')?.name ?? 'Someone')
  }
  // what a connection holds, counted by code: a mail connector's in mails
  const landed = (k: Connection): string[] => {
    const c = engine.connectors?.find(k.connector)
    if (!c) return []
    return c.tables.flatMap((spec) => {
      const t = tableOf(world, c, spec.name)
      if (!t) return []
      const n = world.records.count(t.id)
      return [
        c.manifest.icon === 'mail'
          ? `${n} ${n === 1 ? 'mail' : 'mails'}`
          : `${n} ${n === 1 ? 'row' : 'rows'} in ${t.name}`,
      ]
    })
  }
  const connections = () =>
    world.connections
      .list()
      .filter((k) => k.state !== 'waiting' || k.madeBy === `person:${user.id}`)
      .map((k) => ({
        id: k.id,
        title: engine.connectors?.find(k.connector)?.manifest.title ?? k.connector,
        account: k.account,
        state: k.state,
        by: byWords(k),
        landed: landed(k),
      }))
  const others = () => world.accounts.list().filter((a) => a.role !== 'owner')

  // The site guessed from the person's own email's domain, never a mail provider's (call 20).
  const guess = (): string | null => {
    const services = new Set(config.people().mail_services.map((s) => s.toLowerCase()))
    const mine = world.accounts.list().find((a) => a.id === user.id)?.email
    const theirs = world.connections
      .list()
      .filter((k) => k.madeBy === `person:${user.id}`)
      .map((k) => k.account)
    for (const address of [mine, ...theirs]) {
      const domain = address?.includes('@') ? address.split('@')[1]?.toLowerCase() : null
      if (domain && domain.includes('.') && !services.has(domain)) return domain
    }
    return null
  }

  // Your accounts: the accounts, and, once a computer is paired, what Alpha Bridge found on it, each
  // with Connect where Alpha has a way in, else how to bring it by hand, and Exclude (Vikas, 23
  // Nov: "I want to see that dynamic generation"). Nothing about turning a reader on: with no
  // computer paired, or nothing found on it, the part is not there.
  const accounts = () => {
    const tiles = connectTiles(ctx, room.onServer)
    const paired = world.computers.of(user.id).length > 0
    const found = tiles
      .filter((t) => t.kind === 'apps')
      .map((t) => ({
        ...t,
        title: 'Found on your computer',
        reads: 'The apps Alpha Bridge found you use',
        note: 'Connect the ones I have a way into; for the others, here is how to bring me their data.',
        reader: null, // never "turn it on" here: the list shows only once there is one
        apps: t.apps
          .filter((a) => a.times !== null || a.last !== null)
          .map((a) => (a.connector || a.site ? a : { ...a, how: byHand(a.name) })),
      }))
      .filter((t) => paired && t.apps.length)
    return [...tiles.filter((t) => t.kind === 'connector' || t.kind === 'calendar'), ...found]
  }

  const screens = {
    welcome: async (): Promise<WelcomeScreen> =>
      user.role === 'owner'
        ? {
            key: 'welcome',
            title: 'Welcome',
            says: `Hi ${first()}, I’m Alpha. I’m here to take the repetitive work off your plate.`,
            promises: PROMISES,
            workspace: null,
            addedBy: null,
          }
        : {
            key: 'welcome',
            title: 'Welcome',
            says: `Hi ${first()}, welcome to ${workspace()}. ${owner()?.name ?? 'The owner'} invited you.`,
            promises: PROMISES,
            workspace: workspace(),
            addedBy: owner()?.name ?? null,
          },
    claude: async (): Promise<ClaudeScreen> => ({
      key: 'claude',
      title: 'Claude',
      says: 'Now let me connect to Claude, the mind I think with.',
      // one way on this Mac and online alike: the code Claude Code prints, pasted (Vikas, 23 Nov)
      how: 'token',
      set: await room.modelSet(),
      steps: [
        'Install Claude Code on your computer, then run this in Terminal:',
        'Sign in with the Claude account whose plan I should use.',
        'It prints a code starting sk-ant-: paste it here. I keep it sealed.',
      ],
      command: 'claude setup-token',
    }),
    workspace: async (): Promise<WorkspaceScreen> => ({
      key: 'workspace',
      title: 'About you',
      says: 'First, a little about you.',
      name: workspaceName(world.db),
      // the name guessed from the person's own mail domain, shown to change, never an empty box
      suggested: (() => {
        const g = guess()
        return g ? nameOfDomain(g) : null
      })(),
      picture: !!workspacePicture(world.db),
      for: workspaceFor(world.db),
      use: workspaceUse(world.db),
      site: workspaceSite(world.db),
      guess: guess(),
    }),
    // the computer's tile on a step of its own before the accounts, so the apps Alpha Bridge
    // finds on it are there to offer next
    computer: async (): Promise<ConnectScreen> => ({
      key: 'computer',
      title: 'Your computer',
      says: 'Shall I connect to your computer too? Only Alpha Bridge, nothing else yet.',
      // only what this step needs: installing and pairing Alpha Bridge (or lending a folder on
      // Alpha's own Mac); what else it can read is offered later, one at a time, never here
      tiles: connectTiles(ctx, room.onServer)
        .filter((t) => t.kind === 'computer')
        .map((t) => ({
          ...t,
          note: room.onServer
            ? 'Install Alpha Bridge and pair it. Nothing else on your computer is read now.'
            : t.note,
        })),
    }),
    connect: async (): Promise<ConnectScreen> => ({
      key: 'connect',
      title: 'Your accounts',
      says: 'Where does your work happen? Connect what you’d like me to read.',
      tiles: accounts(),
    }),
    people: async (): Promise<PeopleScreen> => ({
      key: 'people',
      title: 'Invite team',
      says: 'Who else works with you?',
      people: others().map((a) => ({ id: a.id, name: a.name, email: a.email, state: a.state })),
      sees: 'Each one opens their link, chooses a password, then goes through a shorter setup of their own: what is here, and connecting their own mail and calendar.',
    }),
    here: async (): Promise<HereScreen> => ({
      key: 'here',
      title: 'What’s here',
      says:
        views.summaries().length || world.agents.list().length
          ? `Here’s what ${workspace()} already has.`
          : `Here’s who is in ${workspace()}.`,
      workspace: workspace(),
      modules: views.summaries().map((m) => {
        const made = world.shape.module(m.id)
        return { name: m.name, line: (made && businessCase(made)?.for) ?? null }
      }),
      agents: world.agents.list().map((a) => ({ name: a.name, title: a.title })),
      people: world
        .users()
        .filter((u) => u.id !== user.id)
        .map((u) => u.name),
      // only what is true today: the tables are everyone's here (call 23)
      shared:
        'The tables here are everyone’s: what you add, everyone here can see, and what they add, you can.',
    }),
    done: async (): Promise<DoneScreen> => {
      // a plugin offered what to build only if one of its steps was gone through, not passed by
      const offered =
        room.plugins &&
        (options.chapters ?? []).some(
          (c) => progressOf(world.db, user.id).chapters[c.key] === 'done',
        )
      const connected = connections()
        .filter((k) => k.state === 'connected')
        .map((k) => `${k.title}, ${k.account}${k.landed.length ? `: ${k.landed.join(', ')}` : ''}`)
      return {
        key: 'done',
        title: 'Done',
        says: connected.length
          ? 'You’re all set. Here’s what I’m working with.'
          : offered
            ? 'You’re all set.'
            : 'You’re all set. Here’s what I could take off your plate.',
        connected,
        people: user.role === 'owner' ? others().map((a) => a.name) : [],
        // said plainly where nothing is connected: what Alpha waits on
        none: connected.length
          ? ''
          : user.role === 'owner'
            ? 'Nothing is connected yet, so I’ll wait for you. Connect your mail or calendar any time in Settings.'
            : 'Nothing of yours is connected yet. Connect your mail or calendar any time in Settings.',
        // without the interview's offer of what to build, one box for something they repeat
        repeat: !offered,
      }
    },
  }

  // What each act does with what the person gave; the story moves on after it.
  // nothing: nothing happened on the step, so it is marked skipped, never done
  const acts: Record<string, (body: unknown) => Promise<Record<string, unknown>>> = {
    computer: async () => ({
      nothing:
        !world.computers.of(user.id).length &&
        !world.connections
          .list()
          .some((k) => k.connector === 'folder' && k.madeBy === `person:${user.id}`),
    }),
    connect: async () => ({
      nothing: !world.connections
        .list()
        .some((k) => k.connector !== 'folder' && k.madeBy === `person:${user.id}`),
    }),
    claude: async (body) => {
      const b = z.object({ token: z.string().max(400).optional() }).parse(body ?? {})
      const route = engine.route
      if (!route) throw new Refused('The route is not set up in this core.')
      if (b.token === undefined) {
        if (await room.modelSet()) return {}
        throw new Refused('Paste the code claude setup-token printed.')
      }
      const token = b.token.trim()
      if (!isClaudeToken(token))
        throw new Refused('That is not a Claude code: it starts with sk-ant-.')
      // the live check: Claude answered with this token before it is kept (call 7)
      const why = options.claudeAnswers ? await options.claudeAnswers(token) : null
      if (why) throw new Refused(`Claude did not answer with that token: ${why}`)
      await route.setToken(token, user.id)
      if (route.name === 'key' && !route.hasKey) await route.set('subscription', null, user.id)
      engine.rerouted()
      ctx.live()
      return { answered: true }
    },
    workspace: async (body) => {
      const b = z
        .object({
          name: z.string().max(200).nullable().optional(),
          picture: z.string().max(200_000).nullable().optional(),
          for: z.string().max(1000).nullable().optional(),
          site: z.string().max(400).nullable().optional(),
          use: z.enum(['business', 'personal']).nullable().optional(),
        })
        .parse(body ?? {})
      setWorkspace(world.db, b, actor)
      ctx.live()
      return {}
    },
    people: async (body) => {
      const b = z
        .object({
          add: z
            .array(z.object({ name: z.string().max(200), email: z.string().max(320) }))
            .max(50)
            .default([]),
        })
        .parse(body ?? {})
      // Alpha sends no mail: each person's one-time link, for the owner to copy (call 22)
      const links = b.add.map((p) => {
        const made = world.accounts.add(p.name, p.email, ctx.asPerson)
        return { name: p.name, link: room.linkFor(made.link) }
      })
      return { links, nothing: !others().length }
    },
  }

  // What happened on a step gone through, in a few words, for its folded line.
  const many = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`
  const summary = (key: string): string | null => {
    const mine = world.connections.list().filter((k) => k.madeBy === `person:${user.id}`)
    if (key === 'workspace') {
      const use = workspaceUse(world.db)
      return (
        [workspaceName(world.db), use && (use === 'business' ? 'Business' : 'Personal')]
          .filter(Boolean)
          .join(' · ') || null
      )
    }
    if (key === 'claude') return 'Connected'
    if (key === 'computer') {
      const paired = world.computers.of(user.id)
      return paired.length ? paired.map((c) => c.name).join(', ') : 'Folders lent'
    }
    if (key === 'connect')
      return many(mine.filter((k) => k.connector !== 'folder').length, 'account', 'accounts')
    if (key === 'people') return `${many(others().length, 'person', 'people')} invited`
    return null
  }

  return { screens, acts, summary }
}
