// Rules: as Settings › Permissions lists them, and the person's own
// acts on them: Revoke, and Approve or Dismiss on what Alpha noticed. A rule is made only on its
// Save card (cards.ts, the engine's answer).
import { z } from 'zod'
import { Refused } from '../../world/kinds.ts'
import { type Rule, type RuleSpec, SAVE_ANSWERS, SAVE_RULE } from '../../world/rules.ts'
import type { Ctx } from '../ctx.ts'
import { keptField, keptTable } from '../kept.ts'
import type { KeptTable, RuleView, WaitingRuleView } from '../types.ts'

export function registerRules(ctx: Ctx): void {
  const { app, world, user, live, asPerson } = ctx
  const { byWords } = ctx.views

  const whereOf = (s: Pick<RuleSpec, 'module' | 'schedule'>) =>
    s.module
      ? (world.shape.module(s.module)?.name ?? 'A module removed since')
      : (s.schedule ?? 'All of Alpha')

  const ruleOut = (r: Rule): RuleView => ({
    id: r.id,
    words: r.words,
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

  // as a table under Settings › Permissions: read here; a rule's page acts on it
  app.get(
    '/api/kept/rules',
    async (): Promise<KeptTable> =>
      keptTable(
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
        world.rules.list().map((r) => {
          const v = ruleOut(r)
          return {
            id: r.id,
            values: {
              rule: v.words,
              kind: v.kind === 'inferred' ? 'Noticed' : v.side === 'deny' ? 'Denied' : 'Allowed',
              where: v.where,
              made: v.madeAt,
              uses: v.uses,
              'last used': v.lastUsedAt,
              state: v.revokedAt ? 'Revoked' : 'Live',
            },
          }
        }),
        { editable: [], why: 'Open a rule to revoke it; its page asks first.' },
      ),
  )

  // The one standing choice at the top of Permissions: a rule like any other, that scripts may
  // reach any site, so it is listed, used and revoked as every rule is.
  const anySite = () =>
    world.rules.list().find((r) => {
      const { does, ...narrower } = r.covers
      return (
        r.side === 'allow' &&
        r.kind === 'approved' &&
        !r.revokedAt &&
        r.module === null &&
        r.schedule === null &&
        does.length === 1 &&
        does[0] === 'reach' &&
        Object.keys(narrower).length === 0
      )
    })
  app.get('/api/rules/any-site', async () => ({ on: !!anySite() }))
  app.post('/api/rules/any-site', async (req) => {
    if (user.role !== 'owner') throw new Refused('Only the owner can do that.')
    const { on } = z.object({ on: z.boolean() }).parse(req.body)
    const had = anySite()
    if (on && !had)
      world.rules.save(
        { side: 'allow', module: null, schedule: null, covers: { does: ['reach'] }, said: null },
        asPerson,
      )
    if (!on && had) world.rules.revoke(had.id, asPerson)
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
