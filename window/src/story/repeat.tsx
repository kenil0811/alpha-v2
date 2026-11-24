// One thing the person repeats, in their own words, for the Module builder as New module does: the
// end of Set up Alpha when there is nothing yet to offer, so even a story skipped through ends on
// something to do.
import { Check } from 'lucide-react'
import { useState } from 'react'
import { askFor, giveBuilder } from '../NewModule.tsx'
import { Refusal, useAct } from '../ui/act.tsx'
import { Button } from '../ui/button.tsx'
import { Field } from '../ui/field.tsx'

export function Repeat({ done }: { done?: () => Promise<void> }) {
  const [words, setWords] = useState('')
  const [sent, setSent] = useState(false)
  const doing = useAct()
  if (sent)
    return (
      <p className="flex items-center gap-2 text-ink-2">
        <Check className="size-4 text-good" /> I’m on it. You’ll find it being built on Home.
      </p>
    )
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void doing.act(async () => {
          await giveBuilder(askFor(words.trim(), []))
          await done?.()
          setSent(true)
        })
      }}
    >
      <p className="text-ink-2">Tell me one thing you repeat, and I’ll take it on.</p>
      <div className="flex flex-wrap gap-2">
        <Field
          className="min-w-60 flex-1"
          aria-label="Something you repeat"
          placeholder="I chase unpaid invoices by email each week"
          value={words}
          onChange={(e) => setWords(e.target.value)}
        />
        <Button type="submit" disabled={doing.busy || !words.trim()}>
          Build it
        </Button>
      </div>
      <Refusal words={doing.problem} />
    </form>
  )
}
