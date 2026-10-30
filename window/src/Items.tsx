// A page for each agent, run and rule (item 50, 25 Oct; rules core step 2), so each can be linked
// to, reviewed and shared: #/agent/<id>, #/run/<id>, #/rule/<id>. Each is built from what the
// core already serves (/api/working, /api/activity, /api/rules) and comes again when the world
// changes, so a running run's steps arrive as they happen.

import type { AgentView, RuleView, RunView, UsageView, WorkingModuleView } from '@alpha/core/api'
import { type ReactNode, useEffect, useState } from 'react'
import { RunRow } from './Activity.tsx'
import { Blocked, costHref, lastRun, OnCell, RunsCell, resultWords } from './AgentList.tsx'
import { api } from './api.ts'
import { Arranged } from './arrange.tsx'
import { startAsk } from './ask.ts'
import { type Rule, RuleColumn, why } from './Module.tsx'
import { peek } from './Peek.tsx'
import { Record } from './Record.tsx'
import { dayWords } from './time.ts'
import { usd } from './Usage.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Confirm } from './ui/dialog.tsx'
import { List, Row } from './ui/list.tsx'
import { Section } from './ui/section.tsx'
import { UpdateNow } from './ui/update-now.tsx'
import { Words } from './ui/words.tsx'

export type ItemKind = 'agent' | 'run' | 'rule'

// The bar holds the way back (the crumb); the page names what the item is, then its title.
function Page({ kind, title, children }: { kind: string; title: string; children: ReactNode }) {
  return (
    <Record kind={kind}>
      <h1 className="font-serif text-2xl text-ink">{title}</h1>
      {children}
    </Record>
  )
}

