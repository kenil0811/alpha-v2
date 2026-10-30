// Governance (Vikas, 29 Oct): what agents can do and cannot do, and nothing else: two columns, Can
// do and Cannot do, of the rules the core holds and enforces (design §7). A rule the person
// approved is solid; one waiting on their approval (noticed by Alpha, or asked for and not saved
// on its card yet) is greyed on a dotted ground with Approve. Rules for one agent sit under its
// name. A rule is added by typing it at the foot of a column: the words go to Alpha, whose rule
// tool opens the Save card (a rule is made only there, a wall); words code cannot match go to the
// module's notes instead. Figures, counts and connection states are not rules and are not here.
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
import { More } from './ui/more.tsx'
import { MenuItem } from './ui/popover.tsx'
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

// One column: its rules grouped where they hold (the module or Alpha first, then each agent), then
// a line to type a new one.
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
  const groups = new Map<string, RuleView[]>()
  for (const r of [...rules].sort((a, b) => Number(!!a.agent) - Number(!!b.agent)))
    groups.set(r.agent ?? r.where, [...(groups.get(r.agent ?? r.where) ?? []), r])
  const approved = rules.filter((r) => r.kind === 'approved' && !r.card).length
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h3 className="flex h-9 items-center gap-1.5 border-line border-b font-medium text-ink text-md">
        <Icon className={cn('size-3.5', tone)} />
        {title}
        {approved > 0 && <span className="font-normal text-ink-3 tabular-nums">{approved}</span>}
      </h3>
      {[...groups].map(([where, list]) => (
        <div key={where} className="flex flex-col gap-1.5">
          {groups.size > 1 && <div className="pt-1 text-ink-3 text-sm">{where}</div>}
          {list.map((r) => (
            <RuleLine key={r.id} r={r} onChange={onChange} />
          ))}
        </div>
      ))}
      <TypeRule lead={lead} m={m} side={side} />
    </section>
  )
}

const waits = (r: RuleView) => !!r.card || r.kind === 'inferred'

// A rule: solid when approved; greyed on dots, with Approve, while it waits.
function RuleLine({ r, onChange }: { r: RuleView; onChange: () => void }) {
  const { busy, problem, act } = useAct(onChange)
  const [asking, setAsking] = useState(false)
  const pending = waits(r)
  const approve = () =>
    act(() =>
      r.card
        ? api.post(`/api/rules/waiting/${r.card}/approve`)
        : api.post(`/api/rules/${r.id}/approve`),
    )
  const drop = () =>
    act(() =>
      r.card
        ? api.post(`/api/rules/waiting/${r.card}/decline`)
        : api.post(`/api/rules/${r.id}/revoke`),
    ).then(() => setAsking(false))
  return (
    <div
      data-waits={pending || undefined}
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2',
        pending
          ? 'border-line border-dashed text-ink-3 [background-image:radial-gradient(var(--line)_1px,transparent_0)] [background-size:6px_6px]'
          : 'border-line bg-surface text-ink',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
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
        <Refusal words={problem} />
      </span>
      {pending && (
        <Button size="sm" disabled={busy} onClick={() => void approve()}>
          Approve
        </Button>
      )}
      <More label="More" disabled={busy}>
        {(close) => (
          <MenuItem
            danger={!pending}
            onClick={() => {
              close()
              setAsking(true)
            }}
          >
            {pending ? 'Decline' : 'Revoke'}
          </MenuItem>
        )}
      </More>
      <Confirm
        open={asking}
        title={pending ? 'Decline this rule?' : 'Revoke this rule?'}
        yes={pending ? 'Decline it' : 'Revoke it'}
        busy={busy}
        onClose={() => setAsking(false)}
        onYes={() => void drop()}
      >
        “{r.words}” {pending ? 'will not hold.' : 'stops holding.'}
      </Confirm>
    </div>
  )
}

// The foot of a column: a rule typed in words goes to Alpha, which opens its Save card in the
// assistant; it shows here greyed until saved.
function TypeRule({ lead, m, side }: { lead: string; m: ModuleView | null; side: Side }) {
  const [words, setWords] = useState('')
  const { busy, problem, act } = useAct()
  const send = () => {
    const w = words.trim()
    if (!w) return
    void act(async () => {
      await api.post('/api/say', {
        words: `A rule${m ? ` for ${m.name}` : ''}: Alpha ${lead} ${w}`,
        ...(m ? { from: m.id } : {}),
      })
      setWords('')
      showAsk()
    })
  }
  return (
    <div className="flex flex-col">
      <input
        value={words}
        disabled={busy}
        aria-label={side === 'allow' ? 'Type what agents can do' : 'Type what agents cannot do'}
        placeholder={side === 'allow' ? 'Type what agents can do…' : 'Type what agents cannot do…'}
        onChange={(e) => setWords(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') send()
          if (e.key === 'Escape') setWords('')
        }}
        className="h-8 border-hair border-b bg-transparent text-ink text-md outline-none placeholder:text-ink-3 focus:border-accent"
      />
      <Refusal words={problem} />
    </div>
  )
}
