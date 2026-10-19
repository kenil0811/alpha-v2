import Fastify, { type FastifyInstance } from 'fastify'
import type { Health } from './types.ts'

export const VERSION = '0.0.0'

export function buildServer(): FastifyInstance {
  const app = Fastify()
  app.get('/api/health', async (): Promise<Health> => ({ ok: true, version: VERSION }))
  return app
}
