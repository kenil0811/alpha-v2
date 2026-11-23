// A question put to the person, one piece wherever Alpha asks (the window's pieces are shared,
// never made again per screen): a card's question and onboarding's alike. What is asked, its
// detail in words, what it rests on, then its choices or a box for the answer in the person's own
// words.
import { MessageSquareText } from 'lucide-react'
import { type ReactNode, useContext, useState } from 'react'
import { answerWords } from '../vocabulary.ts'
import { Button } from './button.tsx'
import { Card, CardPlace } from './card.tsx'
import { cn } from './cn.ts'
import { Field } from './field.tsx'
import { Info } from './info.tsx'
import { Voice } from './voice.tsx'
import { Words } from './words.tsx'
import { YesNo } from './yes-no.tsx'

// A detail that is only a list (each line "- …") is the things the question is about, each one
// picked or not with a box (Vikas, 23 Nov); none when the detail is words.
export function listOf(detail: string | null | undefined): string[] | null {
  const lines = (detail ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return lines.length > 1 && lines.every((l) => /^[-*] /.test(l))
    ? lines.map((l) => l.slice(2))
    : null
}

// What an item is called in a partial yes: its bold part, else what comes before its first comma.
export const nameOf = (item: string) =>
  /\*\*(.+?)\*\*/.exec(item)?.[1] ?? item.split(/[,·]/)[0]?.trim() ?? item

// One thing to pick: its box and one crisp line (who, what), the rest (an address, when) on hover.
function Pick({ item, on, onToggle }: { item: string; on: boolean; onToggle: () => void }) {
  const [line = item, ...rest] = item.split(' · ')
  return (
    <label className="group/pick flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1 hover:bg-hover">
      <input
        type="checkbox"
        checked={on}
        onChange={onToggle}
        className="mt-1 size-3.5 shrink-0 accent-[var(--color-accent)]"
      />
      <div className="min-w-0 flex-1 text-md">
        <div className={cn('[&_p]:truncate', on ? 'text-ink' : 'text-ink-3')}>
          <Words text={line} />
        </div>
        {rest.length > 0 && (
          <div className="hidden text-ink-3 text-sm group-hover/pick:block">
            <Words text={rest.join(' · ')} />
          </div>
        )}
      </div>
    </label>
  )
}

export function Question({
  words,
  detail,
  help,
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
  help?: string | null | undefined // its ⓘ beside the question (R10): what answering it does
  options?: string[] // none: an answer in their own words
  label?: string
  waits?: string
  busy: boolean
  problem?: string | null | undefined
  onAnswer: (answer: string) => void
  children?: ReactNode // what it rests on, what cannot be undone
}) {
  const place = useContext(CardPlace)
  const items = listOf(detail)
  const [picked, setPicked] = useState(() => new Set(items?.keys()))
  const [own, setOwn] = useState(false)
  // the yes, naming the things picked when not all of them are (Vikas, 23 Nov)
  const yes = (o: string) =>
    onAnswer(
      items && picked.size < items.length
        ? `${o}: only ${[...picked].map((i) => nameOf(items[i] ?? '')).join(', ')}`
        : o,
    )
  const [first = 'Yes', second = 'No'] = options
  return (
    // the page numbers go in the row of buttons, not under it
    <CardPlace.Provider value={options.length ? { ...place, pager: null } : place}>
      <Card label={label} waits={waits}>
        <div className="flex items-start gap-2 font-medium text-ink text-lg">
          <span className="min-w-0">{words}</span>
          {help && <Info help={help} />}
        </div>
        {items ? (
          <div className="flex flex-col">
            {items.map((it, i) => (
              <Pick
                key={i}
                item={it}
                on={picked.has(i)}
                onToggle={() =>
                  setPicked((p) => {
                    const n = new Set(p)
                    if (!n.delete(i)) n.add(i)
                    return n
                  })
                }
              />
            ))}
          </div>
        ) : (
          detail && (
            <div className="rounded-md border border-hair bg-canvas px-3 py-2.5 text-ink text-md">
              <Words text={detail} />
            </div>
          )
        )}
        {children}
        {options.length === 0 ? (
          <Answer busy={busy} onAnswer={onAnswer} />
        ) : (
          // one row: your own words behind the chat icon; the page numbers; the choices, the main
          // one at the right. Open, your own words take the row (Vikas, 23 Nov).
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Answer in your own words"
              data-tip="Answer in your own words"
              aria-pressed={own}
              onClick={() => setOwn((o) => !o)}
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-full',
                own ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-hover hover:text-ink',
              )}
            >
              <MessageSquareText className="size-4" />
            </button>
            {own ? (
              <Answer busy={busy} onAnswer={onAnswer} placeholder="Your own answer" />
            ) : (
              <>
                <div className="flex min-w-0 flex-1 justify-center">{place.pager}</div>
                <div className="flex flex-wrap justify-end gap-2">
                  {options.length === 2 ? (
                    <>
                      <YesNo
                        yes={false}
                        words={answerWords(second)}
                        busy={busy}
                        onClick={() => onAnswer(second)}
                      />
                      <YesNo
                        yes
                        words={answerWords(first)}
                        busy={busy || (!!items && picked.size === 0)}
                        onClick={() => yes(first)}
                      />
                    </>
                  ) : (
                    options.map((o, i) => (
                      <Button
                        key={o}
                        size="sm"
                        variant={i === 0 ? 'primary' : 'default'}
                        disabled={busy}
                        className={i === 0 ? 'order-last' : ''}
                        onClick={() => (i === 0 ? yes(o) : onAnswer(o))}
                      >
                        {answerWords(o)}
                      </Button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {problem && <div className="text-bad text-sm">{problem}</div>}
      </Card>
    </CardPlace.Provider>
  )
}

// An answer in the person's own words: a box, with a microphone in it, and Answer.
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
      <div className="relative min-w-0 flex-1">
        <Field
          className="w-full pr-9"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={placeholder}
        />
        <Voice
          value={typed}
          onChange={setTyped}
          className="-translate-y-1/2 absolute top-1/2 right-1"
        />
      </div>
      <Button type="submit" variant="primary" disabled={busy || !typed.trim()}>
        Answer
      </Button>
    </form>
  )
}
