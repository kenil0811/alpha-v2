// Interviews (docs/rules.md, I1 to I4): what the Interviewer proposes cites what it rests on, its
// numbers come from code or are marked estimated with their basis, a source the person skipped is
// never read or cited, and what they dropped or declined never comes back. Tried through its own
// tools, as its desk is given them, on the rule world with the interviews plugin switched on and a
// made-up mailbox; the person's answers are given on the cards themselves. Never the model.
import type { Connector } from '@alpha/connector-sdk'
import { landIn, tableOf } from '../connectors/places.ts'
import type { ToolEntry } from '../engine/registry.ts'
import type { Here } from '../engine/tools/common.ts'
import { Reviews } from '../modules/reviews.ts'
import { switchOn } from '../plugins/plugins.ts'
import { rule } from './rule.ts'
import type { RuleWorld } from './world.ts'

const MAIL = {
  manifest: { name: 'gmail', title: 'Gmail' },
  module: 'Mail',
  tables: [
    {
      name: 'Mail',
      fields: [
        { name: 'From', kind: 'text' },
        { name: 'Subject', kind: 'text' },
        { name: 'Date', kind: 'date' },
      ],
    },
  ],
} as unknown as Connector

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

// The rule world with interviews on, three quote requests in the mail, and the Interviewer's tools.
async function interviewing(w: RuleWorld) {
  const { plugins } = await switchOn(['interviews'], {
    world: w.world,
    user: w.user,
    home: w.home,
    region: () => null,
    ask: async () => ({ answer: null }),
    connectors: null,
  })
  await plugins.keepKits({ actor: { kind: 'system' }, user: w.user.id })
  return { ...(await interviewingWith(w)), ...toolsOf(w, plugins) }
}

// Three quote requests in the mail, and what the cases read.
async function interviewingWith(w: RuleWorld) {
  landIn(w.world, MAIL)
  const t = tableOf(w.world, MAIL, 'Mail')
  if (!t) throw new Error('No Mail table.')
  w.world.records.land(
    t.id,
    [1, 2, 3].map((n) => ({
      key: `q${n}`,
      values: { From: `client${n}@example.com`, Subject: 'Quote for a kitchen', Date: day(n * 7) },
    })),
    { connector: 'gmail', account: 'sam@oak.example' },
    { actor: { kind: 'connector', id: 'gmail' } },
  )
  const mail = w.world.records.list(t.id).map((r) => `row ${r.id}`)
  const rows = (table: string) => {
    const tt = w.world.shape.tables().find((x) => x.name === table)
    return tt ? w.world.records.list(tt.id) : []
  }
  const field = (table: string, name: string) =>
    w.world.shape
      .tables()
      .find((x) => x.name === table)
      ?.fields.find((f) => f.name === name)?.slug ?? ''
  return { mail, rows, field }
}

// The Interviewer's tools, as its desk is given them, and the person's answers on its cards.
function toolsOf(w: RuleWorld, plugins: Awaited<ReturnType<typeof switchOn>>['plugins']) {
  const interviewer = w.world.agents.list().find((a) => a.name === 'Interviewer')
  if (!interviewer) throw new Error('No Interviewer.')
  const here: Here = {
    current: { user: w.user, turn: 't1', said: null, message: null, agent: interviewer.id },
    fromSubagent: false,
    touched: new Set<string>(),
    afterTurn: [],
  }
  const tools = plugins.toolsFor(interviewer.id, here)
  const call = async (name: string, input: Record<string, unknown>) => {
    const out = await (tools.find((x) => x.name === name) as ToolEntry).handler(input)
    const text = out.content.map((c) => ('text' in c ? c.text : '')).join('\n')
    return { refused: !!out.isError, text }
  }
  const person = { kind: 'person' as const, id: w.user.id }
  // the newest card the Interviewer has waiting, answered as the person
  const answer = (words: string) => {
    const card = w.world.cards.waiting(w.user.id).find((c) => c.agent === interviewer.id)
    if (!card) throw new Error('No card waiting.')
    w.world.cards.answer(card.id, words, person)
    return card.id
  }
  // a question of the Interviewer's, answered
  const asked = (words: string, said: string) => {
    const card = w.world.cards.open({
      kind: 'question',
      words,
      options: [],
      actor: { kind: 'alpha', id: interviewer.id },
      user: w.user.id,
      turn: 't1',
    })
    w.world.cards.answer(card.id, said, person)
    return card.id
  }
  // Set up Alpha reading what is connected, these sources turned off
  const know = (off: string[]) => {
    const c = plugins.chapters.find((x) => x.key === 'learned')
    if (!c) throw new Error('No What I learned.')
    const who = { id: w.user.id, name: w.user.name, owner: true }
    return c.act({ params: {}, query: {}, body: { read: { off } }, person: who })
  }
  const OTHERS = ['calendar', 'contacts', 'folder', 'browsing', 'apps', 'ai', 'alpha']
  const allowMail = async () => {
    await know(OTHERS)
    return call('source', { source: 'mail' })
  }
  const skipMail = () => know(['mail', ...OTHERS])
  return { call, answer, asked, allowMail, skipMail, person, interviewer }
}

