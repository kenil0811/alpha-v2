import { describe, expect, it } from 'vitest'
import { buildServer, VERSION } from './server.ts'

describe('the api', () => {
  it('answers its health check', async () => {
    const app = buildServer()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, version: VERSION })
    await app.close()
  })
})
