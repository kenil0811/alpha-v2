// Governance (Vikas, 29 Oct): what agents can do and cannot do, and nothing else: two columns, Can
// do and Cannot do, of the rules the core holds and enforces (design §7). A rule the person
// approved is solid; one waiting on their approval (noticed by Alpha, or asked for and not saved
// on its card yet) is greyed on a dotted ground with Approve. Rules for one agent sit under its
// name. A rule is added with New (empty) or Add (at the column's heading), and its words changed
// with a double-click: the words go to Alpha, whose rule tool opens the Save card (a rule is made
// only there, a wall); words code cannot match go to the module's notes instead. Figures, counts and connection states are not rules and are not here.
import type { ModuleView, RuleView, Stream, StreamLine } from '@alpha/core/api'
import { Ban, Check } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.ts'
import { showAsk } from './ask.ts'
import { Paged } from './Overview.tsx'
import { dayWords } from './time.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Confirm } from './ui/dialog.tsx'
import { EntryList } from './ui/entry-list.tsx'
import { Section } from './ui/section.tsx'

type Side = RuleView['side']

// Words sent to Alpha from a column, shown greyed at once until Alpha answers: its Save card then
// stands in their place; a turn that ends without one (a question, a refusal) says so, never
// leaving the words to vanish (Vikas, 30 Oct: "once I add a point there is no way to add a second").
export interface Sent {
  turn: string // the said line's id, which every line of Alpha's answer carries
  words: string
  side: Side
  at: string
  answer: string | null // the turn ended without a Save card: what Alpha said instead
}

const ENDS = new Set(['replied', 'error', 'limit'])

// What is still to show of the words sent, given the lines since and the Save cards waiting.
export function settle(sent: Sent[], lines: StreamLine[], cards: Set<string>): Sent[] {
  return sent.flatMap((s) => {
    if (s.answer !== null) return [s]
    const ours = lines.filter((l) => l.turn === s.turn)
    if (ours.some((l) => l.kind === 'card_opened' && l.card && cards.has(l.card))) return []
    const end = ours.findLast((l) => ENDS.has(l.kind))
    if (!end) return [s]
    return [
      {
        ...s,
        answer:
          end.kind === 'replied' ? 'Alpha answered in the assistant; not a rule yet' : end.words,
      },
    ]
  })
}

const SIDES: { side: Side; title: string; icon: typeof Check; tone: string; lead: string }[] = [
  { side: 'allow', title: 'Can do', icon: Check, tone: 'text-good', lead: 'may' },
  { side: 'deny', title: 'Cannot do', icon: Ban, tone: 'text-bad', lead: 'must never' },
]