// Facts about an item, a term and its value a line each.
function Facts({ lines }: { lines: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-4.5 py-3.5 text-md">
      {lines.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-ink-3">{term}</dt>
          <dd className="text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

// The module and agent a run or an agent belongs to, found among what does work on its own.
function findAgent(
  modules: WorkingModuleView[],
  pick: (m: WorkingModuleView, a: AgentView) => boolean,
) {
  for (const m of modules) for (const a of m.agents) if (pick(m, a)) return { module: m, agent: a }
  return null
}

function useLoaded<T>(path: string, version: number): T | null | undefined {
  const [data, setData] = useState<T | null | undefined>(undefined)
  useEffect(() => {
    if (version >= 0) api.get<T>(path).then(setData, () => setData(null))
  }, [path, version])
  return data
}

export function ItemPage({
  kind,
  id,
  version,
  onName,
}: {
  kind: ItemKind
  id: string
  version: number
  onName: (name: string) => void
}) {
  const working = useLoaded<WorkingModuleView[]>('/api/working', version)
  const runs = useLoaded<RunView[]>('/api/activity', version)
  const rules = useLoaded<RuleView[]>('/api/rules', version)
  // what the page is about, found before anything is drawn, so its name reaches the bar
  const agent = kind === 'agent' && working ? findAgent(working, (_, a) => a.id === id) : null
  const run = kind === 'run' ? runs?.find((r) => r.id === id) : undefined
  const rule = kind === 'rule' ? rules?.find((r) => r.id === id) : undefined
  const name = agent?.agent.name ?? run?.name ?? (rule ? 'A rule' : undefined)
  useEffect(() => {
    onName(name ?? '')
  }, [name, onName])
  const loaded = { agent: working, run: runs, rule: rules }[kind]
  if (loaded === undefined) return <Loading />
  if (agent)
    return (
      <AgentPage
        module={agent.module}
        agent={agent.agent}
        runs={(runs ?? []).filter(
          (r) => r.moduleId === agent.module.id && r.name === agent.agent.name,
        )}
        rules={(rules ?? []).filter(
          (r) =>
            !r.revokedAt &&
            r.agent === agent.agent.name &&
            (!r.module || r.module === agent.module.id),
        )}
      />
    )
  if (run) {
    const by = working
      ? findAgent(working, (m, a) => m.id === run.moduleId && a.name === run.name)
      : null
    return <RunPage run={run} agent={by?.agent ?? null} />
  }
  if (rule) return <RulePage rule={rule} />
  return <Gone what={{ agent: 'This agent', run: 'This run', rule: 'This rule' }[kind]} />
}

const Loading = () => <p className="p-6 text-ink-3">Loading…</p>
const Gone = ({ what }: { what: string }) => (
  <p className="p-6 text-ink-2">{what} is not there any more.</p>
)

// An agent, one level deeper (proposal 28 Oct §2 #3), read from its file and journal only: what
// it does, when (with its next run), where it works, its tools, its rules (§1 #1), its cost this
// week from Usage (§1 #4) and its runs. One never turned on shows Activate (§1 #3).
function AgentPage({
  module: m,
  agent: a,
  runs,
  rules,
}: {
  module: WorkingModuleView
  agent: AgentView
  runs: RunView[]
  rules: RuleView[]
}) {
  // what changes comes back through the world's next change, which loads the page again
  const { busy, problem, act } = useAct()
  const [cost, setCost] = useState<number | null>(null)
  useEffect(() => {
    api.get<UsageView>(`/api/usage?days=7&agent=${a.id}`).then(
      (u) => setCost(u.total),
      () => setCost(null),
    )
  }, [a.id])
  const tables = (ts: AgentView['reads']) =>
    ts.length
      ? ts.map((t, i) => (
          <span key={t.name}>
            {i > 0 && ', '}
            {t.id ? (
              <a href={`#/table/${t.id}`} className="hover:underline">
                {t.name}
              </a>
            ) : (
              t.name
            )}
          </span>
        ))
      : 'None'
  const line = (r: RuleView): Rule => ({
    key: r.id,
    words: r.words,
    why: why(r),
    href: `#/rule/${r.id}`,
    rule: r,
  })
  const ask = (side: string) => () =>
    startAsk(`From now on, when ${a.name} works in ${m.name}, ${side} `)
  return (
    <Page kind={`Agent in ${m.name}`} title={a.name}>
      <div className="flex flex-wrap items-center gap-2">
        <OnCell agent={a} />
        <UpdateNow
          at={lastRun(a)}
          busy={busy || a.running}
          tip={`Run ${a.name} now`}
          onClick={() => act(() => api.post(`/api/agents/${a.id}/run`))}
        />
        <Refusal words={problem} />
      </div>
      {a.blocked && (
        <div className="text-md">
          <Blocked agent={a} />
        </div>
      )}
      {/* each section a block the person moves and resizes, kept for every agent's page (Vikas, 30 Oct) */}
      <Arranged
        page="agent"
        start={[['does'], ['when'], ['works'], ['tools'], ['rules'], ['cost'], ['runs']]}
        blocks={[
          {
            key: 'does',
            name: 'What it does',
            node: (
              <Section title="What it does">
                {a.description && <p className="text-ink text-md">{a.description}</p>}
                {a.brief && (
                  <div className="text-ink-2 text-md">
                    <Words text={a.brief} />
                  </div>
                )}
              </Section>
            ),
          },
          {
            key: 'when',
            name: 'When',
            node: (
              <Section title="When">
                <Facts
                  lines={[
                    ...(a.schedule
                      ? ([['Runs', <RunsCell key="r" agent={a} />]] as [string, ReactNode][])
                      : []),
                    [
                      a.triggers.length === 1 ? 'Trigger' : 'Triggers',
                      a.triggers.length ? (
                        <span key="t" className="flex flex-col">
                          {a.triggers.map((t) => (
                            <span key={t.words}>
                              {t.words}
                              <span className="text-ink-3">
                                {' '}
                                · {t.on === 'time' ? 'on a time' : 'on an event'}
                              </span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        'When given a task'
                      ),
                    ],
                    ...(a.tasks && a.triggers.length
                      ? ([['Tasks', 'Also takes the tasks given to it']] as [string, ReactNode][])
                      : []),
                    [
                      'Next run',
                      a.running
                        ? 'Running now'
                        : a.state !== 'on'
                          ? 'Paused'
                          : a.nextRunAt
                            ? dayWords(a.nextRunAt)
                            : 'On its next event',
                    ],
                  ]}
                />
              </Section>
            ),
          },
          {
            key: 'works',
            name: 'Works in',
            node: (
              <Section title="Works in">
                <Facts
                  lines={[
                    [
                      'Module',
                      <a key="m" href={`#/module/${m.id}`} className="hover:underline">
                        {m.name}
                      </a>,
                    ],
                    ['Reads', tables(a.reads)],
                    ['Writes', tables(a.writes)],
                  ]}
                />
              </Section>
            ),
          },
          {
            key: 'tools',
            name: 'Tools',
            node: (
              <Section
                title="Tools"
                about="The gated calls it may make, and the connections it needs."
              >
                <Facts
                  lines={[
                    [
                      'Calls',
                      a.effects === null
                        ? 'Any, as its file names none'
                        : a.effects.length
                          ? a.effects.join(', ')
                          : 'None',
                    ],
                    ['Connections', a.connectors.length ? a.connectors.join(', ') : 'None'],
                  ]}
                />
              </Section>
            ),
          },
          {
            key: 'rules',
            name: 'Rules',
            node: (
              <Section
                title="Rules"
                about={`What ${a.name} may and may not do, held by the core. Anything else that changes your data or reaches someone, it asks you first.`}
              >
                <div className="@container">
                  <div className="grid items-start gap-6 @min-[600px]:grid-cols-2">
                    <RuleColumn
                      side="allowed"
                      rules={rules.filter((r) => r.side === 'allow').map(line)}
                      onChange={() => undefined}
                      onAdd={ask('you may')}
                    />
                    <RuleColumn
                      side="denied"
                      rules={rules.filter((r) => r.side === 'deny').map(line)}
                      onChange={() => undefined}
                      onAdd={ask('never')}
                    />
                  </div>
                </div>
              </Section>
            ),
          },
          {
            key: 'cost',
            name: 'Cost',
            node: (
              <Section
                title="Cost"
                about="Its runs in the last 7 days, as Settings › Usage counts them."
              >
                <a href={costHref(a.id)} className="w-fit text-ink text-md hover:underline">
                  {cost === null ? '…' : `≈ ${usd(cost)} this week`}
                </a>
              </Section>
            ),
          },
          {
            key: 'runs',
            name: 'Runs',
            node: (
              <Section title="Runs">
                {a.lastResult && (
                  <p className={a.lastResult.ok ? 'text-ink-2 text-md' : 'text-bad text-md'}>
                    Last result: {resultWords(a.lastResult)}
                  </p>
                )}
                {runs.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-line bg-surface">
                    {runs.map((r) => (
                      <RunRow
                        key={r.id}
                        run={r}
                        open={false}
                        onOpen={() => {
                          peek(`#/run/${r.id}`)
                        }}
                        onStop={() => act(() => api.post(`/api/runs/${r.id}/stop`))}
                      />
                    ))}
                  </div>
                )}
              </Section>
            ),
          },
        ]}
      />
    </Page>
  )
}

function RunPage({ run, agent }: { run: RunView; agent: AgentView | null }) {
  return (
    <Page kind="Run" title={run.name}>
      <Facts
        lines={[
          ...(agent
            ? ([
                [
                  'Agent',
                  <a key="a" href={`#/agent/${agent.id}`} className="hover:underline">
                    {agent.name}
                  </a>,
                ],
              ] as [string, ReactNode][])
            : []),
          ...(run.module && run.moduleId
            ? ([
                [
                  'Module',
                  <a key="m" href={`#/module/${run.moduleId}`} className="hover:underline">
                    {run.module}
                  </a>,
                ],
              ] as [string, ReactNode][])
            : []),
          ['Started', dayWords(run.startedAt)],
        ]}
      />
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <RunRow
          run={run}
          open
          onOpen={() => undefined}
          onStop={() => void api.post(`/api/runs/${run.id}/stop`)}
        />
      </div>
    </Page>
  )
}

// A rule: its words as code holds them, where it holds, where it came from and how often it was
// used. Revoke ends a rule of yours, after a yes; what Alpha noticed is approved or dismissed.
function RulePage({ rule: r }: { rule: RuleView }) {
  const [asking, setAsking] = useState(false)
  const { busy, problem, act } = useAct()
  const noticed = r.kind === 'inferred'
  return (
    <Page
      kind={noticed ? 'What Alpha noticed' : r.side === 'deny' ? 'Denied' : 'Allowed'}
      title={r.words}
    >
      <Facts
        lines={[
          ['Holds', r.where],
          [
            noticed ? 'Noticed' : r.always ? 'Given with Always' : 'Made by',
            `${r.madeBy}, ${dayWords(r.madeAt)}`,
          ],
          ...(r.said ? ([['Asked in', `“${r.said}”`]] as [string, ReactNode][]) : []),
          ...(r.noticedFrom.length
            ? ([
                [
                  'From',
                  <span key="from" className="flex flex-col">
                    {r.noticedFrom.map((l) => (
                      <span key={l.id}>
                        {dayWords(l.at)}: {l.words}
                      </span>
                    ))}
                  </span>,
                ],
              ] as [string, ReactNode][])
            : []),
          ['Used', r.uses === 1 ? 'once' : r.uses ? `${r.uses} times` : 'not yet'],
          ['Last used', r.lastUsedAt ? dayWords(r.lastUsedAt) : 'not yet'],
          ...(r.revokedAt
            ? ([[noticed ? 'Dismissed' : 'Revoked', dayWords(r.revokedAt)]] as [
                string,
                ReactNode,
              ][])
            : []),
        ]}
      />
      {!r.revokedAt && noticed && (
        <List>
          <Row
            title="Make it your rule"
            sub="Code holds it from then on, as if you had said it."
            actions={
              <Button size="sm" onClick={() => act(() => api.post(`/api/rules/${r.id}/approve`))}>
                Approve
              </Button>
            }
          />
          <Row
            title="Dismiss it"
            sub="Alpha stops following it; it stays listed as history."
            actions={
              <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>
                Dismiss
              </Button>
            }
          />
        </List>
      )}
      {!r.revokedAt && !noticed && (
        <List>
          <Row
            title="Revoke it"
            sub={r.side === 'deny' ? 'Alpha may do this again.' : 'Alpha asks you again each time.'}
            actions={
              <Button size="sm" variant="danger" onClick={() => setAsking(true)}>
                Revoke
              </Button>
            }
          />
        </List>
      )}
      <Confirm
        open={asking}
        title={noticed ? 'Dismiss this?' : 'Revoke this rule?'}
        yes={noticed ? 'Dismiss it' : 'Revoke it'}
        busy={busy}
        onClose={() => setAsking(false)}
        onYes={() => act(() => api.post(`/api/rules/${r.id}/revoke`)).then(() => setAsking(false))}
      >
        “{r.words}” {noticed ? 'Alpha stops following it.' : 'stops holding.'}
      </Confirm>
      <Refusal words={problem} />
    </Page>
  )
}
