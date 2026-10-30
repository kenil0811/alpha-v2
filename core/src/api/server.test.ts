import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { MAINTAINED_SHAPE } from '../engine/tools/index.ts'
import { DEFAULT_KITS, keepDefaults } from '../modules/defaults.ts'
import { loadPool, pending, ranked, refresh } from '../modules/interview.ts'
import { install } from '../modules/kits/index.ts'
import { World } from '../world/world.ts'
import { buildServer, VERSION } from './server.ts'
import type { CardAbout, InterviewView, Stream, TableView } from './types.ts'

describe('the api', () => {
  it('answers its health check', async () => {
    const app = buildServer()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, version: VERSION, build: null })
    await app.close()
  })
})

describe('the api over a world', () => {
  let home: string
  let world: World
  let engine: Engine
  const token = 'secret-token'
  const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }

  beforeEach(async () => {
    home = mkdtempSync(join(tmpdir(), 'alpha-api-'))
    world = await World.open(join(home, 'tenants', 't_test'))
    engine = new Engine(world)
  })

  afterEach(() => {
    engine.close()
    world.close()
    rmSync(home, { recursive: true, force: true })
  })

  const app = () => buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700, 4701] })

  it('gives the Mac app the reminders and cards since it last asked, each with its place', async () => {
    const shell = { seen: 0 }
    const a = buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700], shell })
    const ask = async (after?: number) =>
      (
        await a.inject({
          url: `/api/notices${after === undefined ? '' : `?after=${after}`}`,
          headers: ok,
        })
      ).json() as { last: number; notices: { title: string; body: string; open: string }[] }
    const start = await ask()
    expect(start.notices).toEqual([]) // nothing old comes back
    expect(shell.seen).toBeGreaterThan(0)
    const me = world.owner('Kenil')
    const person = { actor: { kind: 'person' as const, id: me.id }, user: me.id }
    const t = world.tasks.add(
      { title: 'Call Sam', remindAt: new Date(Date.now() - 1000).toISOString() },
      person,
    )
    world.tasks.tick(Date.now(), { actor: { kind: 'system' }, user: me.id }, () => undefined)
    world.cards.open({
      kind: 'question',
      words: 'Which deal first?',
      actor: { kind: 'alpha' },
      user: me.id,
    })
    const next = await ask(start.last)
    expect(next.notices.map((n) => [n.title, n.body, n.open])).toEqual([
      ['Reminder', 'Call Sam', `#/tasks/${t.id}`],
      ['Needs you', 'Which deal first?', '#/'],
    ])
    expect((await ask(next.last)).notices).toEqual([])
    await a.close()
  })

  it('turns away a request without the token, from another host or from another page', async () => {
    const a = app()
    expect(
      (await a.inject({ url: '/api/me', headers: { host: '127.0.0.1:4700' } })).statusCode,
    ).toBe(403)
    expect(
      (await a.inject({ url: '/api/me', headers: { ...ok, host: 'evil.example:4700' } }))
        .statusCode,
    ).toBe(403)
    expect(
      (await a.inject({ url: '/api/me', headers: { ...ok, origin: 'https://evil.example' } }))
        .statusCode,
    ).toBe(403)
    const me = await a.inject({
      url: '/api/me',
      headers: { ...ok, origin: 'http://127.0.0.1:4701' },
    })
    expect(me.statusCode).toBe(200)
    expect(me.json().user.name).toBe('Kenil')
    // an encoded spelling of the address reaches the same route and meets the same check
    for (const url of ['/%61pi/me', '/%77s', '/api/%6de', '/%61pi/kits/pack'])
      expect(
        (
          await a.inject({
            url,
            method: url.endsWith('pack') ? 'POST' : 'GET',
            headers: { host: '127.0.0.1:4700' },
          })
        ).statusCode,
        url,
      ).toBe(403)
    await a.close()
  })

  it('shows a stored file inline only when it is harmless, HTML in a sandbox, the rest as a download', async () => {
    const a = app()
    const person = { actor: { kind: 'person' as const, id: world.owner('Kenil').id } }
    const take = (name: string, mime: string, text: string) =>
      world.files.take(Buffer.from(text), name, mime, person).file.hash
    const pdf = await a.inject({
      url: `/api/files/${take('a.pdf', 'application/pdf', '%PDF-1.4')}`,
      headers: ok,
    })
    expect(pdf.headers['content-type']).toContain('application/pdf')
    expect(pdf.headers['content-disposition']).toContain('inline')
    expect(pdf.headers['x-content-type-options']).toBe('nosniff')
    const html = await a.inject({
      url: `/api/files/${take('invoice.html', 'text/html', '<script>fetch("/api/me")</script>')}`,
      headers: ok,
    })
    expect(html.headers['content-security-policy']).toContain('sandbox')
    expect(html.headers['referrer-policy']).toBe('no-referrer')
    const svg = await a.inject({
      url: `/api/files/${take('logo.svg', 'image/svg+xml', '<svg/>')}`,
      headers: ok,
    })
    expect(svg.headers['content-security-policy']).toContain('sandbox')
    const exe = await a.inject({
      url: `/api/files/${take('setup.exe', 'application/x-msdownload', 'MZ')}`,
      headers: ok,
    })
    expect(exe.headers['content-disposition']).toContain('attachment')
    expect(exe.headers['content-type']).toContain('application/octet-stream')
    // a type the sender lied about still never runs: nosniff on every file
    const lied = await a.inject({
      url: `/api/files/${take('x.txt', 'text/plain', '<html>')}`,
      headers: ok,
    })
    expect(lied.headers['content-type']).toContain('text/plain')
    expect(lied.headers['x-content-type-options']).toBe('nosniff')
    await a.close()
  })

  it('shows modules inside modules, places one as the person’s word, and keeps the layout', async () => {
    const alpha = { actor: { kind: 'alpha' as const } }
    const shops = world.shape.makeModule('Shops', alpha)
    const bakery = world.shape.makeModule('Bakery', alpha)
    world.shape.makeTable(bakery.id, 'Orders', [{ name: 'Item', kind: 'text' }], alpha)
    world.shape.makeModule('Empty', alpha)
    const a = app()
    const list = async () =>
      (await a.inject({ url: '/api/modules', headers: ok })).json() as {
        name: string
        parent: string | null
      }[]
    // a module with nothing in sight stays out, until a module inside it has something
    expect((await list()).map((m) => [m.name, m.parent])).toEqual([['Bakery', null]])
    const placed = await a.inject({
      method: 'POST',
      url: `/api/modules/${bakery.id}/place`,
      headers: ok,
      payload: { within: shops.id },
    })
    expect(placed.json()).toEqual({ id: bakery.id, parent: shops.id })
    expect(world.shape.placedBy(bakery.id)).toBe('person')
    expect((await list()).map((m) => [m.name, m.parent])).toEqual([
      ['Shops', null],
      ['Bakery', shops.id],
    ])
    const view = (await a.inject({ url: `/api/modules/${shops.id}`, headers: ok })).json()
    expect(view.modules.map((m: { name: string }) => m.name)).toEqual(['Bakery'])
    expect(view.modules[0]).toMatchObject({ kit: null, agents: 0, running: 0, needs: 0, tasks: 0 })
    const loop = await a.inject({
      method: 'POST',
      url: `/api/modules/${shops.id}/place`,
      headers: ok,
      payload: { within: bakery.id },
    })
    expect(loop.statusCode).toBe(409)
    expect((await a.inject({ url: '/api/me', headers: ok })).json().layout).toEqual({
      railFolded: false,
      folded: [],
      hidden: [],
      railWidth: null,
      panel: null,
      assistant: 'open',
      pageSize: null,
      pins: {},
      seen: {},
      docked: null,
    })
    // all of how the person left the window is kept here, none of it in the browser (26 Oct)
    await a.inject({
      method: 'POST',
      url: '/api/layout',
      headers: ok,
      payload: {
        railFolded: true,
        folded: [shops.id],
        hidden: [shops.id],
        panel: 560,
        railWidth: 260,
        assistant: 'folded',
        pageSize: 100,
        pins: { [shops.id]: ['t_one'] },
        docked: ['#/', '#/tasks'],
      },
    })
    await a.inject({ method: 'POST', url: '/api/seen', headers: ok, payload: { key: 'module:x' } })
    await a.inject({ method: 'POST', url: '/api/seen', headers: ok, payload: { key: 'module:x' } })
    expect((await a.inject({ url: '/api/me', headers: ok })).json().layout).toEqual({
      railFolded: true,
      folded: [shops.id],
      hidden: [shops.id],
      railWidth: 260,
      panel: 560,
      assistant: 'folded',
      pageSize: 100,
      pins: { [shops.id]: ['t_one'] },
      seen: { 'module:x': 2 },
      docked: ['#/', '#/tasks'],
    })
    await a.close()
  })

  it('serves People, Tasks, Agents and the rules as tables, each changed where the core allows it', async () => {
    const me = world.owner('Kenil')
    const person = { actor: { kind: 'person' as const, id: me.id }, user: me.id }
    const connector = { kind: 'connector' as const, id: 'contacts' }
    const m = world.shape.makeModule('Contacts', { actor: connector })
    const contacts = world.shape.makeTable(
      m.id,
      'Contacts',
      [
        { name: 'Name', kind: 'text' },
        { name: 'Emails', kind: 'text' },
      ],
      { actor: connector },
    )
    world.people.mapTable(
      contacts.id,
      { each: 'person', name: 'Name', emails: 'Emails' },
      { actor: connector },
    )
    world.records.land(
      contacts.id,
      [{ key: 'c1', values: { Name: 'Sam Ortiz', Emails: 'sam@grand.com' } }],
      { connector: 'contacts' },
      { actor: connector },
    )
    const t = world.tasks.add({ title: 'Call Sam' }, person)
    const a = app()
    const get = async (path: string) => (await a.inject({ url: path, headers: ok })).json()
    const post = (path: string, payload: object) =>
      a.inject({ method: 'POST', url: path, headers: ok, payload })

    const people = await get('/api/kept/people')
    expect(people.kept).toMatchObject({ name: 'people', editable: ['Name'] })
    expect(people.fields.map((f: { name: string }) => f.name)).toEqual([
      'Name',
      'Lists',
      'Organization',
      'Email',
      'Phone',
      'Last',
      'Talks',
    ])
    const sam = people.rows[0]
    expect(sam.values).toMatchObject({ name: 'Sam Ortiz', email: 'sam@grand.com' })
    expect(
      (await post(`/api/kept/people/rows/${sam.id}`, { field: 'Name', value: 'Sam O.' }))
        .statusCode,
    ).toBe(200)
    expect(world.people.get(sam.id)?.name).toBe('Sam O.')
    // a field the core does not change here says where it changes
    const email = await post(`/api/kept/people/rows/${sam.id}`, { field: 'Email', value: 'x@y.z' })
    expect(email.statusCode).toBe(409) // a refusal, in words
    expect(email.json().problem).toMatch(/Only the name changes here/)

    // a task's state from the board, its words and due in their cells, as the person's word
    const tasks = await get('/api/kept/tasks?list=open')
    expect(
      tasks.rows.map((r: { values: { task: string; state: string } }) => [
        r.values.task,
        r.values.state,
      ]),
    ).toEqual([['Call Sam', 'To do']])
    expect(tasks.kept.counts.open).toBe(1)
    await post(`/api/kept/tasks/rows/${t.id}`, { field: 'State', value: 'Doing' })
    await post(`/api/kept/tasks/rows/${t.id}`, { field: 'Due', value: '2026-11-02' })
    await post(`/api/kept/tasks/rows/${t.id}`, { field: 'Task', value: 'Call Sam back' })
    expect(world.tasks.get(t.id)).toMatchObject({
      state: 'doing',
      due: '2026-11-02',
      title: 'Call Sam back',
    })
    expect(
      (await post(`/api/kept/tasks/rows/${t.id}`, { field: 'State', value: 'Later' })).statusCode,
    ).toBe(409)
    // a task needs your input while its cards wait: its cards set that, never a hand
    expect(
      (
        await post(`/api/kept/tasks/rows/${t.id}`, { field: 'State', value: 'Needs your input' })
      ).json().problem,
    ).toMatch(/while its cards wait/)
    expect(
      (await post(`/api/kept/tasks/rows/${t.id}`, { field: 'Where', value: 'x' })).json().problem,
    ).toMatch(/change on its page/)
    // a card waiting on the person is a task row of All open, the person's, from Alpha, until
    // it is answered; it is answered on the card, never in a cell
    const card = world.cards.open({
      kind: 'question',
      words: 'Which Sam?',
      options: ['Sam Oat', 'Sam Mill'],
      actor: { kind: 'alpha' },
    })
    const withCard = await get('/api/kept/tasks?list=open')
    expect(withCard.rows[0]).toMatchObject({
      id: `card:${card.id}`,
      values: { task: 'Which Sam?', state: 'Needs your input', owner: 'You', from: 'Alpha' },
    })
    expect(withCard.kept.counts.open).toBe(2)
    expect(
      (await post(`/api/kept/tasks/rows/card:${card.id}`, { field: 'Task', value: 'x' })).json()
        .problem,
    ).toMatch(/answered on the card/)
    world.cards.answer(card.id, 'Sam Oat', { kind: 'person', id: 'u_1' })
    expect((await get('/api/kept/tasks?list=open')).rows).toHaveLength(1)

    // the rules are read here; Revoke is on a rule's page
    const rules = await get('/api/kept/rules')
    expect(rules.kept).toMatchObject({
      editable: [],
      why: 'Open a rule to revoke it; its page asks first.',
    })
    await a.close()
  })

  it('shows a new agent with Activate until it is turned on, and finds where People lives and Alpha’s own module by module.yaml', async () => {
    const m = await install(world, join(import.meta.dirname, '..', 'modules', 'test-kit'), {
      actor: { kind: 'alpha' },
    })
    const a = app()
    const get = async (path: string) => (await a.inject({ url: path, headers: ok })).json()
    const counter = async () =>
      (await get('/api/working'))
        .flatMap((x: { agents: { name: string }[] }) => x.agents)
        .find((x: { name: string }) => x.name === 'Counter')
    const was = await counter()
    expect([was.state, was.fresh, was.nextRunAt, was.module.id]).toEqual([
      'paused',
      true,
      null,
      m.id,
    ])
    expect(was.triggers.length).toBeGreaterThan(0)
    await a.inject({
      method: 'POST',
      url: `/api/agents/${was.id}`,
      headers: ok,
      payload: { state: 'on' },
    })
    const now = await counter()
    expect([now.state, now.fresh]).toEqual(['on', false])
    // no module says it holds People until its module.yaml does
    expect((await get('/api/modules')).find((x: { id: string }) => x.id === m.id).people).toBe(
      false,
    )
    const file = join(m.dir, 'module.yaml')
    writeFileSync(file, `${readFileSync(file, 'utf8')}people: true\n`)
    expect((await get('/api/modules')).find((x: { id: string }) => x.id === m.id).people).toBe(true)
    expect((await get(`/api/modules/${m.id}`)).people).toBe(true)
    // and Alpha's own module is the one whose module.yaml says core: true, whatever its name
    expect((await get('/api/modules')).find((x: { id: string }) => x.id === m.id).alpha).toBe(false)
    writeFileSync(file, `${readFileSync(file, 'utf8')}core: true\n`)
    expect((await get('/api/modules')).find((x: { id: string }) => x.id === m.id).alpha).toBe(true)
    await a.close()
  })

  it('shows a table with each value’s source in words', async () => {
    const user = world.owner('Kenil')
    const m = world.shape.makeModule('Food', { actor: { kind: 'alpha' } })
    const t = world.shape.makeTable(m.id, 'Meals', [{ name: 'Food', kind: 'text' }], {
      actor: { kind: 'alpha' },
    })
    const said = world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'said',
      words: 'log two eggs',
      user: user.id,
    })
    world.records.add(t.id, [{ values: { Food: 'eggs' }, provenance: { kind: 'stated' } }], {
      actor: { kind: 'alpha' },
      user: user.id,
      turn: String(said.id),
      said: { message: said.id, user: user.id },
    })
    const a = app()
    const table = (await a.inject({ url: `/api/tables/${t.id}`, headers: ok })).json() as TableView
    expect(table.rows[0]?.values).toEqual({ food: 'eggs' })
    expect(table.rows[0]?.sources.food?.words).toBe('You said “log two eggs”')
    const stream = (await a.inject({ url: '/api/stream', headers: ok })).json() as Stream
    expect(stream.lines.map((l) => [l.kind, l.words])).toEqual([
      ['said', 'log two eggs'],
      ['wrote', 'Added a row to Meals: Food eggs.'],
    ])
    await a.close()
  })

  it('starts Interview me with the most useful question, and goes on while one is worth asking', async () => {
    const me = world.owner('Kenil')
    await keepDefaults(world, { actor: { kind: 'system' }, user: me.id }, DEFAULT_KITS)
    await refresh(world, async () => ({ answer: { questions: [] }, tokens: 0 }), null)
    const server = app()
    const view = (
      await server.inject({ url: '/api/interview', headers: ok })
    ).json() as InterviewView
    expect(view.today).toBe(true)
    expect(view.left).toBeGreaterThan(1)
    expect(view.first).toBe(ranked(world)[0]?.ask)
    const started = await server.inject({
      method: 'POST',
      url: '/api/interview',
      headers: ok,
      payload: {},
    })
    expect(started.json()).toEqual({ preparing: false })
    const asked = world.lines({ kinds: ['replied'] }).at(-1)
    // no count: the sitting opens with its line, then the question, its why and what it unblocks
    expect(asked?.words).toMatch(
      /^A few questions today, starting with the most useful\.\n\nWhat are the three things/,
    )
    expect(asked?.words).not.toMatch(/\d+ of \d+/)
    expect(asked?.data.interview).toMatchObject({ key: 'goals' })
    expect(pending(world, me.id)?.key).toBe('goals')
    // a pass: it sinks, and Alpha asks the next without the model
    await server.inject({
      method: 'POST',
      url: '/api/say',
      headers: ok,
      payload: { words: 'skip', agent: 'interviewer' },
    })
    const next = world.lines({ kinds: ['replied'] }).at(-1)
    expect(next?.data.interview).not.toMatchObject({ key: 'goals' })
    expect(next?.words).not.toMatch(/^A few questions/)
    expect(loadPool(world).items.find((q) => q.key === 'goals')?.skips).toBe(1)
    // done: the sitting ends, and nothing is pending
    await server.inject({
      method: 'POST',
      url: '/api/say',
      headers: ok,
      payload: { words: 'Done for today', agent: 'interviewer' },
    })
    expect(world.lines({ kinds: ['replied'] }).at(-1)?.words).toMatch(/^Thank you\. That is enough/)
    expect(pending(world, me.id)).toBeNull()
    // every line of the sitting is in the Interviewer's thread, which no kit agent is
    const stream = (await server.inject({ url: '/api/stream', headers: ok })).json() as Stream
    const sitting = stream.lines.filter((l) => l.kind === 'said' || l.turn?.startsWith('iv'))
    expect(sitting.length).toBeGreaterThan(3)
    expect(sitting.every((l) => l.agent?.id === 'interviewer')).toBe(true)
    // Stop while preparing: the thread says so, and nothing is pending
    await server.inject({ method: 'POST', url: '/api/interview/stop', headers: ok, payload: {} })
    expect(world.lines({ kinds: ['replied'] }).at(-1)?.words).toBe('Stopped.')
    await server.close()
  })

  it('opens one card in full with its history, and refuses words to an agent not there', async () => {
    const me = world.owner('Kenil')
    const card = world.cards.open({
      kind: 'question',
      words: 'Which listing first?',
      actor: { kind: 'alpha' },
      user: me.id,
    })
    const a = app()
    const about = (
      await a.inject({ url: `/api/cards/${card.id}/about`, headers: ok })
    ).json() as CardAbout
    expect(about.card.words).toBe('Which listing first?')
    expect(about.agent).toBeNull()
    expect(about.runs).toEqual([])
    expect(about.history.map((h) => h.words)).toEqual(['Which listing first?'])
    expect(about.card.task).toBeNull()
    // a card about a task says which, so the task is not a second row beside it
    const onTask = world.cards.open({
      kind: 'question',
      words: 'Which oven?',
      call: { tool: 'ask', input: { task: 't_bake' } },
      actor: { kind: 'alpha' },
      user: me.id,
    })
    const of = (
      await a.inject({ url: `/api/cards/${onTask.id}/about`, headers: ok })
    ).json() as CardAbout
    expect(of.card.task).toBe('t_bake')
    const said = await a.inject({
      method: 'POST',
      url: '/api/say',
      headers: ok,
      payload: { words: 'why did you stop?', agent: 'ag_none' },
    })
    expect(said.statusCode).toBeGreaterThanOrEqual(400)
    await a.close()
  })

  it('sets a choice as the person’s own word, and shows a told line with its rows', async () => {
    const user = world.owner('Kenil')
    const m = world.shape.makeModule('Deals', { actor: { kind: 'alpha' } })
    const t = world.shape.makeTable(
      m.id,
      'Deals',
      [
        { name: 'Name', kind: 'text' },
        { name: 'Stage', kind: 'choice', choices: ['New', 'Passed'] },
      ],
      { actor: { kind: 'alpha' } },
    )
    world.records.land(
      t.id,
      [{ key: 'HP101', values: { Name: 'Harbor firm', Stage: 'New' } }],
      { connector: 'agent:Reader' },
      { actor: { kind: 'agent', id: 'Reader' } },
    )
    const [row] = world.records.list(t.id)
    world.line({
      actor: { kind: 'agent', id: 'Figures' },
      kind: 'told',
      words: 'Figures: 1 new deal fits your thesis.',
      data: {
        agent: 'Figures',
        about: {
          table: t.id,
          rows: [row?.id],
          choice: { field: 'Stage', value: 'Passed', label: 'Pass' },
        },
      },
      user: user.id,
    })
    const a = app()
    const told = () =>
      (a.inject({ url: '/api/stream', headers: ok }) as Promise<{ json: () => Stream }>).then(
        (r) => r.json().lines.find((l) => l.kind === 'told')?.data.about,
      )
    expect(await told()).toEqual({
      table: t.id,
      rows: [{ id: row?.id, name: 'Harbor firm', value: 'New' }],
      choice: { field: 'Stage', value: 'Passed', label: 'Pass' },
    })
    const set = await a.inject({
      method: 'POST',
      url: `/api/tables/${t.id}/rows/${row?.id}`,
      headers: ok,
      payload: { field: 'Stage', value: 'Passed' },
    })
    expect(set.statusCode).toBe(200)
    expect(((await told()) as { rows: { value: string }[] }).rows[0]?.value).toBe('Passed')
    const table = (await a.inject({ url: `/api/tables/${t.id}`, headers: ok })).json() as TableView
    expect(table.rows[0]?.sources.stage?.words).toBe('You set it in your window')
    const notChoice = await a.inject({
      method: 'POST',
      url: `/api/tables/${t.id}/rows/${row?.id}`,
      headers: ok,
      payload: { field: 'Name', value: 'Other' },
    })
    expect(notChoice.statusCode).toBe(200)
    await a.close()
  })

  it('shows what Alpha remembers and forgets a line the person removes', async () => {
    const user = world.owner('Kenil')
    const { appendFileSync } = await import('node:fs')
    const { instructionsFile } = await import('../engine/tools/index.ts')
    appendFileSync(
      instructionsFile(world, user.id),
      '# Standing instructions\n\n- Call me Kenil\n- Money in USD\n',
    )
    const a = app()
    const before = (await a.inject({ url: '/api/instructions', headers: ok })).json()
    expect(before).toEqual([
      { for: 'me', words: 'Call me Kenil' },
      { for: 'me', words: 'Money in USD' },
    ])
    const gone = await a.inject({
      method: 'POST',
      url: '/api/instructions/remove',
      headers: ok,
      payload: { for: 'me', words: 'Call me Kenil' },
    })
    expect(gone.statusCode).toBe(200)
    expect((await a.inject({ url: '/api/instructions', headers: ok })).json()).toEqual([
      { for: 'me', words: 'Money in USD' },
    ])
    expect(world.lines({ kinds: ['forgot'] })[0]?.words).toBe(
      'Will no longer remember: Call me Kenil',
    )
    await a.close()
  })

  it('corrects a value as the person’s word and shows the value’s history, newest first', async () => {
    world.owner('Kenil')
    const m = world.shape.makeModule('Deals', { actor: { kind: 'alpha' } })
    const t = world.shape.makeTable(
      m.id,
      'Deals',
      [
        { name: 'Name', kind: 'text' },
        { name: 'SDE', kind: 'money' },
        { name: 'Sources', kind: 'relation', relatesTo: 'Deals' },
      ],
      { actor: { kind: 'alpha' } },
    )
    const src = { connector: 'agent:Reader' }
    const ctx = { actor: { kind: 'agent' as const, id: 'Reader' } }
    world.records.land(
      t.id,
      [{ key: 'A1', values: { Name: 'A firm', SDE: { amount: 300000, currency: 'USD' } } }],
      src,
      ctx,
    )
    world.records.land(
      t.id,
      [{ key: 'A1', values: { SDE: { amount: 320000, currency: 'USD' } } }],
      src,
      ctx,
    )
    const [row] = world.records.list(t.id)
    const a = app()
    const set = await a.inject({
      method: 'POST',
      url: `/api/tables/${t.id}/rows/${row?.id}`,
      headers: ok,
      payload: { field: 'SDE', value: { amount: 310000, currency: 'USD' } },
    })
    expect(set.statusCode).toBe(200)
    const history = (
      await a.inject({ url: `/api/tables/${t.id}/rows/${row?.id}/history?field=sde`, headers: ok })
    ).json() as { value: { amount: number }; source: { kind: string } }[]
    expect(history.map((h) => [h.value.amount, h.source.kind])).toEqual([
      [310000, 'stated'],
      [320000, 'looked_up'],
      [300000, 'looked_up'],
    ])
    const relation = await a.inject({
      method: 'POST',
      url: `/api/tables/${t.id}/rows/${row?.id}`,
      headers: ok,
      payload: { field: 'Sources', value: ['r_not_there'] },
    })
    // a relation is picked in the window now (30 Oct), but only rows of the table it points at
    expect(relation.statusCode).toBe(409)
    expect(relation.json().problem).toMatch(/takes a row of/)
    await a.close()
  })
  it('keeps Alpha’s figure beside a value the person types over, and resets to it', async () => {
    const m = world.shape.makeModule('Books', { actor: { kind: 'alpha' } })
    const t = world.shape.makeTable(
      m.id,
      'Months',
      [
        { name: 'Month', kind: 'text' },
        { name: 'Days cash', kind: 'number' },
      ],
      { actor: { kind: 'alpha' } },
    )
    const [id] = world.records.add(
      t.id,
      [
        {
          values: { Month: 'June', 'Days cash': 54 },
          provenance: {
            kind: 'computed',
            source: { formula: 'cash ÷ (costs ÷ 30)', note: '40 ÷ (22 ÷ 30) = 54' },
          },
        },
      ],
      { actor: { kind: 'alpha' } },
    )
    const a = app()
    const edit = await a.inject({
      method: 'POST',
      url: `/api/tables/${t.id}/rows/${id}`,
      headers: ok,
      payload: { field: 'Days cash', value: 60 },
    })
    expect(edit.statusCode).toBe(200)
    const after = (await a.inject({ url: `/api/tables/${t.id}`, headers: ok })).json() as TableView
    const source = after.rows[0]?.sources.days_cash
    expect(after.rows[0]?.values.days_cash).toBe(60)
    expect(source?.kind).toBe('stated')
    expect(source?.beside).toMatchObject({ value: 54, note: '40 ÷ (22 ÷ 30) = 54' })
    const reset = await a.inject({
      method: 'POST',
      url: `/api/tables/${t.id}/rows/${id}/reset`,
      headers: ok,
      payload: { field: 'Days cash' },
    })
    expect(reset.statusCode).toBe(200)
    const back = (await a.inject({ url: `/api/tables/${t.id}`, headers: ok })).json() as TableView
    expect(back.rows[0]?.values.days_cash).toBe(54)
    expect(back.rows[0]?.sources.days_cash?.kind).toBe('computed')
    await a.close()
  })

  it('files a dropped file on a row at once, sets its kind and takes it off', async () => {
    const alpha = { actor: { kind: 'alpha' as const } }
    const m = world.shape.makeModule('Desk', alpha)
    const t = world.shape.makeTable(m.id, 'Jobs', [{ name: 'Name', kind: 'text' }], alpha)
    world.shape.setDocuments(t.id, ['Brief', 'Invoice'], alpha)
    const [row] = world.records.add(
      t.id,
      [{ values: { Name: 'Shop fit' }, provenance: { kind: 'assumed', basis: 'a test' } }],
      alpha,
    )
    const a = app()
    const path = `/api/tables/${t.id}/rows/${row}/files`
    const dropped = await a.inject({
      method: 'POST',
      url: path,
      headers: {
        ...ok,
        'content-type': 'text/csv',
        'x-file-name': 'brief.csv',
        'x-file-kind': 'Brief',
      },
      payload: 'name,size\nshelf,2\n',
    })
    expect(dropped.statusCode).toBe(200)
    const [f] = dropped.json()
    expect([f.name, f.kind, f.by, f.read]).toEqual(['brief.csv', 'Brief', 'You', 'read'])
    const table = (await a.inject({ url: `/api/tables/${t.id}`, headers: ok })).json() as TableView
    expect(table.documents).toEqual(['Brief', 'Invoice'])
    const wrong = await a.inject({
      method: 'POST',
      url: `${path}/${f.hash}`,
      headers: ok,
      payload: { kind: 'Lease' },
    })
    expect(wrong.statusCode).toBe(409)
    const kind = await a.inject({
      method: 'POST',
      url: `${path}/${f.hash}`,
      headers: ok,
      payload: { kind: 'Invoice' },
    })
    expect(kind.json()[0].kind).toBe('Invoice')
    const off = await a.inject({
      method: 'POST',
      url: `${path}/${f.hash}`,
      headers: ok,
      payload: { off: true },
    })
    expect(off.json()).toEqual([])
    expect(world.files.file(f.hash)?.name).toBe('brief.csv')
    await a.close()
  })

  it('saves views, takes many rows at once, removes ticked ones, adds a field and exports', async () => {
    const m = world.shape.makeModule('Deals desk', { actor: { kind: 'alpha' } })
    const t = world.shape.makeTable(
      m.id,
      'Deals',
      [
        { name: 'Name', kind: 'text' },
        { name: 'Price', kind: 'money' },
      ],
      { actor: { kind: 'alpha' } },
    )
    const a = app()
    const post = (url: string, payload: unknown) =>
      a.inject({ method: 'POST', url, headers: ok, payload: payload as object })
    const view = await post(`/api/tables/${t.id}/views`, {
      name: 'Dear',
      config: { sorts: [{ field: 'Price', dir: 'desc' }] },
    })
    expect(view.statusCode).toBe(200)
    const renamed = await a.inject({
      method: 'PUT',
      url: `/api/views/${view.json().id}`,
      headers: ok,
      payload: { name: 'Pricey', isDefault: true },
    })
    expect(renamed.json()).toMatchObject({ name: 'Pricey', isDefault: true })

    const many = await post(`/api/tables/${t.id}/rows/many`, {
      add: [
        { values: { Name: 'Payroll firm', Price: { amount: 1200000, currency: 'USD' } } },
        { values: { Name: 'Tax shop' } },
      ],
    })
    expect(many.json()).toEqual({ changed: 0, added: 2 })
    const rows = world.records.list(t.id)
    expect(rows[1]?.provenance.name?.kind).toBe('stated')
    await post(`/api/tables/${t.id}/rows/many`, {
      set: [{ row: rows[1]?.id, values: { Price: { amount: 300000, currency: 'USD' } } }],
    })
    expect(world.records.list(t.id)[1]?.values.price).toEqual({ amount: 300000, currency: 'USD' })

    const csv = await post(`/api/tables/${t.id}/export`, {
      rows: rows.map((r) => r.id),
      fields: ['Name', 'Price'],
      as: 'csv',
    })
    expect(csv.headers['content-type']).toContain('text/csv')
    expect(csv.body.trim().split('\n')).toEqual([
      'Name,Price',
      'Payroll firm,1200000',
      'Tax shop,300000',
    ])

    await post(`/api/tables/${t.id}/fields`, {
      name: 'Stage',
      kind: 'choice',
      choices: ['New', 'Passed'],
    })
    expect(world.shape.table(t.id)?.fields.map((f) => f.name)).toEqual(['Name', 'Price', 'Stage'])

    const removed = await post(`/api/tables/${t.id}/rows/remove`, { rows: [rows[0]?.id] })
    expect(removed.json()).toEqual({ removed: 1 })
    const shown = (await a.inject({ url: `/api/tables/${t.id}`, headers: ok })).json() as TableView
    expect(shown.rows.length).toBe(1)
    expect(shown.views.map((v) => v.name)).toEqual(['Pricey'])
    await a.close()
  })

  it('puts a maintained kit’s shape change on a card: done now and counted, or asked of the maintainer', async () => {
    const a = app()
    const dir = join(home, 'kit')
    cpSync(join(import.meta.dirname, '..', 'modules', 'test-kit'), dir, { recursive: true })
    writeFileSync(
      join(dir, 'module.yaml'),
      `${readFileSync(join(dir, 'module.yaml'), 'utf8')}maintainer: { name: Avilo, address: kits@avilo.example }\n`,
    )
    const owner = world.owner('Kenil')
    const m = await install(world, dir, { actor: { kind: 'person', id: owner.id }, user: owner.id })
    const change = {
      action: 'add_fields',
      table: 'Orders',
      fields: [{ name: 'Note', kind: 'text' }],
    }
    const open = (words: string) =>
      world.cards.open({
        kind: 'suggestion',
        words,
        options: ['Ask Avilo', 'Do it now anyway'],
        call: { tool: MAINTAINED_SHAPE, input: change },
        actor: { kind: 'alpha' },
        user: owner.id,
        module: m.id,
      })
    const now = open('Avilo maintains Bakery: add Note (text) to Orders')
    const done = await a.inject({
      method: 'POST',
      url: `/api/cards/${now.id}`,
      headers: ok,
      payload: { answer: 'Do it now anyway' },
    })
    expect(done.statusCode).toBe(200)
    expect(world.shape.table('Orders')?.fields.map((f) => f.name)).toContain('Note')
    const working = (await a.inject({ url: '/api/working', headers: ok })).json() as {
      kit: { maintainer: { name: string }; changes: number } | null
    }[]
    expect(working[0]?.kit).toMatchObject({ maintainer: { name: 'Avilo' }, changes: 1 })
    const ask = open('Avilo maintains Bakery: rename Quantity in Orders to How many')
    const asked = await a.inject({
      method: 'POST',
      url: `/api/cards/${ask.id}`,
      headers: ok,
      payload: { answer: 'Ask Avilo' },
    })
    expect(asked.statusCode).toBe(200)
    expect(world.cards.get(ask.id)?.state).toBe('yes')
    expect(world.shape.table('Orders')?.fields.map((f) => f.name)).not.toContain('How many')
    await a.close()
  })
})
