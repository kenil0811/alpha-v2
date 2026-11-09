// Who is asking, on an Alpha that asks people to sign in (docs/rules.md, A6): tried through the
// core's own routes, each case on a server whose people have real sessions.
import { buildServer } from '../api/server.ts'
import { writeRoutes } from './check.ts'
import { rule } from './rule.ts'
import type { RuleWorld } from './world.ts'

const BASE = { host: '127.0.0.1:4700' }
const PASSWORD = 'correct horse battery'

// the rule world's core, now asking people to sign in, with its owner and a member signed in
async function people(w: RuleWorld) {
  const app = buildServer({
    engine: w.engine,
    user: w.user,
    token: 'rule-token',
    ports: [4700],
    signIn: { days: 30 },
  })
  await app.ready()
  const inAs = async (token: string, email?: string) => {
    const out = await app.inject({
      method: 'POST',
      url: '/api/session/link',
      headers: BASE,
      payload: { token, password: PASSWORD, ...(email ? { email } : {}) },
    })
    return { ...BASE, cookie: String(out.headers['set-cookie']).split(';')[0] as string }
  }
  const owner = await inAs(w.world.accounts.ownerLink(w.user) as string, 'kenil@example.com')
  const made = w.world.accounts.add('Priya', 'priya@example.com', {
    actor: { kind: 'person', id: w.user.id },
    user: w.user.id,
  })
  const member = await inAs(made.link)
  return { app, owner, member, memberId: made.id }
}

rule('A6', 'every request carries a session, and a person’s own stays theirs', {
  cases: {
    'no session: every route that writes is turned away': async (w) => {
      const { app } = await people(w)
      const open = new Set(['/api/session', '/api/session/link', '/api/sign-in/back'])
      for (const r of writeRoutes()) {
        const [method, path] = r.split(' ') as [string, string]
        if (open.has(path)) continue
        const url = path.replace(/:[a-z]+/g, 'x').replace(/\*/g, 'x')
        const out = await app.inject({
          method: method as 'POST',
          url,
          headers: BASE,
          payload: {},
        })
        if (out.statusCode !== 401) return false
      }
      return (await app.inject({ url: '/api/me', headers: BASE })).statusCode === 401
    },
    'the install’s token does not open the window': async (w) => {
      const { app } = await people(w)
      const headers = { ...BASE, 'x-alpha-token': 'rule-token' }
      return (await app.inject({ url: '/api/me', headers })).statusCode === 401
    },
    'the alpha command acts as the owner': async (w) => {
      const { app } = await people(w)
      const headers = { ...BASE, 'x-alpha-token': 'rule-token', 'x-alpha-cli': '1' }
      const me = await app.inject({ url: '/api/me', headers })
      return me.json().user.id === w.user.id
    },
    'each request is the person who asked': async (w) => {
      const { app, owner, member, memberId } = await people(w)
      const as = async (headers: Record<string, string>) =>
        (await app.inject({ url: '/api/me', headers })).json().user
      const [a, b] = await Promise.all([as(owner), as(member)])
      return a.id === w.user.id && a.role === 'owner' && b.id === memberId && b.role === 'member'
    },
    'one person’s conversation is not another’s': async (w) => {
      const { app, owner, member } = await people(w)
      w.world.line({
        actor: { kind: 'person', id: w.user.id },
        kind: 'said',
        words: 'What is my margin?',
        user: w.user.id,
      })
      const said = async (headers: Record<string, string>) =>
        (await app.inject({ url: '/api/stream', headers }))
          .json()
          .lines.map((l: { words: string }) => l.words)
      return (
        (await said(owner)).includes('What is my margin?') &&
        !(await said(member)).includes('What is my margin?')
      )
    },
    'one person’s card is not another’s to read or answer': async (w) => {
      const { app, member } = await people(w)
      const card = w.world.cards.open({
        kind: 'question',
        words: 'Which one?',
        options: ['This', 'That'],
        actor: { kind: 'alpha' },
        user: w.user.id,
      })
      const read = await app.inject({ url: `/api/cards/${card.id}`, headers: member })
      const answer = await app.inject({
        method: 'POST',
        url: `/api/cards/${card.id}`,
        headers: member,
        payload: { answer: 'This' },
      })
      return (
        read.statusCode === 404 &&
        answer.statusCode === 404 &&
        w.world.cards.get(card.id)?.state === 'waiting'
      )
    },
    'only the owner sets the model and the data, adds people, installs a pack': async (w) => {
      const { app, member } = await people(w)
      for (const [method, url, payload] of [
        ['POST', '/api/model', { route: 'subscription' }],
        ['POST', '/api/accounts', { name: 'Sam', email: 'sam@example.com' }],
        ['POST', '/api/kits', { folder: '/nowhere' }],
      ] as const) {
        const out = await app.inject({ method, url, headers: member, payload })
        if (out.statusCode !== 409 || !/Only the owner/.test(out.json().problem)) return false
      }
      return (await app.inject({ url: '/api/accounts', headers: member })).statusCode === 409
    },
  },
})
