// Rules (design §7, core step 2, Kenil's yes 27 Oct): one store of allows and denies, each
// approved by the person or inferred by Alpha, scoped to all of Alpha, a module or an agent, and
// covering a call in parts code matches: what it does (read, change, remove, send, reach a site,
// sign in), through which tool, to which addresses, which sites, which tables. Only the person
// makes a rule approved (a wall). The gates check every call against the live rules before it
// runs (gates.ts). Standing permissions (design §12) are approved allow rules that cover exactly
// one agent's one kind of thing: one is granted only on a card that offered Always, and a card
// offers Always only after three unchanged yeses in a row for exactly that.
import type { Effect } from '@alpha/connector-sdk'
import { all, type Db, json, newId, now, one, parse, run, tx } from './db.ts'
import { append } from './journal.ts'
import { Refused } from './kinds.ts'
import type { Shape, WriteCtx } from './shape/index.ts'

export const DOES = ['read', 'change', 'remove', 'send', 'reach', 'sign_in'] as const
export type Does = (typeof DOES)[number]

// What a rule covers. Every part it names must match a call; what it leaves out matches any.
export interface Covers {
  does: Does[]
  through?: string[] // tools by name (change, gmail.send) or a connector (gmail)
  to?: { inside?: string[]; outside?: string[]; addresses?: string[] } // a send's recipients
  sites?: string[] // hosts, a site's own subdomains with it
  tables?: string[] // table ids
  always?: { action: string; place: Record<string, string> } // a standing permission's own cover
}

// A rule as Alpha's tool or a card proposes it, before it is kept.
export interface RuleSpec {
  side: 'allow' | 'deny'
  module: string | null
  agent: string | null
  covers: Covers
  said: string | null // the words it was asked in
}

export interface Rule extends RuleSpec {
  id: string
  words: string // what code holds, in code's own words
  kind: 'approved' | 'inferred'
  source: { card?: string | null; lines?: number[] }
  madeBy: string
  madeAt: string
  uses: number
  lastUsedAt: string | null
  revokedAt: string | null
}

// What a call is, as the rules read it.
export interface CallFacts {
  effect: Effect | undefined // undeclared counts as leaving the world
  tool: string
  to: string[]
  site: string | null
  table: string | null
  module: string | null
  agent: string | null
  own: boolean // the rows it writes or removes are the person's own
}

// What a yes or a standing permission covers: the action (send_email, file_from_mail), the agent
// and its module when an agent asks, and the place (a kind of message; a sender, a row and a kind).
export interface Covered {
  action: string
  agent: string | null
  module: string | null
  place: Record<string, string>
}

// The card a rule waits on: the person's Save makes it (the engine's answer, the desk's ask). Its
// answers by their meaning, never their place on the card, so no order turns a no into a Save
// (Batch B, pick 18).
export const SAVE_RULE = 'save_rule'
export const SAVE_ANSWERS = { yes: 'Save', no: 'Not now' } as const

// The yeses in a row that earn the offer of Always.
export const ALWAYS_AFTER = 3

// One key per thing covered, whatever order its place was written in.
export function keyOf(c: Covered): string {
  const place = Object.fromEntries(Object.entries(c.place).sort(([a], [b]) => a.localeCompare(b)))
  return JSON.stringify([c.action, c.agent, c.module, place])
}

interface RuleRow {
  id: string
  words: string
  said: string | null
  side: 'allow' | 'deny'
  kind: 'approved' | 'inferred'
  module_id: string | null
  agent: string | null
  covers: string
  source: string
  made_by: string
  made_at: string
  uses: number
  last_used_at: string | null
  revoked_at: string | null
}

const toRule = (r: RuleRow): Rule => ({
  id: r.id,
  words: r.words,
  said: r.said,
  side: r.side,
  kind: r.kind,
  module: r.module_id,
  agent: r.agent,
  covers: parse<Covers>(r.covers, { does: [] }),
  source: parse(r.source, {}),
  madeBy: r.made_by,
  madeAt: r.made_at,
  uses: r.uses,
  lastUsedAt: r.last_used_at,
  revokedAt: r.revoked_at,
})

