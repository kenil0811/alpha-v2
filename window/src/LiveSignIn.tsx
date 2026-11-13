// A site's sign-in on a server: a live picture of the server's browser, which the person clicks and
// types in as if it were here. It closes by itself once they are in.
import { useRef } from 'react'
import { LivePage } from './LivePage.tsx'
import { Button } from './ui/button.tsx'

export function LiveSignIn({
  card,
  site,
  onClose,
}: {
  card: string
  site: string
  onClose: () => void
}) {
  // the window behind re-renders often: that must not open the site again
  const closing = useRef(onClose)
  closing.current = onClose
  return (
    <LivePage
      path={`/ws/live/${card}`}
      title={`Sign in to ${site}`}
      sub="Alpha never sees your password. This closes by itself once you are in."
      label={`The sign-in page of ${site}`}
      hands
      onClose={onClose}
      onTold={(m) => {
        if (m.done) closing.current()
      }}
      actions={(send) => (
        <>
          <Button size="sm" onClick={() => send({ kind: 'done' })}>
            I am signed in
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </>
      )}
    />
  )
}
