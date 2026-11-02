// A question put to the person, one piece wherever Alpha asks (Kenil, 2 Nov: the window's pieces
// are shared, never made again per screen): a card's question and onboarding's alike. What is
// asked, its detail in words, what it rests on, then its choices or a box for the answer in the
// person's own words.
import { type ReactNode, useState } from 'react'
import { answerWords } from '../vocabulary.ts'
import { Button } from './button.tsx'
import { Card } from './card.tsx'
import { Field } from './field.tsx'
import { Words } from './words.tsx'

export function Question({
  words,
  detail,
  options = [],
  label = 'A question',
  waits = 'Waits for you',
  busy,
  problem,
  onAnswer,
  children,
}: {
  words: string
  detail?: string | null | undefined // in Markdown
  options?: string[] // none: an answer in their own words
  label?: string
  waits?: string
  busy: boolean
  problem?: string | null | undefined
  onAnswer: (answer: string) => void
  children?: ReactNode // what it rests on, what cannot be undone
}) {
  return (
    <Card label={label} waits={waits}>
      <div className="font-medium text-ink text-lg">{words}</div>
      {detail && (
        <div className="rounded-md border border-hair bg-canvas px-3 py-2.5 text-ink text-md">
          <Words text={detail} />
        </div>
      )}
      {children}
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => (
          <Button
            key={o}
            variant={i === 0 ? 'primary' : 'default'}
            disabled={busy}
            onClick={() => onAnswer(o)}
          >
            {answerWords(o)}
          </Button>
        ))}
        {options.length === 0 && <Answer busy={busy} onAnswer={onAnswer} />}
      </div>
      {problem && <div className="text-bad text-sm">{problem}</div>}
    </Card>
  )
}

// An answer in the person's own words: a box and Answer.
export function Answer({
  busy,
  onAnswer,
  placeholder = 'Your answer',
}: {
  busy: boolean
  onAnswer: (answer: string) => void
  placeholder?: string
}) {
  const [typed, setTyped] = useState('')
  return (
    <form
      className="flex w-full gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (typed.trim()) onAnswer(typed.trim())
      }}
    >
      <Field
        className="flex-1"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={placeholder}
      />
      <Button type="submit" variant="primary" disabled={busy || !typed.trim()}>
        Answer
      </Button>
    </form>
  )
}
