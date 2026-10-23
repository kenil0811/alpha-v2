// What every route file is given (decision 12, step 4): the app, the world, the engine, the person
// and the options, with the helpers they share.
import type { FastifyInstance } from 'fastify'
import type { Engine } from '../engine/engine.ts'
import type { User } from '../world/world.ts'
import type { ServerOptions } from './server.ts'
import type { makeViews } from './views.ts'

export interface BaseCtx {
  app: FastifyInstance
  world: Engine['world']
  engine: Engine
  user: User
  options: ServerOptions
  person: { kind: 'person'; id: string }
  live: () => void
  asPerson: { actor: { kind: 'person'; id: string }; user: string }
  // a connection's connector, as the loaded set describes it
  connectorOf: (name: string) => import('@alpha/connector-sdk').Connector
}

export interface Ctx extends BaseCtx {
  views: ReturnType<typeof makeViews>
}
