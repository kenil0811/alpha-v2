// A site's sign-in on a server: a live picture of the server's browser, which the person clicks and
// types in as if it were here. It closes by itself once they are in, where Alpha can tell: on a
// site whose page is open to anyone it cannot, and the person says when they are in.
import { useRef, useState } from 'react'
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
  const [tells, setTells] = useState(true)
  return (
    <LivePage
      path={`/ws/live/${card}`}
      title={`Sign in to ${site}`}
      sub={
        tells
          ? 'Alpha never sees your password. This closes by itself once you are in.'
          : 'Alpha never sees your password. Press I am signed in once you are: this site cannot tell Alpha by itself.'
      }
      label={`The sign-in page of ${site}`}
      hands
      onClose={onClose}
      onTold={(m) => {
        if (m.done) closing.current()
        if (m.tells !== undefined) setTells(m.tells)
      }}
      actions={(send) => (
        <>
          <Button
            size="sm"
            variant={tells ? 'default' : 'primary'}
            onClick={() => send({ kind: 'done' })}
          >
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