// A module's governance; with no module, every rule across Alpha (Settings › Governance).
export function GovernanceSection({
  module,
  version = 0,
  title = module ? 'Governance' : 'Can and cannot do',
  small,
}: {
  module?: string
  version?: number
  title?: ReactNode
  small?: boolean // a card on Home or an Overview: sized as the Agents card beside it (Vikas, 30 Oct)
}) {
  const [rules, setRules] = useState<RuleView[] | null>(null)
  const [m, setM] = useState<ModuleView | null>(null)
  // ponytail: kept in this view only; leaving the page drops it (the conversation keeps the words)
  const [sent, setSent] = useState<Sent[]>([])
  const sentNow = useRef(sent)
  sentNow.current = sent
  const load = useCallback(() => {
    const q = module ? `?module=${encodeURIComponent(module)}` : ''
    const open = sentNow.current.filter((s) => s.answer === null)
    const first = Math.min(...open.map((s) => Number(s.turn)))
    Promise.all([
      api.get<RuleView[]>(`/api/rules${q}`),
      api.get<RuleView[]>(`/api/rules/waiting${q}`).catch(() => []),
      module ? api.get<ModuleView>(`/api/modules/${module}`) : Promise.resolve(null),
      open.length ? api.get<Stream>(`/api/stream?after=${first}`).catch(() => null) : null,
    ]).then(
      ([kept, waiting, mod, stream]) => {
        setM(mod)
        if (stream) {
          const cards = new Set(waiting.flatMap((r) => (r.card ? [r.card] : [])))
          setSent((now) => settle(now, stream.lines, cards))
        }
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
      small={small}
      title={title}
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
                sent={sent.filter((x) => x.side === s.side)}
                onSent={(x) => {
                  // the reload that follows reads it at once
                  sentNow.current = [...sentNow.current, x]
                  setSent(sentNow.current)
                }}
                onForget={(turn) => setSent((now) => now.filter((x) => x.turn !== turn))}
                m={m}
                onChange={load}
                small={small}
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
  sent,
  onSent,
  onForget,
  m,
  onChange,
  small,
}: (typeof SIDES)[number] & {
  small?: boolean | undefined
  rules: RuleView[]
  sent: Sent[]
  onSent: (s: Sent) => void
  onForget: (turn: string) => void
  m: ModuleView | null
  onChange: () => void
}) {
  const { busy, on, problem, act } = useAct(onChange)
  const [asking, setAsking] = useState<RuleView | null>(null)
  const sorted: Entry[] = [
    ...sent.map((x) => asEntry(x, m)),
    ...[...rules].sort((a, b) => Number(!!a.agent) - Number(!!b.agent)),
  ]
  const approved = rules.filter((r) => r.kind === 'approved' && !r.card).length
  // words to Alpha, whose rule tool opens the Save card in the assistant
  // words to Alpha, whose rule tool opens the Save card in the assistant; until it does, the words
  // show here greyed, Waiting for Alpha
  const say = (words: string, shown: string) =>
    act(async () => {
      const { turn } = await api.post<{ turn: string }>('/api/say', {
        words,
        ...(m ? { from: m.id } : {}),
      })
      onSent({ turn, words: shown, side, at: new Date().toISOString(), answer: null })
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
  const list = (items: Entry[]) => (
    <EntryList
      small={small}
      head={
        <>
          <Icon className={cn('size-3.5', tone)} />
          {title}
          {approved > 0 && <span className="font-normal text-ink-3 tabular-nums">{approved}</span>}
        </>
      }
      items={items}
      idOf={(r) => r.id}
      textOf={(r) => r.words.replace(new RegExp(`^Alpha ${lead}\\s+`, 'i'), '')}
      groupOf={(r) => r.agent ?? r.where}
      waits={waits}
      placeholder={side === 'allow' ? 'Type what agents can do' : 'Type what agents cannot do'}
      removeLabel={(r) => (r.sent ? 'Dismiss' : waits(r) ? 'Decline' : 'Revoke')}
      line={(r) =>
        r.sent ? (
          <>
            <span className={small ? 'text-sm' : 'text-md'}>{r.words}</span>
            <span className="text-ink-3 text-sm">{r.sent.answer ?? 'Waiting for Alpha…'}</span>
          </>
        ) : (
          <>
            {r.card ? (
              <span className={small ? 'text-sm' : 'text-md'}>{r.words}</span>
            ) : (
              <a
                href={`#/rule/${r.id}`}
                className={small ? 'text-sm hover:underline' : 'text-md hover:underline'}
              >
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
        )
      }
      after={(r) =>
        r.sent
          ? r.sent.answer !== null && (
              <Button size="sm" onClick={showAsk}>
                Open
              </Button>
            )
          : waits(r) && (
              <Button size="sm" disabled={busy} onClick={() => void approve(r)}>
                Approve
              </Button>
            )
      }
      onAdd={(w) => say(`A rule${m ? ` for ${m.name}` : ''}: ${rule(w)}`, rule(w))}
      onEdit={(r, w) =>
        say(`Change the rule${m ? ` for ${m.name}` : ''} “${r.words}” to: ${rule(w)}`, rule(w))
      }
      onRemove={(r) => (r.sent ? onForget(r.sent.turn) : setAsking(r))}
    />
  )
  const pending = asking ? waits(asking) : false
  return (
    <section aria-label={title} className="flex min-w-0 flex-col">
      {/* in a card five rules a page, then the pager (Vikas, 1 Nov: no long scroll) */}
      {small ? <Paged items={sorted}>{list}</Paged> : list(sorted)}
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

const waits = (r: Entry) => !!r.sent || !!r.card || r.kind === 'inferred'

// a rule, or words sent and not a rule yet
type Entry = RuleView & { sent?: Sent }
const asEntry = (s: Sent, m: ModuleView | null): Entry => ({
  id: `sent-${s.turn}`,
  words: s.words,
  said: s.words,
  side: s.side,
  kind: 'inferred',
  where: m?.name ?? 'All of Alpha',
  module: m?.id ?? null,
  agent: null,
  madeBy: 'You',
  madeAt: s.at,
  uses: 0,
  lastUsedAt: null,
  revokedAt: null,
  always: false,
  noticedFrom: [],
  sent: s,
})
