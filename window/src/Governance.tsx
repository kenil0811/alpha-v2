// Governance (Vikas, 29 Oct): what agents can do and cannot do, and nothing else: two columns, Can
// do and Cannot do, of the rules the core holds and enforces (design §7). A rule the person
// approved is solid; one waiting on their approval (noticed by Alpha, or asked for and not saved
// on its card yet) is greyed on a dotted ground with Approve. Rules for one agent sit under its
// name. A rule is added with New (empty) or Add (at the column's heading), and its words changed
// with a double-click: the words go to Alpha, whose rule tool opens the Save card (a rule is made
// only there, a wall); words code cannot match go to the module's notes instead. Figures, counts and connection states are not rules and are not here.
import type { ModuleView, RuleView } from '@alpha/core/api'
import { Ban, Check } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { showAsk } from './ask.ts'
import { dayWords } from './time.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Confirm } from './ui/dialog.tsx'
import { EntryList } from './ui/entry-list.tsx'
import { Section } from './ui/section.tsx'

type Side = RuleView['side']

const SIDES: { side: Side; title: string; icon: typeof Check; tone: string; lead: string }[] = [
  { side: 'allow', title: 'Can do', icon: Check, tone: 'text-good', lead: 'may' },
  { side: 'deny', title: 'Cannot do', icon: Ban, tone: 'text-bad', lead: 'must never' },
]

// A module's governance; with no module, every rule across Alpha (Settings › Governance).
export function GovernanceSection({ module, version = 0 }: { module?: string; version?: number }) {
  const [rules, setRules] = useState<RuleView[] | null>(null)
  const [m, setM] = useState<ModuleView | null>(null)
  const load = useCallback(() => {
    const q = module ? `?module=${encodeURIComponent(module)}` : ''
    Promise.all([
      api.get<RuleView[]>(`/api/rules${q}`),
      api.get<RuleView[]>(`/api/rules/waiting${q}`).catch(() => []),
      module ? api.get<ModuleView>(`/api/modules/${module}`) : Promise.resolve(null),
    ]).then(
      ([kept, waiting, mod]) => {
        setM(mod)
        // an agent's rule shows in its own module only
        const ours = (r: RuleView) => !mod || !r.agent || mod.agents.some((a) => a.name === r.agent)
        setRules([...waiting, ...kept.filter((r) => !r.revokedAt)].filter(ours))
      },
      () => setRules([]),
    )
  }, [module])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])

  return (
    <Section
      title={module ? 'Governance' : 'Can and cannot do'}
      about="What agents can and cannot do here, held by the core. Solid rules are yours; greyed ones wait for your approval. Anything else that changes your data or reaches someone, Alpha asks first."
    >
      {rules && (
        <div className="@container">
          <div className="grid items-start gap-6 @min-[560px]:grid-cols-2">
            {SIDES.map((s) => (
              <Column
                key={s.side}
                {...s}
                rules={rules.filter((r) => r.side === s.side)}
                m={m}
                onChange={load}
              />
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

// One column: its rules grouped where they hold (the module or Alpha first, then each agent), kept
// as every list is (ui/entry-list.tsx): New when empty, Add at the heading's right, ✕ on a hover
// (Revoke or Decline, asked first: a rule has no undo), a double-click to change one's words. A
// rule is made only on its Save card (a wall), so what is typed goes to Alpha in words.
function Column({
  side,
  title,
  icon: Icon,
  tone,
  lead,
  rules,
  m,
  onChange,
}: (typeof SIDES)[number] & { rules: RuleView[]; m: ModuleView | null; onChange: () => void }) {
  const { busy, on, problem, act } = useAct(onChange)
  const [asking, setAsking] = useState<RuleView | null>(null)
  const sorted = [...rules].sort((a, b) => Number(!!a.agent) - Number(!!b.agent))
  const approved = rules.filter((r) => r.kind === 'approved' && !r.card).length
  // words to Alpha, whose rule tool opens the Save card in the assistant
  const say = (words: string) =>
    act(async () => {
      await api.post('/api/say', { words, ...(m ? { from: m.id } : {}) })
      showAsk()
    }, 'new')
  const rule = (w: string) => `Alpha ${lead} ${w}`
  const approve = (r: RuleView) =>
    act(
      () =>
        r.card
          ? api.post(`/api/rules/waiting/${r.card}/approve`)
          : api.post(`/api/rules/${r.id}/approve`),
      r.id,
    )
  const drop = (r: RuleView) =>
    act(
      () =>
        r.card
          ? api.post(`/api/rules/waiting/${r.card}/decline`)
          : api.post(`/api/rules/${r.id}/revoke`),
      r.id,
    ).then(() => setAsking(null))
  const pending = asking ? waits(asking) : false
  return (
    <section aria-label={title} className="flex min-w-0 flex-col">
      <EntryList
        head={
          <>
            <Icon className={cn('size-3.5', tone)} />
            {title}
            {approved > 0 && (
              <span className="font-normal text-ink-3 tabular-nums">{approved}</span>
            )}
          </>
        }
        items={sorted}
        idOf={(r) => r.id}
        textOf={(r) => r.words.replace(new RegExp(`^Alpha ${lead}\\s+`, 'i'), '')}
        groupOf={(r) => r.agent ?? r.where}
        waits={waits}
        placeholder={side === 'allow' ? 'Type what agents can do' : 'Type what agents cannot do'}
        removeLabel={(r) => (waits(r) ? 'Decline' : 'Revoke')}
        line={(r) => (
          <>
            {r.card ? (
              <span className="text-md">{r.words}</span>
            ) : (
              <a href={`#/rule/${r.id}`} className="text-md hover:underline">
                {r.words}
              </a>
            )}
            <span className="text-ink-3 text-sm">
              {r.card
                ? `Asked ${dayWords(r.madeAt)}; needs approval`
                : r.kind === 'inferred'
                  ? `Alpha noticed, ${dayWords(r.madeAt)}; needs approval`
                  : `${r.always ? 'You said Always' : 'You approved'}, ${dayWords(r.madeAt)}${r.module ? '' : '; across Alpha'}`}
            </span>
            {on === r.id && <Refusal words={problem} />}
          </>
        )}
        after={(r) =>
          waits(r) && (
            <Button size="sm" disabled={busy} onClick={() => void approve(r)}>
              Approve
            </Button>
          )
        }
        onAdd={(w) => say(`A rule${m ? ` for ${m.name}` : ''}: ${rule(w)}`)}
        onEdit={(r, w) =>
          say(`Change the rule${m ? ` for ${m.name}` : ''} “${r.words}” to: ${rule(w)}`)
        }
        onRemove={setAsking}
      />
      {on === 'new' && <Refusal words={problem} />}
      <Confirm
        open={!!asking}
        title={pending ? 'Decline this rule?' : 'Revoke this rule?'}
        yes={pending ? 'Decline it' : 'Revoke it'}
        busy={busy}
        onClose={() => setAsking(null)}
        onYes={() => asking && void drop(asking)}
      >
        “{asking?.words}” {pending ? 'will not hold.' : 'stops holding.'}
      </Confirm>
    </section>
  )
}

const waits = (r: RuleView) => !!r.card || r.kind === 'inferred'