const coveredOf = (r: Rule): Covered | null =>
  r.covers.always
    ? {
        action: r.covers.always.action,
        agent: r.agent,
        module: r.module,
        place: r.covers.always.place,
      }
    : null

// What a call does, in the rules' words.
export function doesOf(f: Pick<CallFacts, 'effect' | 'site'>): Does {
  switch (f.effect) {
    case 'read':
      return 'read'
    case 'write':
      return 'change'
    case 'remove':
      return 'remove'
    case 'sign_in':
      return 'sign_in'
    default:
      return f.site ? 'reach' : 'send'
  }
}

const domainOf = (address: string) => address.trim().toLowerCase().split('@').pop() ?? ''
const within = (host: string, d: string) => host === d || host.endsWith(`.${d}`)

// Whether a rule covers a call: every part it names matches.
// A send's recipients: a deny covers it when any one of them is one it names (a mixed send to the
// firm and outside is still outside), an allow only when every one is (Kenil's look, 27 Oct).
export function covers(
  r: Pick<Rule, 'side' | 'module' | 'agent' | 'covers'>,
  f: CallFacts,
): boolean {
  const c = r.covers
  if (c.always) return false // a standing permission covers its own one thing (covering)
  if (r.module && r.module !== f.module) return false
  if (r.agent && r.agent.toLowerCase() !== (f.agent ?? '').toLowerCase()) return false
  if (!c.does.includes(doesOf(f))) return false
  if (c.through?.length && !c.through.some((t) => f.tool === t || f.tool.startsWith(`${t}.`)))
    return false
  if (c.tables?.length && !(f.table && c.tables.includes(f.table))) return false
  if (c.sites?.length && !(f.site && c.sites.some((s) => within(f.site?.toLowerCase() ?? '', s))))
    return false
  const to = c.to
  if (to) {
    if (!f.to.length) return false
    const named = (address: string) => {
      const a = address.trim().toLowerCase()
      const d = domainOf(a)
      return (
        (!to.addresses?.length || to.addresses.includes(a)) &&
        (!to.inside?.length || to.inside.some((x) => within(d, x))) &&
        (!to.outside?.length || !to.outside.some((x) => within(d, x)))
      )
    }
    if (r.side === 'deny' ? !f.to.some(named) : !f.to.every(named)) return false
  }
  return true
}

const VERB: Record<Does, string> = {
  read: 'read',
  change: 'change',
  remove: 'delete',
  send: 'send',
  reach: 'open',
  sign_in: 'sign in',
}