// Set up Alpha's Get to know you and What I learned, the same rule world: the draft the model
// would give stood in for by draft(rows), the mail rows given to it.
async function storied(
  w: RuleWorld,
  draft: (rows: string[], prompt: string) => Record<string, unknown>,
) {
  const { plugins } = await switchOn(['interviews'], {
    world: w.world,
    user: w.user,
    home: w.home,
    region: () => null,
    ask: async (_s, prompt) => ({
      answer: draft(
        [...prompt.matchAll(/^(row \S+):/gm)].map((m) => m[1] as string),
        prompt,
      ),
    }),
    connectors: null,
  })
  await plugins.keepKits({ actor: { kind: 'system' }, user: w.user.id })
  const i = await interviewingWith(w)
  const chapter = (key: string) => {
    const c = plugins.chapters.find((x) => x.key === key)
    if (!c) throw new Error(`No chapter ${key}.`)
    return c
  }
  const input = (body: unknown = {}) => ({
    params: {},
    query: {},
    body,
    person: { id: w.user.id, name: w.user.name, owner: true },
  })
  // the learned screen once the draft written in the background is in
  const learned = async () => {
    for (let n = 0; n < 100; n++) {
      const v = (await chapter('learned').screen(input())) as unknown as {
        drafting: boolean
        about: { id: string; line: string }[]
        workflows: { name: string }[]
      }
      if (!v.drafting) return v
      await new Promise((ok) => setTimeout(ok, 20))
    }
    throw new Error('The draft never came.')
  }
  const read = (off: string[]) => chapter('learned').act(input({ read: { off } }))
  return { ...i, chapter, input, learned, read }
}

const quoting = (rests: string[], more: Record<string, unknown> = {}) => ({
  workflow: {
    name: 'Writing quotes',
    shows: 'Three clients asked for a kitchen quote in the last month.',
    means: 'Each quote is written by hand.',
    times: { rows: rests },
    rests_on: rests,
    ...more,
  },
})

rule('I1', 'every line and proposal the Interviewer proposes cites what it rests on', {
  cases: {
    'one that cites nothing is refused': async (w) => {
      const i = await interviewing(w)
      await i.allowMail()
      const out = await i.call('propose', quoting([]))
      return out.refused && /cites nothing/.test(out.text)
    },
    'one that cites a row nothing allowed was read from is refused': async (w) => {
      const i = await interviewing(w)
      const out = await i.call('propose', quoting(i.mail))
      return out.refused && /nothing read holds/.test(out.text)
    },
    'one that names a site nothing read holds is refused': async (w) => {
      const i = await interviewing(w)
      await i.allowMail()
      const out = await i.call(
        'propose',
        quoting(i.mail, { shows: 'They price each kitchen on homequotes.example first.' }),
      )
      return out.refused && /names homequotes\.example/.test(out.text)
    },
    'one that says "you said" of words the person never wrote is refused': async (w) => {
      const i = await interviewing(w)
      await i.allowMail()
      const card = i.asked('How long does a quote take?', 'About 45 minutes each.')
      const out = await i.call(
        'propose',
        quoting([...i.mail, `answer ${card}`], { means: 'You said “I hate quotes”.' }),
      )
      return out.refused && /you said/.test(out.text)
    },
    'drafted in Set up Alpha, a line that cites nothing is left out, and one that does is kept':
      async (w) => {
        const i = await storied(w, (rows) => ({
          about: [
            { line: 'Writes every quote by hand.', for: 'me', rests_on: rows },
            { line: 'Hates paperwork.', for: 'me', rests_on: [] },
          ],
          workflows: [],
          questions: [],
        }))
        await i.read([])
        const v = await i.learned()
        return v.about.map((a) => a.line).join('|') === 'Writes every quote by hand.'
      },
    'one that cites what was read is kept with what it rests on': async (w) => {
      const i = await interviewing(w)
      await i.allowMail()
      const out = await i.call('propose', quoting(i.mail))
      const flow = i.rows('Workflows')[0]
      return (
        !out.refused && String(flow?.values[i.field('Workflows', 'Rests on')]) === i.mail.join('\n')
      )
    },
  },
})

