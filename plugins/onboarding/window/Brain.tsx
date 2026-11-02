// About you in Intelligence › Second Brain (Kenil's call 2 Nov): what Alpha learned and the person
// kept or has yet to decide, always one click away, and the way to onboarding's page.
import { Button, Empty, go, List, Section, wordsOf } from '@alpha/window/kit'
import { useCallback, useEffect, useState } from 'react'
import type { AboutRow } from './Page.tsx'
import { AboutLine } from './Results.tsx'
import { onboarding } from './routes.ts'

export function AboutYou() {
  const [rows, setRows] = useState<AboutRow[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const load = useCallback(() => {
    onboarding.get<AboutRow[]>('/about').then(setRows, (err) => setProblem(wordsOf(err)))
  }, [])
  useEffect(load, [])
  const lines = (rows ?? []).filter((r) => r.values.State !== 'Dropped')
  return (
    <Section
      title="About you"
      about="What Alpha learned about you from this Mac. What you keep starts every conversation."
      action={
        <Button size="sm" onClick={() => go('#/p/onboarding')}>
          Let Alpha get to know you
        </Button>
      }
    >
      {problem && <div className="text-bad text-sm">{problem}</div>}
      {rows && lines.length === 0 && (
        <Empty>Nothing yet. Let Alpha get to know you, then keep what is right.</Empty>
      )}
      {lines.length > 0 && (
        <List>
          {lines.map((r) => (
            <AboutLine key={r.id} row={r} onChange={load} />
          ))}
        </List>
      )}
    </Section>
  )
}
