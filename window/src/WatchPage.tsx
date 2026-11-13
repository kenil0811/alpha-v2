// An agent's page, watched: the live picture of the tab it works in as you. Watching sends the page
// nothing. Take over gives you the page: what you do there is yours and is not recorded, the agent
// waits, and Hand back lets it carry on from the page as you left it.
import { useState } from 'react'
import { LivePage } from './LivePage.tsx'
import { Button } from './ui/button.tsx'

export function WatchPage({
  tab,
  site,
  name,
  take = false,
  onClose,
}: {
  tab: string
  site: string
  name: string // the agent working on it
  take?: boolean // opened to take over at once (a card that asks you onto the page)
  onClose: () => void
}) {
  const [held, setHeld] = useState(false)
  return (
    <LivePage
      path={`/ws/watch/${encodeURIComponent(tab)}`}
      title={`${name} on ${site}`}
      sub={
        held
          ? 'You have the page. What you do here is yours and is not recorded; hand it back when you are done.'
          : `You are watching ${name} work. Nothing you do here reaches the page.`
      }
      label={`The page ${name} works on at ${site}`}
      hands={held}
      // a card asked you onto the page: it is yours as soon as it opens
      {...(take ? { first: { kind: 'take' } } : {})}
      onClose={onClose}
      onTold={(m) => {
        if (m.held !== undefined) setHeld(m.held)
      }}
      actions={(send) => (
        <>
          {held ? (
            <Button size="sm" variant="primary" onClick={() => send({ kind: 'back' })}>
              Hand back
            </Button>
          ) : (
            <Button size="sm" onClick={() => send({ kind: 'take' })}>
              Take over
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </>
      )}
    />
  )
}