rule('I2', 'the report’s numbers come from code, or are marked estimated with their basis', {
  cases: {
    'how often is counted, how long is their answer, and hours a month is worked out': async (
      w,
    ) => {
      const i = await interviewing(w)
      await i.allowMail()
      const card = i.asked('How long does a quote take?', 'About 45 minutes each, in the evening.')
      const out = await i.call('propose', quoting(i.mail, { minutes: { answer: card } }))
      const f = i.rows('Workflows')[0]
      const prov = (name: string) => f?.provenance[i.field('Workflows', name)]
      return (
        !out.refused &&
        f?.values[i.field('Workflows', 'Times a month')] === 1 &&
        f?.values[i.field('Workflows', 'Minutes each')] === 45 &&
        f?.values[i.field('Workflows', 'Hours a month')] === 0.8 &&
        prov('Times a month')?.kind === 'computed' &&
        prov('Hours a month')?.kind === 'computed'
      )
    },
    'an estimate is kept as one, with what it rests on, and so is the hours it makes': async (
      w,
    ) => {
      const i = await interviewing(w)
      await i.allowMail()
      await i.call(
        'propose',
        quoting(i.mail, {
          minutes: { estimate: 30, basis: 'a kitchen quote usually takes half an hour' },
        }),
      )
      const f = i.rows('Workflows')[0]
      const p = f?.provenance[i.field('Workflows', 'Hours a month')]
      return p?.kind === 'estimated' && /half an hour/.test(p.basis ?? '')
    },
    'an answer that gives no minutes is not taken for some': async (w) => {
      const i = await interviewing(w)
      await i.allowMail()
      const card = i.asked('How long does a quote take?', 'Too long, honestly.')
      const out = await i.call('propose', quoting(i.mail, { minutes: { answer: card } }))
      return out.refused && /gives no minutes/.test(out.text)
    },
  },
})

rule('I3', 'a source the person has not connected, or turned off, is never read or cited', {
  cases: {
    'switched off, it is not read in a chat either': async (w) => {
      const i = await interviewing(w)
      await i.skipMail()
      const out = await i.call('source', { source: 'mail' })
      return (
        /turned off Mail: it is never read/.test(out.text) && !/mails in the last/.test(out.text)
      )
    },
    'switched off, nothing may cite it': async (w) => {
      const i = await interviewing(w)
      await i.skipMail()
      const out = await i.call('propose', quoting(i.mail))
      return out.refused && /skipped/.test(out.text)
    },
    'turned off, it is not read when Set up Alpha reads, and a draft citing it is left out': async (
      w,
    ) => {
      let given = ''
      const i = await storied(w, (_rows, prompt) => {
        given = prompt
        return {
          about: [{ line: 'Writes every quote by hand.', for: 'me', rests_on: i.mail }],
          workflows: [],
          questions: [],
        }
      })
      await i.read(['mail'])
      const v = await i.learned()
      const mail = i.rows('Interview sources').find((r) => Object.values(r.values).includes('Mail'))
      return (
        !/## Mail/.test(given) &&
        v.about.length === 0 &&
        Object.values(mail?.values ?? {}).includes('Skipped')
      )
    },
    'a source not allowed in Set up Alpha is never asked for on a card in a chat': async (w) => {
      const i = await interviewing(w)
      const out = await i.call('source', { source: 'mail' })
      return (
        out.refused &&
        /Set up Alpha/.test(out.text) &&
        w.world.cards.waiting(w.user.id).length === 0
      )
    },
  },
})

rule('I4', 'a line or proposal the person dropped or declined never comes back', {
  cases: {
    'a dropped About you line is not proposed again': async (w) => {
      const i = await interviewing(w)
      await i.allowMail()
      const line = { line: 'You write every quote yourself.', rests_on: i.mail }
      await i.call('propose', { about: { lines: [line], for: 'me' } })
      const card = w.world.cards.waiting(w.user.id).find((c) => c.kind === 'review')
      const reviews = new Reviews(w.world, null)
      const rows = reviews.view(card as NonNullable<typeof card>)?.rows ?? []
      reviews.choose(card?.id ?? '', [rows[0]?.id ?? ''], 'Dropped', {
        actor: i.person,
        user: w.user.id,
      })
      const out = await i.call('propose', { about: { lines: [line], for: 'me' } })
      return out.refused && /dropped or declined/.test(out.text)
    },
    'dropped in What I learned, a line is not drafted again': async (w) => {
      const i = await storied(w, (rows) => ({
        about: [{ line: 'Writes every quote by hand.', for: 'me', rests_on: rows }],
        workflows: [],
        questions: [],
      }))
      await i.read([])
      const first = await i.learned()
      await i.chapter('learned').act(i.input({ about: { drop: [first.about[0]?.id] } }))
      // read again: the same line drafted again stays out
      await i.read([])
      const v = await i.learned()
      return v.about.length === 1 && w.world.lines({ kinds: ['remembered'] }).length === 0
    },
    'a declined proposal is not played back again': async (w) => {
      const i = await interviewing(w)
      await i.allowMail()
      await i.call('propose', quoting(i.mail))
      const proposal = {
        proposal: {
          workflow: 'Writing quotes',
          kind: 'module',
          name: 'Quotes',
          does: 'Drafts each quote from the request mail.',
          rests_on: i.mail,
        },
      }
      await i.call('propose', proposal)
      i.answer('Not this')
      const out = await i.call('propose', proposal)
      return out.refused && /dropped or declined/.test(out.text)
    },
  },
})
