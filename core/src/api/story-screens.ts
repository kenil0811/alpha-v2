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
}

// The three promises on Hello (call 25), in plain words, no app terms (proposed, Vikas 23 Nov): the
// never-use list in one sentence, no list or switch.
export const PROMISES = [
  'I only look at what you give me permission to.',
  'I never keep anything about banking, health, passwords, legal matters or personal money.',
  'Nothing about you is saved without your approval.',
]

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
      how: room.onServer ? 'token' : 'signin',
      set: await room.modelSet(),
      steps: room.onServer
        ? [
            'On your own computer, install Claude Code, then run this in Terminal:',
            'Sign in with the Claude account whose plan I should use.',
            'It prints a token starting sk-ant-: paste it here. I keep it sealed on this server.',
          ]
        : [
            'Press Sign in and finish with the Claude account whose plan I should use, then come back here.',
          ],
      command: room.onServer ? 'claude setup-token' : null,
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
      says: 'Shall I look at your computer too? Only what you choose.',
      tiles: connectTiles(ctx, room.onServer).filter((t) => t.kind === 'computer'),
    }),
    connect: async (): Promise<ConnectScreen> => ({
      key: 'connect',
      title: 'Your accounts',
      says: 'Where does your work happen? Connect what you’d like me to read.',
      tiles: connectTiles(ctx, room.onServer).filter((t) => t.kind !== 'computer'),
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
      const connected = connections()
        .filter((k) => k.state === 'connected')
        .map((k) => `${k.title}, ${k.account}${k.landed.length ? `: ${k.landed.join(', ')}` : ''}`)
      return {
        key: 'done',
        title: 'Done',
        says: connected.length
          ? 'I’m ready. Here’s where I’ll start.'
          : 'I’m ready. I’ll start with what you connect.',
        connected,
        people: user.role === 'owner' ? others().map((a) => a.name) : [],
        none:
          user.role === 'owner'
            ? 'You can connect things and add people any time in Settings.'
            : 'You can connect your own any time in Settings.',
      }
    },
  }

  // What each act does with what the person gave; the story moves on after it.
  const acts: Record<string, (body: unknown) => Promise<Record<string, unknown>>> = {
    claude: async (body) => {
      const b = z.object({ token: z.string().max(400).optional() }).parse(body ?? {})
      const route = engine.route
      if (!route) throw new Refused('The route is not set up in this core.')
      if (!room.onServer || b.token === undefined) {
        if (await room.modelSet()) return {}
        throw new Refused(
          room.onServer
            ? 'Paste the token claude setup-token printed.'
            : 'Claude is not signed in yet: press Sign in, finish in your browser, then Continue.',
        )
      }
      const token = b.token.trim()
      if (!isClaudeToken(token))
        throw new Refused('That is not a Claude token: it starts with sk-ant-.')
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
      return { links }
    },
  }

  return { screens, acts }
}
