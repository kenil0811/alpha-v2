// The window's own routes for a journey, in this process: one server per person, as the owner or
// as a member by name, built as on a server, where people sign in, so the owner has Your people to
// go through. A step reaches them as the window on this machine does, with the journey's token, and
// as the alpha command does, so the person a server was built for is the one asking.
import { buildServer } from '../api/server.ts'
import { answersWith } from '../engine/ask.ts'
import type { Engine } from '../engine/engine.ts'
import type { Plugins } from '../plugins/plugins.ts'
import type { User, World } from '../world/world.ts'
import { personNamed } from './story-steps.ts'

export const AS_WINDOW = {
  host: '127.0.0.1:4700',
  'x-alpha-token': 'journey',
  'x-alpha-cli': '1',
}

export function pagesFor(engine: Engine, world: World, owner: User, plugins: Plugins) {
  const served = new Map<string, ReturnType<typeof buildServer>>()
  const page = (as?: string) => {
    const who = personNamed(world, owner, as)
    const made =
      served.get(who.id) ??
      buildServer({
        engine,
        user: who,
        token: 'journey',
        ports: [4700],
        signIn: { days: 1 },
        plugins: plugins.routes,
        pluginsOn: plugins.on(),
        chapters: plugins.chapters,
        claudeAnswers: (given) => answersWith(world.paths.dir, given),
      })
    served.set(who.id, made)
    return made
  }
  const close = async () => {
    for (const a of served.values()) await a.close()
  }
  return { page, close }
}
