// Set up Alpha's routes, each about whoever is asking: where their story stands, a chapter's
// screen, its act and its Skip, Decline (Home's row goes) and Reopen (from the workspace tile's
// menu). A chapter is acted on only once the ones before it are gone through or skipped; every one
// but Hello and Done can be skipped, Claude too (proposed, Vikas 23 Nov).
import { z } from 'zod'
import { Refused } from '../../world/kinds.ts'
import {
  declineStory,
  finishStory,
  leaveAppOut,
  markChapter,
  progressOf,
  reopenStory,
} from '../../world/story.ts'
import type { Ctx } from '../ctx.ts'
import { type Chapter, chaptersOf, storyView } from '../story.ts'
import { storyScreens } from '../story-screens.ts'
import type { ChapterScreen, StoryView } from '../story-types.ts'
import { watchAfterSetup } from './observe.ts'

// Whether Claude's own sign-in on this Mac holds, asked of Claude Code at most this often: it
// starts a process each time.
const SIGNED_IN_MS = 10_000
// the chapters that set what only the owner sets
const OWNERS = ['workspace', 'people']

export function registerStory(ctx: Ctx): void {
  const { app, world, engine, user, options } = ctx
  const onServer = !options.setup || options.platform?.name === 'linux'
  let signedIn: { at: number; yes: Promise<boolean> } | null = null
  const macSignedIn = (): Promise<boolean> => {
    const setup = options.setup
    if (!setup) return Promise.resolve(false)
    if (!signedIn || Date.now() - signedIn.at > SIGNED_IN_MS)
      signedIn = {
        at: Date.now(),
        yes: setup.view().then(
          (v) => v.claude.signedIn,
          () => false,
        ),
      }
    return signedIn.yes
  }
  // Alpha reaches Claude: an API key on the key route, else a token, else Claude's sign-in here
  const modelSet = async (): Promise<boolean> => {
    const route = engine.route
    if (!route) return true // a core with no route (tests) reaches Claude its own way
    if (route.name === 'key') return route.hasKey
    if (route.hasToken) return true
    return !onServer && (await macSignedIn())
  }
  // what the chapters' screens and acts are given, a one-time link at this Alpha's own address
  const room = (req: { protocol: string; headers: { host?: string | undefined } }) => ({
    modelSet,
    onServer,
    plugins: (options.chapters ?? []).some((c) => c.who === 'everyone' || user.role === 'owner'),
    linkFor: (link: string) =>
      `${options.publicAddress ?? `${req.protocol}://${req.headers.host}`}/?link=${encodeURIComponent(link)}`,
  })

  const chapters = async (): Promise<Chapter[]> =>
    chaptersOf({
      owner: user.role === 'owner',
      modelSet: await modelSet(),
      people: !!options.signIn,
      plugins: options.chapters ?? [],
      progress: progressOf(world.db, user.id),
    })
  const view = async (): Promise<StoryView> =>
    storyView(
      await chapters(),
      progressOf(world.db, user.id),
      storyScreens(ctx, room({ protocol: 'http', headers: {} })).summary,
    )
  // a chapter of the person's story, which they may act on: one gone through, or the one they are on
  const reachable = async (key: string): Promise<Chapter> => {
    // the workspace and who may sign in are the owner's alone (rules A6)
    if (OWNERS.includes(key) && user.role !== 'owner')
      throw new Refused('Only the owner can do that.')
    const list = await chapters()
    const at = list.findIndex((c) => c.key === key)
    const chapter = list[at]
    if (!chapter) throw new Refused('That chapter is not in your setup.')
    const v = storyView(list, progressOf(world.db, user.id))
    const now = list.findIndex((c) => c.key === v.at)
    if (now >= 0 && at > now)
      throw new Refused(`Go through ${list[now]?.title ?? 'the chapter before'} first.`)
    return chapter
  }
  const input = (req: { body: unknown; query: unknown }) => ({
    params: {},
    query: (req.query ?? {}) as Record<string, string>,
    body: req.body,
    person: { id: user.id, name: user.name, owner: user.role === 'owner' },
  })
  // the chapter gone through: Done finishes the story
  const through = (key: string, how: 'done' | 'skipped') => {
    markChapter(world.db, user.id, key, how)
    if (key === 'done') {
      finishStory(world.db, user.id)
      // watching their work: only past its wall (23 Nov, proposed)
      watchAfterSetup(world, user)
    }
    ctx.live()
  }

  app.get('/api/story', async (): Promise<StoryView> => view())

  app.post('/api/story/decline', async (): Promise<StoryView> => {
    declineStory(world.db, user.id)
    ctx.live()
    return view()
  })

  app.post('/api/story/reopen', async (): Promise<StoryView> => {
    reopenStory(world.db, user.id)
    ctx.live()
    return view()
  })

  // an app left out of Connect's Apps you use, for good
  app.post('/api/story/apps/remove', async (req) => {
    const { name } = z.object({ name: z.string().trim().min(1).max(200) }).parse(req.body)
    leaveAppOut(world.db, user.id, name)
    return { ok: true }
  })

  app.get('/api/story/:chapter', async (req): Promise<ChapterScreen> => {
    const { chapter: key } = z.object({ chapter: z.string().max(60) }).parse(req.params)
    const chapter = (await chapters()).find((c) => c.key === key)
    if (!chapter) throw new Refused('That chapter is not in your setup.')
    const { screens } = storyScreens(ctx, room(req))
    if (chapter.plugin) {
      const screen = await chapter.plugin.screen(input(req))
      return {
        ...screen,
        key: chapter.key,
        title: chapter.title,
        says: screen.says ?? '',
        plugin: chapter.plugin.plugin,
      }
    }
    const draw = screens[key as keyof typeof screens]
    if (!draw) throw new Refused('That chapter is not in your setup.')
    return draw()
  })

  app.post('/api/story/:chapter', async (req) => {
    const { chapter: key } = z.object({ chapter: z.string().max(60) }).parse(req.params)
    const chapter = await reachable(key)
    if (chapter.plugin) {
      const { nothing, ...out } = await chapter.plugin.act(input(req))
      if (out.on) through(key, nothing ? 'skipped' : 'done')
      return { ...out, story: await view() }
    }
    const { acts } = storyScreens(ctx, room(req))
    // a step on which nothing happened is skipped, never ticked done
    const { nothing, ...out } = (await acts[key]?.(req.body)) ?? {}
    through(key, nothing ? 'skipped' : 'done')
    return { ...out, story: await view() }
  })

  app.post('/api/story/:chapter/skip', async (req) => {
    const { chapter: key } = z.object({ chapter: z.string().max(60) }).parse(req.params)
    await reachable(key)
    if (key === 'welcome') throw new Refused('Hello has nothing to skip: press Start.')
    // nothing is compulsory, Claude included: its step says what waits on it (proposed, Vikas
    // 23 Nov, reversing call 5)
    through(key, 'skipped')
    return { story: await view() }
  })
}