const or = (xs: string[]) =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`

export class Rules {
  private db: Db
  private shape: Shape

  constructor(db: Db, shape: Shape) {
    this.db = db
    this.shape = shape
  }

  // A rule in code's own words: what it holds, never what the model said it holds.
  describe(s: Pick<RuleSpec, 'side' | 'module' | 'agent' | 'covers'>): string {
    const c = s.covers
    const tables = (c.tables ?? []).map((t) => this.shape.table(t)?.name ?? 'a table removed since')
    const what = c.does.map((d) => {
      const verb = VERB[d]
      if ((d === 'read' || d === 'change' || d === 'remove') && tables.length)
        return `${verb} rows in ${or(tables)}`
      if (d === 'reach') return `${verb} ${c.sites?.length ? or(c.sites) : 'sites'}`
      if (d === 'send') {
        const to = c.to?.addresses?.length
          ? ` to ${or(c.to.addresses)}`
          : c.to?.outside?.length
            ? ` to an address outside ${or(c.to.outside)}`
            : c.to?.inside?.length
              ? ` to addresses at ${or(c.to.inside)}`
              : ' anything'
        return `${verb}${to}`
      }
      return verb
    })
    const through = c.through?.length ? ` through ${or(c.through)}` : ''
    const module = s.module ? this.shape.module(s.module)?.name : null
    const where = module ? ` in ${module}` : s.agent ? '' : ', anywhere in Alpha'
    const who = s.agent ?? 'Alpha'
    return s.side === 'deny'
      ? `${who} must never ${or(what)}${through}${where}.`
      : `${who} may ${or(what)}${through}${where} without asking.`
  }

  // A rule as proposed, checked: something code can match, in tables and a module that are there.
  check(s: RuleSpec): RuleSpec {
    const does = [...new Set(s.covers.does)].filter((d) => (DOES as readonly string[]).includes(d))
    if (!does.length)
      throw new Refused(
        'A rule says what Alpha does: read, change, remove, send, reach a site or sign in. Words that say none of these are not a rule; keep them in the module’s notes.',
      )
    if (s.module && !this.shape.module(s.module)) throw new Refused('That module is not there.')
    for (const t of s.covers.tables ?? [])
      if (!this.shape.table(t)) throw new Refused('That table is not there.')
    const low = (xs: string[] | undefined): string[] =>
      (xs ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean)
    const out: Covers = { does: does as Does[] }
    const through = low(s.covers.through)
    if (through.length) out.through = through
    const sites = low(s.covers.sites)
    if (sites.length) out.sites = sites
    if (s.covers.tables?.length) out.tables = s.covers.tables
    const to: NonNullable<Covers['to']> = {}
    for (const k of ['inside', 'outside', 'addresses'] as const) {
      const xs = low(s.covers.to?.[k]).map((x) => (k === 'addresses' ? x : x.replace(/^\*?@/, '')))
      // a whole address, or a domain: never a pattern code would read as a name
      for (const x of xs)
        if (/[*\s]/.test(x) || (k === 'addresses') !== x.includes('@') || !x.includes('.'))
          throw new Refused(
            k === 'addresses'
              ? `${x} is not one whole address; for everyone at a domain give the domain in to_inside.`
              : `${x} is not a domain (example.com).`,
          )
      if (xs.length) to[k] = xs
    }
    if (Object.keys(to).length) out.to = to
    return { ...s, covers: out }
  }

  // Every rule, live ones first, newest first; or those of a module (and of all of Alpha).
  list(module?: string): Rule[] {
    return all<RuleRow>(
      this.db,
      `SELECT * FROM rules ${module ? 'WHERE module_id = ? OR module_id IS NULL' : ''}
       ORDER BY revoked_at IS NOT NULL, made_at DESC`,
      ...(module ? [module] : []),
    ).map(toRule)
  }

  get(id: string): Rule | undefined {
    const r = one<RuleRow>(this.db, 'SELECT * FROM rules WHERE id = ?', id)
    return r ? toRule(r) : undefined
  }

  private live(): Rule[] {
    return all<RuleRow>(this.db, 'SELECT * FROM rules WHERE revoked_at IS NULL').map(toRule)
  }

  // The live rules covering a call: an approved deny first, then an approved allow, then what
  // Alpha noticed.
  judge(f: CallFacts): { deny?: Rule; allow?: Rule; noticed?: Rule } {
    const hit = this.live().filter((r) => covers(r, f))
    const first = (kind: Rule['kind'], side: Rule['side']) =>
      hit.find((r) => r.kind === kind && r.side === side)
    const out: { deny?: Rule; allow?: Rule; noticed?: Rule } = {}
    const deny = first('approved', 'deny')
    const allow = first('approved', 'allow')
    const noticed = first('inferred', 'deny') ?? first('inferred', 'allow')
    if (deny) out.deny = deny
    if (allow) out.allow = allow
    if (noticed) out.noticed = noticed
    return out
  }

  // The approved rules in force where a turn or a run works, in their words, for the model.
  inForce(where: { module?: string | null; agent?: string | null } = {}): string[] {
    return this.live()
      .filter(
        (r) =>
          r.kind === 'approved' &&
          !r.covers.always &&
          (!r.module || !where.module || r.module === where.module) &&
          (!r.agent || !where.agent || r.agent.toLowerCase() === where.agent.toLowerCase()),
      )
      .map((r) => r.words)
  }

  private insert(
    s: RuleSpec,
    kind: Rule['kind'],
    words: string,
    source: Rule['source'],
    ctx: WriteCtx,
  ): Rule {
    const id = newId('rule')
    run(
      this.db,
      `INSERT INTO rules (id, words, said, side, kind, module_id, agent, covers, source, made_by,
         made_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      words,
      s.said,
      s.side,
      kind,
      s.module,
      s.agent,
      json(s.covers),
      json(source),
      `${ctx.actor.kind}${ctx.actor.id ? `:${ctx.actor.id}` : ''}`,
      now(),
    )
    return this.get(id) as Rule
  }

  // A rule the person saved on its card: approved. Only the person (a wall).
  save(spec: RuleSpec, ctx: WriteCtx & { card?: string | null }): Rule {
    if (ctx.actor.kind !== 'person') throw new Refused('Only the person makes a rule.')
    return tx(this.db, () => {
      const s = this.check(spec)
      const r = this.insert(s, 'approved', this.describe(s), { card: ctx.card ?? null }, ctx)
      append(this.db, {
        actor: ctx.actor,
        kind: 'rule_saved',
        words: `Made a rule: ${r.words}`,
        data: { rule: r.id },
        user: ctx.user ?? null,
        card: ctx.card ?? null,
        module: r.module,
      })
      return r
    })
  }

  // A rule Alpha noticed the person keeps to, from these lines: inferred, never approved.
  infer(spec: RuleSpec, lines: number[], ctx: WriteCtx): Rule {
    return tx(this.db, () => {
      const s = this.check(spec)
      const r = this.insert(s, 'inferred', this.describe(s), { lines }, ctx)
      append(this.db, {
        actor: ctx.actor,
        kind: 'rule_noticed',
        words: `Noticed a rule you keep to: ${r.words}`,
        data: { rule: r.id, lines },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        run: ctx.run ?? null,
        module: r.module,
      })
      return r
    })
  }

  // What Alpha noticed, made the person's own rule on their word.
  approve(id: string, ctx: WriteCtx): Rule {
    if (ctx.actor.kind !== 'person') throw new Refused('Only the person makes a rule.')
    return tx(this.db, () => {
      const r = this.get(id)
      if (!r || r.revokedAt) throw new Refused('That rule is not there.')
      if (r.kind === 'approved') return r
      run(this.db, "UPDATE rules SET kind = 'approved' WHERE id = ?", id)
      append(this.db, {
        actor: ctx.actor,
        kind: 'rule_saved',
        words: `Made a rule of what Alpha noticed: ${r.words}`,
        data: { rule: id },
        user: ctx.user ?? null,
        module: r.module,
      })
      return this.get(id) as Rule
    })
  }

  // A rule ended: revoked, or, for one Alpha noticed, dismissed. It stays listed as history.
  revoke(id: string, ctx: WriteCtx): Rule {
    if (ctx.actor.kind !== 'person') throw new Refused('Only the person revokes a rule.')
    return tx(this.db, () => {
      const r = this.get(id)
      if (!r) throw new Refused('That rule is not there.')
      if (r.revokedAt) return r
      run(
        this.db,
        'UPDATE rules SET revoked_at = ?, revoked_by = ? WHERE id = ?',
        now(),
        `person:${ctx.actor.id ?? ''}`,
        id,
      )
      const c = coveredOf(r)
      append(this.db, {
        actor: ctx.actor,
        kind: 'rule_revoked',
        words: `${r.kind === 'inferred' ? 'Dismissed what Alpha noticed' : 'Revoked a rule'}: ${r.words}`,
        data: { rule: id, ...(c ? { key: keyOf(c) } : {}) },
        user: ctx.user ?? null,
        module: r.module,
      })
      return this.get(id) as Rule
    })
  }

  // A rule let something through, or refused it: counted, and journaled.
  used(r: Rule, words: string, ctx: WriteCtx, refused = false): void {
    tx(this.db, () => {
      run(this.db, 'UPDATE rules SET uses = uses + 1, last_used_at = ? WHERE id = ?', now(), r.id)
      const c = coveredOf(r)
      append(this.db, {
        actor: ctx.actor,
        kind: refused ? 'refused' : 'allowed',
        words,
        data: { rule: r.id, ...(c ? { key: keyOf(c) } : {}) },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        run: ctx.run ?? null,
        module: r.module,
      })
    })
  }

  // A module or an agent removed: its rules go with it; the journal keeps them.
  removeScoped(where: { module?: string; agent?: string }, ctx: WriteCtx): number {
    const rules = this.list().filter(
      (r) =>
        (where.module && r.module === where.module) ||
        (where.agent && r.agent?.toLowerCase() === where.agent.toLowerCase()),
    )
    for (const r of rules) {
      run(this.db, 'DELETE FROM rules WHERE id = ?', r.id)
      append(this.db, {
        actor: ctx.actor,
        kind: 'rule_removed',
        words: `A rule went with ${where.module ? 'its module' : 'its agent'}: ${r.words}`,
        data: { rule: r.id },
        user: ctx.user ?? null,
        module: r.module,
      })
    }
    return rules.length
  }

  // Standing permissions: the live approved allow rule that covers exactly this, if any.
  covering(c: Covered): Rule | undefined {
    const key = keyOf(c)
    return this.live().find((r) => {
      const own = coveredOf(r)
      return r.side === 'allow' && r.kind === 'approved' && !!own && keyOf(own) === key
    })
  }

  // A person's answer on a card for something a permission could cover: yes or no, and whether
  // they changed it first (other words, another row). The count of Always starts here.
  decided(c: Covered, d: { yes: boolean; changed: boolean; card?: string | null }, ctx: WriteCtx) {
    append(this.db, {
      actor: ctx.actor,
      kind: 'decided',
      words: d.yes ? (d.changed ? 'Said yes, after a change.' : 'Said yes.') : 'Said no.',
      data: { key: keyOf(c), yes: d.yes, changed: d.changed },
      user: ctx.user ?? null,
      card: d.card ?? null,
      module: c.module,
    })
  }

  // Unchanged yeses in a row for exactly this, newest back: a no, a change or a revoke ends it.
  streak(c: Covered): number {
    const key = keyOf(c)
    const lines = all<{ kind: string; data: string }>(
      this.db,
      "SELECT kind, data FROM journal WHERE kind IN ('decided', 'revoked_permission', 'rule_revoked') ORDER BY id DESC LIMIT 200",
    )
    let n = 0
    for (const l of lines) {
      const d = parse<{ key?: string; yes?: boolean; changed?: boolean }>(l.data, {})
      if (d.key !== key) continue
      if (l.kind !== 'decided' || !d.yes || d.changed) break
      n++
    }
    return n
  }

  // Whether a card for this offers Always: enough unchanged yeses, and no permission yet.
  offers(c: Covered): boolean {
    return this.streak(c) >= ALWAYS_AFTER && !this.covering(c)
  }

  // Always: an approved allow rule for exactly what the yeses were for.
  grant(c: Covered, sentence: string, ctx: WriteCtx & { card?: string | null }): Rule {
    if (ctx.actor.kind !== 'person')
      throw new Refused('Only the person gives a standing permission.')
    return tx(this.db, () => {
      const had = this.covering(c)
      if (had) return had
      if (this.streak(c) < ALWAYS_AFTER)
        throw new Refused(
          `Always comes after ${ALWAYS_AFTER} yeses in a row without a change; this has ${this.streak(c)}.`,
        )
      const r = this.insert(
        {
          side: 'allow',
          module: c.module,
          agent: c.agent,
          covers: {
            does: [c.action === 'send_email' ? 'send' : 'change'],
            always: { action: c.action, place: c.place },
          },
          said: null,
        },
        'approved',
        sentence,
        { card: ctx.card ?? null },
        ctx,
      )
      append(this.db, {
        actor: ctx.actor,
        kind: 'granted_permission',
        words: `Gave a standing permission: ${sentence}`,
        data: { rule: r.id, key: keyOf(c) },
        user: ctx.user ?? null,
        card: ctx.card ?? null,
        module: c.module,
      })
      return r
    })
  }
}
