// Settings › Usage (Vikas, 23 Oct: "like superpenguin… monitor module wise and llm wise AI usage"):
// what Alpha's model use cost, and what for. The total and its pace on top; then by day, by model,
// by module and by agent, each a chart whose marks open what they count; the costliest replies and
// runs; and the prices it counts at. A reply's cost is the model's own; a run's is estimated from
// its tokens, and says so.
import type { UsageView } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { Arranged } from './arrange.tsx'
import { when } from './ModulesAndAgents.tsx'
import { Chart, type ChartKind, KindPicker } from './ui/chart.tsx'
import { Cut } from './ui/cut.tsx'
import { Empty, Section } from './ui/section.tsx'

export const usd = (n: number) =>
  n === 0
    ? '$0'
    : n < 0.01
      ? '<$0.01'
      : n.toLocaleString(undefined, {
          style: 'currency',
          currency: 'USD',
          currencyDisplay: 'narrowSymbol',
          maximumFractionDigits: 2,
        })
const tokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n)

// `agent`: only that agent's runs, as its Cost on the Agents list and its page opens it; this week
// first, as they show it
export function Usage({ version, agent = null }: { version: number; agent?: string | null }) {
  const [days, setDays] = useState<'7' | '30' | '90'>(agent ? '7' : '30')
  const [view, setView] = useState<UsageView | null | undefined>(undefined)
  useEffect(() => {
    if (version >= 0)
      api
        .get<UsageView>(`/api/usage?days=${days}${agent ? `&agent=${agent}` : ''}`)
        .then(setView, () => setView(null))
  }, [days, version, agent])
  if (view === undefined) return <p className="text-ink-3">Loading…</p>
  if (view === null) return <Empty>Usage could not be read just now.</Empty>
  const spent = view.days.filter((d) => d.chat + d.runs > 0).length
  const perDay = view.total / Number(days)
  const tiles = [
    { label: `Last ${days} days`, value: usd(view.total) },
    { label: 'A day, on average', value: usd(perDay) },
    { label: 'A month at this pace', value: usd(perDay * 30) },
    {
      label: 'Read from the cache',
      value: view.cacheShare === null ? '—' : `${Math.round(view.cacheShare * 100)}%`,
      tip: 'Of what the model read in, how much came from its cache, at a tenth of the price',
    },
  ]
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-ink-2 text-md">
          {spent
            ? `Alpha used the model on ${spent} of the last ${days} days.`
            : `Nothing used in the last ${days} days.`}
        </p>
        <div className="flex gap-1.5">
          {agent && (
            <Cut sel onClick={() => (window.location.hash = '#/settings/usage')}>
              {view.agents[0]?.name ?? 'One agent'} · Clear filters
            </Cut>
          )}
          {(['7', '30', '90'] as const).map((d) => (
            <Cut key={d} sel={days === d} onClick={() => setDays(d)}>
              {d} days
            </Cut>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            data-tip={t.tip}
            className="rounded-lg border border-line bg-surface px-4 py-3"
          >
            <div className="text-ink-3 text-sm">{t.label}</div>
            <div className="font-serif text-2xl tabular-nums">{t.value}</div>
          </div>
        ))}
      </div>

      <Section
        title="By day"
        about="Chat replies and agents' runs, stacked; hover a day for its figures."
      >
        <Days view={view} />
      </Section>

      <Arranged
        page="usage:charts"
        start={[['by-model', 'by-module']]}
        blocks={[
          {
            key: 'by-model',
            name: 'By model',
            node: (
              <Charted
                title="By model"
                about="What each model cost; a model marked ≈ counts some runs at its list price."
                kinds={['donut', 'bar']}
                marks={view.models.map((m) => ({
                  label: `${m.model}${m.estimated ? ' ≈' : ''}`,
                  n: m.usd,
                  href: '#/settings/model',
                }))}
              />
            ),
          },
          {
            key: 'by-module',
            name: 'By module',
            node: (
              <Charted
                title="By module"
                about="Chat with no module open counts as Conversation."
                kinds={['bar', 'donut']}
                marks={view.modules.map((m) => ({
                  label: m.name,
                  n: m.usd,
                  href: m.id ? `#/module/${m.id}` : '#/conversation',
                }))}
              />
            ),
          },
        ]}
      />

      <Section
        title="Tokens by model"
        about="What each model read and wrote; cache reads cost a tenth of fresh reading."
      >
        <div className="overflow-hidden rounded-lg border border-line bg-surface text-md">
          <div className="grid grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] gap-2 border-line border-b px-4 py-2 text-ink-3 text-sm">
            <span>Model</span>
            <span className="text-right">Read in</span>
            <span className="text-right">From cache</span>
            <span className="text-right">To cache</span>
            <span className="text-right">Written</span>
            <span className="text-right">Cost</span>
          </div>
          {view.models.map((m) => (
            <div
              key={m.model}
              className="grid grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] gap-2 border-hair border-b px-4 py-2 tabular-nums last:border-b-0"
            >
              <span className="truncate">{m.model}</span>
              <span className="text-right">{tokens(m.input)}</span>
              <span className="text-right">{tokens(m.cacheRead)}</span>
              <span className="text-right">{tokens(m.cacheWrite)}</span>
              <span className="text-right">{tokens(m.output)}</span>
              <span className="text-right font-medium">
                {m.estimated ? '≈ ' : ''}
                {usd(m.usd)}
              </span>
            </div>
          ))}
          {!view.models.length && <p className="px-4 py-3 text-ink-3">No model used yet.</p>}
        </div>
      </Section>

      <Arranged
        page="usage:lists"
        start={[['by-agent', 'costliest']]}
        blocks={[
          {
            key: 'by-agent',
            name: 'By agent',
            node: (
              <Section
                title="By agent"
                about="Each agent's runs, counted at the list price of the model they use."
              >
                <div className="flex flex-col rounded-lg border border-line bg-surface">
                  {view.agents.map((a) => (
                    <a
                      key={a.id ?? a.name}
                      href={a.id ? `#/agent/${a.id}` : '#/intelligence/agents'}
                      className="flex items-center gap-3 border-hair border-b px-4 py-2 text-md last:border-b-0 hover:bg-hover"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {a.name}
                        {a.module && <span className="text-ink-3 text-sm"> · {a.module}</span>}
                      </span>
                      <span className="text-ink-3 text-sm tabular-nums">
                        {a.runs} {a.runs === 1 ? 'run' : 'runs'} · {tokens(a.tokens)}
                      </span>
                      <span className="w-16 text-right font-medium tabular-nums">
                        ≈ {usd(a.usd)}
                      </span>
                    </a>
                  ))}
                  {!view.agents.length && (
                    <p className="px-4 py-3 text-ink-3 text-md">No agent used the model.</p>
                  )}
                </div>
              </Section>
            ),
          },
          {
            key: 'costliest',
            name: 'Costliest',
            node: (
              <Section
                title="Costliest"
                about="The replies and runs that cost the most; each opens where it happened."
              >
                <div className="flex flex-col rounded-lg border border-line bg-surface">
                  {view.costly.map((c) => (
                    <a
                      key={c.kind + c.id}
                      href={c.kind === 'run' ? `#/run/${c.id}` : '#/conversation'}
                      className="flex items-center gap-3 border-hair border-b px-4 py-2 text-md last:border-b-0 hover:bg-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1">{c.words}</span>
                        <span className="text-ink-3 text-sm">
                          {c.kind === 'run' ? 'Run' : 'Reply'} · {when(c.at)}
                          {c.module ? ` · ${c.module}` : ''} · {tokens(c.tokens)} tokens
                        </span>
                      </span>
                      <span className="w-16 text-right font-medium tabular-nums">
                        {c.kind === 'run' ? '≈ ' : ''}
                        {usd(c.usd)}
                      </span>
                    </a>
                  ))}
                </div>
              </Section>
            ),
          },
        ]}
      />

      <Section
        title="Prices"
        about="US dollars per million tokens, at list price; kept in the core's prices file."
      >
        <div className="overflow-hidden rounded-lg border border-line bg-surface text-md">
          {view.prices.map((p) => (
            <div
              key={p.model}
              className="grid grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] gap-2 border-hair border-b px-4 py-2 tabular-nums last:border-b-0"
            >
              <span className="truncate">
                {p.model}
                {p.model === view.desk && <span className="text-ink-3 text-sm"> · in use</span>}
              </span>
              <span className="text-right">${p.input} in</span>
              <span className="text-right">${p.output} out</span>
              <span className="text-right">${p.cache_read} cached</span>
              <span className="text-right">${p.cache_write} to cache</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function Charted({
  title,
  about,
  kinds,
  marks,
}: {
  title: string
  about: string
  kinds: ChartKind[]
  marks: { label: string; n: number; href: string }[]
}) {
  const [kind, setKind] = useState<ChartKind>(kinds[0] ?? 'bar')
  return (
    <Section title={title} about={about}>
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="mb-2 flex justify-end">
          <KindPicker kinds={kinds} kind={kind} onKind={setKind} />
        </div>
        {marks.length > 0 && <Chart kind={kind} marks={marks} fmt={usd} />}
      </div>
    </Section>
  )
}

// Each day a bar, chat under runs, its height the day's cost.
function Days({ view }: { view: UsageView }) {
  const most = Math.max(1e-9, ...view.days.map((d) => d.chat + d.runs))
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex h-36 items-end gap-0.5">
        {view.days.map((d) => (
          <div
            key={d.day}
            data-tip={`${new Date(d.day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: ${usd(d.chat + d.runs)} (chat ${usd(d.chat)}, runs ${usd(d.runs)})`}
            className="flex h-full min-w-0 flex-1 flex-col justify-end rounded-xs hover:bg-hover"
          >
            <span
              className="bg-accent opacity-50"
              style={{ height: `${(d.runs / most) * 100}%` }}
            />
            <span
              className="rounded-b-xs bg-accent"
              style={{ height: `${(d.chat / most) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-ink-3 text-xs">
        <span>
          {new Date(view.days[0]?.day ?? '').toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
          })}
        </span>
        <span className="flex gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-xs bg-accent" />
            Chat
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-xs bg-accent opacity-50" />
            Runs
          </span>
        </span>
        <span>Today</span>
      </div>
    </div>
  )
}
