// A person's computer (docs/rules.md, B1 and B2): a connection on a computer acts only as its
// person, and what a computer lends is said there, never in Alpha. Tried on the rule world with a
// made-up desk connector that runs only on a person's computer and a computer paired with a test
// key; nothing reaches a real computer.
import { createPrivateKey, sign } from 'node:crypto'
import { Children } from '@alpha/bridge/children'
import { newKey } from '@alpha/bridge/keys'
import { type Connector, MemorySecrets } from '@alpha/connector-sdk'
import { Hub } from '../bridge/hub.ts'
import { lend } from '../connectors/computers.ts'
import { ConnectorService } from '../connectors/service.ts'
import { Gatekeeper } from '../engine/gate.ts'
import { refusal, rule } from './rule.ts'
import type { RuleWorld } from './world.ts'

// A made-up connector of a person's own computer, with one read.
const DESK = {
  manifest: {
    name: 'desk',
    title: 'Desk',
    auth: 'path',
    account: { label: 'Folder' },
    pace: { perMinute: 60 },
    runs: 'either',
  },
  guide: 'A folder on the person’s own computer.',
  module: 'Desk',
  tables: [],
  tools: {
    list: {
      description: 'What is in the folder',
      input: {},
      effect: 'read',
      run: async () => ['pl.csv'],
    },
  },
} as unknown as Connector
const FOLDER = '/Users/kenil/Exports'

// The rule world as a server's core, the owner's computer paired and lending a folder, and a
// second person who may sign in.
async function lent(w: RuleWorld) {
  const service = new ConnectorService(w.world, {
    secrets: new MemorySecrets(),
    known: [DESK],
    server: true,
  })
  const pc = w.world.computers.pair(w.world.computers.link(w.user.id).code, {
    publicKey: newKey().publicPem,
    name: 'Kenil’s Mac',
    platform: 'darwin',
  })
  const conn = await lend(service, w.world, pc, 'desk', FOLDER)
  const made = w.world.accounts.add('Priya', 'priya@example.com', {
    actor: { kind: 'person', id: w.user.id },
    user: w.user.id,
  })
  const priya = w.world.user(made.id)
  if (!priya) throw new Error('The rule world did not add Priya.')
  const gateOf = (who: typeof priya) =>
    new Gatekeeper(w.world, w.here, who, { connectors: service })
  return { service, conn, priya, gateOf }
}

const call = { callId: 'c1', subagent: null }

rule('B1', 'a computer acts only as its person', {
  cases: {
    'another person’s turn is refused at the gate, in words that name the computer': async (w) => {
      const { priya, gateOf } = await lent(w)
      const theirs = await gateOf(priya).before('mcp__desk__list', {}, call)
      const own = await gateOf(w.user).before('mcp__desk__list', {}, call)
      return !theirs.allow && /Kenil’s Mac/.test(theirs.reason ?? '') && own.allow
    },
    'a script run for no one, or for someone else, cannot read through it': async (w) => {
      const { service, conn, priya } = await lent(w)
      const firm = await refusal(() => service.readThrough(conn.id, 'list', {}, null))
      const other = await refusal(() => service.readThrough(conn.id, 'list', {}, priya.id))
      const own = await service.readThrough(conn.id, 'list', {}, w.user.id)
      return (
        /acts only for its own person/.test(firm ?? '') &&
        /acts only for its own person/.test(other ?? '') &&
        JSON.stringify(own) === '["pl.csv"]'
      )
    },
  },
})

rule('B2', 'what a computer lends is said on the computer', {
  cases: {
    'Alpha’s own form never names a folder on a person’s computer': async (w) => {
      const { service } = await lent(w)
      const said = await refusal(() => service.connect('desk', '/etc', null, w.user.id))
      return /lend it from the Bridge/.test(said ?? '') && !w.world.connections.find('desk', '/etc')
    },
    'Lend a folder in Alpha only asks the computer: nothing is lent until its person picks there':
      async (w) => {
        const key = newKey()
        const pc = w.world.computers.pair(w.world.computers.link(w.user.id).code, {
          publicKey: key.publicPem,
          name: 'Kenil’s Mac',
          platform: 'darwin',
        })
        const hub = new Hub()
        hub.use(w.world, {
          notify: () => undefined,
          lend: async () => undefined,
          unlend: () => undefined,
          signedOut: () => undefined,
          back: () => undefined,
          sitesOn: () => [],
          offers: () => [],
        })
        const sent: Record<string, unknown>[] = []
        const door = hub.open({
          send: (t) => sent.push(JSON.parse(t)),
          close: () => undefined,
        })
        const challenge = String(sent[0]?.challenge)
        const signature = sign(null, Buffer.from(challenge), createPrivateKey(key.privatePem))
        door.heard(
          JSON.stringify({
            t: 'hello',
            computer: pc.id,
            signature: signature.toString('base64'),
            version: 'test',
          }),
        )
        const asked = hub.pick(pc.id, 'folder')
        return (
          asked &&
          sent.some((m) => m.t === 'pick' && m.connector === 'folder') &&
          w.world.connections.on(pc.id).length === 0
        )
      },
    'the Bridge refuses a call for what it does not lend, whatever Alpha sends': async () => {
      const up: Record<string, unknown>[] = []
      const children = new Children(
        async () => {
          throw new Error('Nothing is started for a call that is refused.')
        },
        {
          up: (m) => up.push(m),
          lent: (connector, account) => connector === 'folder' && account === FOLDER,
          lends: () => [FOLDER],
          reads: () => [FOLDER],
          said: () => undefined,
        },
      )
      const req = (id: number, account: string) =>
        JSON.stringify({ t: 'req', id, op: 'sync', name: 'folder', account })
      children.down('folder', req(1, '/Users/kenil'))
      children.down('folder', req(2, `${FOLDER}/../Private`))
      await new Promise((r) => setTimeout(r, 20))
      const answers = up.map((m) => JSON.parse(String(m.line)) as Record<string, unknown>)
      return (
        answers.length === 2 &&
        answers.every(
          (a) => a.t === 'res' && (a.error as { kind?: string } | undefined)?.kind === 'blocked',
        )
      )
    },
  },
})
