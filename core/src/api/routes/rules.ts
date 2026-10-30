// Rules (core step 2): as Governance and Settings › Permissions list them, and the person's own
// acts on them: Revoke, and Approve or Dismiss on what Alpha noticed. A rule is made only on its
// Save card (cards.ts, the engine's answer).
import { z } from 'zod'
import { closeNoticedCard, type NoticedSpec } from '../../modules/governance.ts'
import { Refused } from '../../world/kinds.ts'
import { type Rule, type RuleSpec, SAVE_RULE } from '../../world/rules.ts'
import type { Ctx } from '../ctx.ts'
import { keptField, keptTable } from '../kept.ts'
import type { KeptTable, RuleView } from '../types.ts'

export function registerRules(ctx: Ctx): void {
  const { app, world, engine, user, live, asPerson } = ctx
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
    agent: r.agent ?? null,
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

  // the rules asked for and not saved yet: each waits on its Save card, shown greyed in Governance
  // with Approve (the card's Save), a module's and those of all of Alpha
  app.get('/api/rules/waiting', async (req): Promise<RuleView[]> => {
    const { module } = z.object({ module: z.string().optional() }).parse(req.query)
    return (
      world.cards
        .waiting()
        // a noticed rule's card stands for the rule Governance already lists with Approve
        .filter((c) => c.call?.tool === SAVE_RULE && !(c.call.input as NoticedSpec).noticed)
        .flatMap((c) => {
          const s = c.call?.input as RuleSpec
          if (module && s.module && s.module !== module) return []
          return [
            {
              id: c.id,
              words: world.rules.describe(s),
              said: s.said,
              side: s.side,
              kind: 'inferred' as const,
              where: s.module
                ? (world.shape.module(s.module)?.name ?? '')
                : (s.agent ?? 'All of Alpha'),
              module: s.module,
              agent: s.agent ?? null,
              madeBy: 'Alpha',
              madeAt: c.createdAt,
              uses: 0,
              lastUsedAt: null,
              revokedAt: null,
              always: false,
              noticedFrom: [],
              card: c.id,
            },
          ]
        })
    )
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

  // a rule waiting on its Save card, answered from Governance through the engine as on the card:
  // Approve is the card's Save, Decline its other answer
  app.post('/api/rules/waiting/:card/:act', async (req): Promise<{ ok: true }> => {
    const { card, act } = z
      .object({ card: z.string(), act: z.enum(['approve', 'decline']) })
      .parse(req.params)
    const c = world.cards.get(card)
    if (c?.call?.tool !== SAVE_RULE) throw new Refused('That rule is not waiting any more.')
    engine.answer(user, card, c.options[act === 'approve' ? 0 : 1] ?? 'No')
    live()
    return { ok: true }
  })

  for (const act of ['revoke', 'approve'] as const)
    app.post(`/api/rules/:id/${act}`, async (req): Promise<RuleView> => {
      const { id } = z.object({ id: z.string() }).parse(req.params)
      const r =
        act === 'approve' ? world.rules.approve(id, asPerson) : world.rules.revoke(id, asPerson)
      closeNoticedCard(world, id, asPerson.actor)
      live()
      return ruleOut(r)
    })
}
