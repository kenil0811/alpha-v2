// Rules (core step 2): as Governance and Settings › Permissions list them, and the person's own
// acts on them: Revoke, and Approve or Dismiss on what Alpha noticed. A rule is made only on its
// Save card (cards.ts, the engine's answer).
import { z } from 'zod'
import type { Rule } from '../../world/rules.ts'
import type { Ctx } from '../ctx.ts'
import { keptField, keptTable } from '../kept.ts'
import type { KeptTable, RuleView } from '../types.ts'

export function registerRules(ctx: Ctx): void {
  const { app, world, live, asPerson } = ctx
  const { byWords } = ctx.views

  const ruleOut = (r: Rule): RuleView => ({
    id: r.id,
    words: r.words,
    said: r.said,
    side: r.side,
    kind: r.kind,
    where: r.module
      ? (world.shape.module(r.module)?.name ?? 'A module removed since')
      : r.agent
        ? r.agent
        : 'All of Alpha',
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

  // as a table under Settings › Permissions (UI batch 2): read here; a rule's page acts on it
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

  for (const act of ['revoke', 'approve'] as const)
    app.post(`/api/rules/:id/${act}`, async (req): Promise<RuleView> => {
      const { id } = z.object({ id: z.string() }).parse(req.params)
      const r =
        act === 'approve' ? world.rules.approve(id, asPerson) : world.rules.revoke(id, asPerson)
      live()
      return ruleOut(r)
    })
}
