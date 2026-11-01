// Rules waiting on their Save card (Batch B, pick 18, Kenil's call 9): a group in a module's
// Governance and in Settings › Permissions, each rule as it would hold, with Approve and Decline.
// Both answer the card itself, by its yes and no as their words, so the rule, its journal line
// and its Always count come out as on the card. Nothing waiting: nothing shows.
import type { WaitingRuleView } from '@alpha/core/api'
import { Ban, Check } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { dayWords } from './time.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { List, Row } from './ui/list.tsx'

export function WaitingRules({
  module,
  version,
  onAnswered,
}: {
  module?: string // a module's and those of all of Alpha; none: every one
  version: number
  onAnswered?: () => void // the rules it holds read again
}) {
  const [rules, setRules] = useState<WaitingRuleView[] | null>(null)
  const load = useCallback(() => {
    const q = module ? `?module=${encodeURIComponent(module)}` : ''
    api.get<WaitingRuleView[]>(`/api/rules/waiting${q}`).then(setRules, () => setRules([]))
  }, [module])
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
            sub={`${r.where} · Alpha asked ${dayWords(r.askedAt)}; it holds once you approve it`}
            actions={
              <>
                {on === r.card && <Refusal words={problem} />}
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    act(() => api.post(`/api/cards/${r.card}`, { answer: r.no }), r.card)
                  }
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy}
                  onClick={() =>
                    act(() => api.post(`/api/cards/${r.card}`, { answer: r.yes }), r.card)
                  }
                >
                  Approve
                </Button>
              </>
            }
          />
        ))}
      </List>
    </section>
  )
}
