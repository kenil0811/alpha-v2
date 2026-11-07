// A card that waits for the person (design §7): a question, a gate's yes, a file from the mail,
// a draft, two who may be the same, rows to decide. The same card wherever it
// shows: the stream, Home, and its own page (#/card/<id>, Batch B, pick 13), where a long
// letter shows whole. Out of Conversation.tsx so that screen only shrinks (the window file wall).
import type { CardView } from '@alpha/core/api'
import { TriangleAlert } from 'lucide-react'
import { useContext, useState } from 'react'
import { api, Problem } from './api.ts'
import { DraftCard } from './DraftCard.tsx'
import { FilingCard } from './FilingCard.tsx'
import { MatchCard } from './MatchCard.tsx'
import { ReviewCard } from './ReviewCard.tsx'
import { Button } from './ui/button.tsx'
import { Actions, Card, CardPlace } from './ui/card.tsx'
import { cn } from './ui/cn.ts'
import { Answer, Question } from './ui/question.tsx'
import { answerWords } from './vocabulary.ts'

// What a card would send, as it will go: a message's head (From, To, Subject…) laid out, then its
// body. Anything without such a head is shown as written.
export function Preview({ detail }: { detail: string }) {
  // on the card's own page a long letter shows whole; in a list it scrolls in its box
  const cut = useContext(CardPlace).whole ? '' : 'max-h-64 overflow-y-auto'
  const [head, ...rest] = detail.split('\n\n')
  const lines = (head ?? '').split('\n')
  const fields = lines.map((l) => /^([A-Z][A-Za-z-]{0,12}):\s(.*)$/.exec(l))
  if (!fields.length || fields.some((f) => !f))
    return (
      <div
        className={cn(
          'whitespace-pre-wrap rounded-md border border-hair bg-canvas px-3 py-2.5 text-ink text-md',
          cut,
        )}
      >
        {detail}
      </div>
    )
  return (
    <div className="rounded-md border border-hair bg-canvas text-md">
      <dl className="grid grid-cols-[60px_1fr] gap-x-2.5 gap-y-0.75 border-hair border-b px-3 py-2.5">
        {fields.map((f) =>
          f ? (
            <div key={f[1]} className="contents">
              <dt className="text-ink-3">{f[1]}</dt>
              <dd className="min-w-0 break-words text-ink">{f[2]}</dd>
            </div>
          ) : null,
        )}
      </dl>
      {rest.length > 0 && (
        <div className={cn('whitespace-pre-wrap px-3 py-2.5 text-ink leading-relaxed', cut)}>
          {rest.join('\n\n')}
        </div>
      )}
    </div>
  )
}

// What each gate is called in a card's head.
export const GATE: Record<string, string> = {
  leaves_world: 'Leaves your world',
  deletes_own: 'Deletes your entries',
  sign_in: 'Sign-in',
  filing: 'A file from your mail',
  match: 'Maybe the same',
  rows: 'For you to decide',
}

// How an option reads on its button: a plain Yes is Approve, a plain No is Decline.
const optionWords = answerWords

export function CardBox({
  id,
  card,
  onChange,
  whole = false,
}: {
  id: string
  card: CardView
  onChange: (c: CardView) => void
  whole?: boolean // on its own page: shown whole, with no way to itself
}) {
  return (
    <CardPlace.Provider value={whole ? { open: null, whole } : { open: `#/card/${id}`, whole }}>
      <CardBody id={id} card={card} onChange={onChange} />
    </CardPlace.Provider>
  )
}

function CardBody({
  id,
  card,
  onChange,
}: {
  id: string
  card: CardView
  onChange: (c: CardView) => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [opened, setOpened] = useState(false)
  if (card.filing) return <FilingCard card={card} filing={card.filing} />
  if (card.draft) return <DraftCard card={card} draft={card.draft} />
  if (card.match) return <MatchCard card={card} match={card.match} />
  if (card.review) return <ReviewCard card={card} review={card.review} />
  const answer = async (a: string) => {
    setBusy(true)
    try {
      // A site's sign-in opens the site in the person's own Google Chrome; the card is answered when
      // they quit it. A connection's opens the form where they sign in themselves.
      if (card.site && a === card.options[0]) {
        await api.post(`/api/cards/${id}/sign-in`)
        setOpened(true)
        return
      }
      await api.post(`/api/cards/${id}`, { answer: a })
      if (card.gate === 'sign_in' && a === card.options[0])
        window.location.hash = `#/intelligence/connections${card.connector ? `?connect=${card.connector}` : ''}`
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That answer did not go in.')
      setBusy(false)
    }
  }
  const restsOn = card.restsOn.length > 0 && (
    <div className="text-ink-3 text-sm">Rests on {card.restsOn.join(' and ')}</div>
  )
  const cannotUndo = card.cannotUndo && (
    <div className="flex items-center gap-1.5 text-sm text-warn">
      <TriangleAlert className="size-3.5 shrink-0" />
      {card.cannotUndo}
    </div>
  )
  // a question is the one shared piece (its detail is words, in Markdown)
  if (card.kind === 'question' && !card.gate)
    return (
      <Question
        words={card.words}
        detail={card.detail}
        options={card.options}
        busy={busy}
        problem={problem}
        onAnswer={(a) => void answer(a)}
      >
        {restsOn}
        {cannotUndo}
      </Question>
    )
  return (
    <Card
      label={card.gate ? (GATE[card.gate] ?? 'Waits for you') : 'A question'}
      waits="Waits for you"
    >
      <div className="font-medium text-ink text-lg">{card.words}</div>
      {/* a gate's detail is what would go, as it would go */}
      {card.detail && <Preview detail={card.detail} />}
      {restsOn}
      {cannotUndo}
      <Actions>
        {card.options.map((o, i) => (
          <Button
            key={o}
            variant={i === 0 ? 'primary' : 'default'}
            disabled={busy}
            onClick={() => answer(o)}
          >
            {optionWords(o)}
          </Button>
        ))}
        {card.kind === 'permission' && (
          <Button variant="ghost" disabled={busy} onClick={() => onChange(card)}>
            Change something
          </Button>
        )}
        {card.options.length === 0 && <Answer busy={busy} onAnswer={(a) => void answer(a)} />}
      </Actions>
      {opened && (
        <div className="text-ink-2 text-sm">
          {card.site} is open in Google Chrome on your Mac. Sign in there, then quit that Chrome
          with ⌘Q; the reader runs again.
        </div>
      )}
      {problem && <div className="text-bad text-sm">{problem}</div>}
    </Card>
  )
}
