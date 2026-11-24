// Rules: as Settings › Rules lists them, and the person's own
// acts on them: Revoke, and Approve or Dismiss on what Alpha noticed. A rule is made only on its
// Save card (cards.ts, the engine's answer).
import { z } from 'zod'
import { asksBeforeSites, setAskBeforeSites } from '../../modules/runs/reach.ts'
import { Refused } from '../../world/kinds.ts'
import { type Rule, type RuleSpec, SAVE_ANSWERS, SAVE_RULE } from '../../world/rules.ts'
import type { Ctx } from '../ctx.ts'
import { keptField, keptTable } from '../kept.ts'
import type { KeptTable, RowLine, RuleView, WaitingRuleView } from '../types.ts'

export function registerRules(ctx: Ctx): void {
  const { app, world, user, live, asPerson } = ctx
  const { byWords } = ctx.views

  const whereOf = (s: Pick<RuleSpec, 'module' | 'schedule'>) =>
    s.module
      ? (world.shape.module(s.module)?.name ?? 'A module removed since')
      : (s.schedule ?? 'All of Alpha')

  const ruleOut = (r: Rule): RuleView => ({
    id: r.id,
    words: world.rules.describe(r), // with today's names: a renamed table says its new name
    said: r.said,
    side: r.side,
    kind: r.kind,
    where: whereOf(r),
    module: r.module,
    madeBy: byWords(r.madeBy),
    madeAt: r.madeAt,
    uses: r.uses,
    lastUsedAt: r.lastUsedAt,
    revokedAt: r.revokedAt,
    always: !!r.covers.always,
    noticedFrom: (r.source.lines ?? []).flatMap((id) => {
      const l = world.lineById(id)
      return l ? [{ id: l.id, at: l.at, words: l.words }] : []
    }),
  })

  // every rule, or a module's and those of all of Alpha
  app.get('/api/rules', async (req): Promise<RuleView[]> => {
    const { module } = z.object({ module: z.string().optional() }).parse(req.query)
    return world.rules.list(module).map(ruleOut)
  })

  // Rules waiting on their Save card: a module's and those of all of Alpha, or
  // every one; each answered through its own card, Approve with its yes and Decline with its no.
  app.get('/api/rules/waiting', async (req): Promise<WaitingRuleView[]> => {
    const { module } = z.object({ module: z.string().optional() }).parse(req.query)
    return world.cards.waiting(user.id).flatMap((c) => {
      if (c.call?.tool !== SAVE_RULE) return []
      const s = c.call.input as RuleSpec
      if (module && s.module && s.module !== module) return []
      return [
        {
          card: c.id,
          words: world.rules.describe(s),
          side: s.side,
          where: whereOf(s),
          askedAt: c.createdAt,
          ...SAVE_ANSWERS,
        },
      ]
    })
  })

  // A rule as one line of the list Permissions opens on: its sentence with today's names, what
  // it does, when and by whom it was made, how often it was used, and where it holds.
  const lineOf = (r: Rule, v: RuleView): RowLine => {
    const by = v.madeBy === 'You' ? 'you' : v.madeBy
    const kind = v.kind === 'inferred' ? 'Noticed' : v.side === 'deny' ? 'Denied' : 'Allowed'
    return {
      parts: world.rules.parts(r),
      light: [
        `${v.revokedAt ? 'Revoked' : kind} · made `,
        { at: v.madeAt },
        ` by ${by} · `,
        ...(v.uses === 0
          ? ['not used yet']
          : [
              `used ${v.uses === 1 ? 'once' : `${v.uses} times`}`,
              ...(v.lastUsedAt ? [', last ', { at: v.lastUsedAt }] : []),
            ]),
      ],
      chip: v.where,
      dim: !!v.revokedAt,
    }
  }

  // as a list of sentences under Settings › Rules, or a table: read here; a rule's page
  // acts on it
  app.get('/api/kept/rules', async (): Promise<KeptTable> => {
    const rules = world.rules.list().map((r) => ({ r, v: ruleOut(r) }))
    return keptTable(
      'rules',
      'Rules',
      [
        keptField('Rule', 'text'),
        keptField('Kind', 'choice', { Allowed: 'good', Denied: 'bad', Noticed: 'warn' }),
        keptField('Where', 'text'),
        keptField('Made', 'date'),
        keptField('Uses', 'number'),
        keptField('Last used', 'date'),
        keptField('State', 'choice', { Live: 'good', Revoked: 'bad' }),
      ],
      rules.map(({ v }) => ({
        id: v.id,
        values: {
          rule: v.words,
          kind: v.kind === 'inferred' ? 'Noticed' : v.side === 'deny' ? 'Denied' : 'Allowed',
          where: v.where,
          made: v.madeAt,
          uses: v.uses,
          'last used': v.lastUsedAt,
          state: v.revokedAt ? 'Revoked' : 'Live',
        },
      })),
      {
        editable: [],
        why: 'Open a rule to revoke it; its page asks first.',
        layout: 'list',
        lines: Object.fromEntries(rules.map(({ r, v }) => [r.id, lineOf(r, v)])),
      },
    )
  })

  // The one standing choice at the top of Permissions: whether agents and their scripts ask before
  // opening a site they were not shown and have not listed. Off on a fresh install.
  app.get('/api/rules/ask-before-sites', async () => ({ on: asksBeforeSites(world) }))
  app.post('/api/rules/ask-before-sites', async (req) => {
    if (user.role !== 'owner') throw new Refused('Only the owner can do that.')
    const { on } = z.object({ on: z.boolean() }).parse(req.body)
    setAskBeforeSites(world, on, asPerson)
    live()
    return { on }
  })

  for (const act of ['revoke', 'approve'] as const)
    app.post(`/api/rules/:id/${act}`, async (req): Promise<RuleView> => {
      const { id } = z.object({ id: z.string() }).parse(req.params)
      const r =
        act === 'approve' ? world.rules.approve(id, asPerson) : world.rules.revoke(id, asPerson)
      live()
      return ruleOut(r)
    })
}
