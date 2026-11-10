// A card on its own page: the card the stream shows, across the page, a long letter whole. It is
// answered here as there, through the card's own routes, so its gate and "Send it" once are as
// they are. Once answered it says how; a card that is not there says so.
import type { CardView } from '@alpha/core/api'
import { useCallback, useEffect, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { startAsk } from './ask.ts'
import { CardBox } from './CardBox.tsx'
import { answerWords } from './vocabulary.ts'

export function CardPage({ id, version }: { id: string; version: number }) {
  const [card, setCard] = useState<CardView | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const load = useCallback(() => {
    api.get<CardView>(`/api/cards/${id}`).then(
      (c) => {
        setCard(c)
        setProblem(null)
      },
      (err) => setProblem(wordsOf(err)),
    )
  }, [id])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-page flex-col gap-4 px-8 pt-8 pb-12">
        {problem ? (
          <p className="text-ink-3">{problem}</p>
        ) : !card ? (
          <p className="text-ink-3">Loading…</p>
        ) : card.state === 'waiting' ? (
          <CardBox
            id={id}
            card={card}
            whole
            // Change something asks Alpha about it, as from Home
            onChange={(c) => startAsk(`About “${c.words.replace(/\?$/, '')}”: `)}
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="font-medium text-ink text-lg">{card.words}</div>
            <p className="text-ink-3">
              {card.answer ? `Answered: ${answerWords(card.answer)}.` : 'No longer waits for you.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
