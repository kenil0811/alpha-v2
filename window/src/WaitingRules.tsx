// Rules waiting on their Save card: a group in Settings › Rules, each rule as it would hold,
// with the tick and the cross (Approve and Decline).
// Both answer the card itself, by its yes and no as their words, so the rule, its journal line
// and its Always count come out as on the card. Nothing waiting: nothing shows.
import type { WaitingRuleView } from '@alpha/core/api'
import { Ban, Check } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { dayWords } from './time.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Info } from './ui/info.tsx'
import { List, Row } from './ui/list.tsx'
import { YesNo } from './ui/yes-no.tsx'

export function WaitingRules({
  version,
  onAnswered,
}: {
  version: number
  onAnswered?: () => void // the rules it holds read again
}) {
  const [rules, setRules] = useState<WaitingRuleView[] | null>(null)
  const load = useCallback(() => {
    api.get<WaitingRuleView[]>('/api/rules/waiting').then(setRules, () => setRules([]))
  }, [])
  const { busy, on, problem, act } = useAct(() => {
    load()
    onAnswered?.()
  })
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  if (!rules?.length) return null
  return (
    <section aria-label="Waiting for you" className="flex flex-col gap-2">
      <h3 className="flex h-9 items-center gap-1.5 font-medium text-ink text-md">
        Waiting for you
        <span className="font-normal text-ink-3 tabular-nums">{rules.length}</span>
        <Info help="Each rule here applies once you approve it." />
      </h3>
      <List>
        {rules.map((r) => (
          <Row
            key={r.card}
            lead={
              r.side === 'allow' ? (
                <Check className="size-3.5 shrink-0 text-good" />
              ) : (
                <Ban className="size-3.5 shrink-0 text-bad" />
              )
            }
            title={<span className="whitespace-normal font-normal">{r.words}</span>}
            sub={`${r.where} · Asked ${dayWords(r.askedAt)}`}
            actions={
              <>
                {on === r.card && <Refusal words={problem} />}
                <YesNo
                  value={null}
                  disabled={busy}
                  onChange={(a) =>
                    act(
                      () =>
                        api.post(`/api/cards/${r.card}`, { answer: a === 'yes' ? r.yes : r.no }),
                      r.card,
                    )
                  }
                />
              </>
            }
          />
        ))}
      </List>
    </section>
  )
}
