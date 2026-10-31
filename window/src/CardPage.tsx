// A card in full, in the side panel (#/card/<id>; Vikas, 30 Oct: a question clicked showed
// nothing more): the card itself with its actions while it waits, and the module it is in.
// Who asked, the runs it rests on and its history in the journal wait on the core's
// GET /api/cards/:id/about (CardAbout), not on main yet; until then the panel says so.
import type { CardView, ModuleSummary } from '@alpha/core/api'
import { useEffect } from 'react'
import { CardBox } from './Conversation.tsx'
import { Record } from './Record.tsx'

export function CardPage({
  id,
  cards,
  modules,
  onName,
}: {
  id: string
  cards: CardView[] // what waits on the person: the stream's cards
  modules: ModuleSummary[]
  onName: (name: string) => void
}) {
  const card = cards.find((c) => c.id === id)
  const module = modules.find((m) => m.id === card?.module)
  const asks = card?.draft?.agent ?? card?.proposed?.agent ?? null
  useEffect(() => {
    onName(card ? `${asks ?? 'Alpha'} asks` : '')
  }, [card, asks, onName])
  if (!card)
    return (
      <p className="p-6 text-ink-2">
        This card has been answered. An answered card opens here once the core says where it came
        from and what became of it.
      </p>
    )
  return (
    <Record kind="Needs you">
      {module && (
        <p className="text-ink-2 text-md">
          In{' '}
          <a href={`#/module/${module.id}`} className="text-ink hover:underline">
            {module.name}
          </a>
        </p>
      )}
      <CardBox id={card.id} card={card} onChange={() => undefined} />
    </Record>
  )
}
