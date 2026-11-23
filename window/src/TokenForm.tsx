// A server has no browser for Claude's own sign-in, so a subscription is given as the token
// `claude setup-token` makes on the person's own computer. A saved one can be deleted, asked on
// the page first, since Alpha can't reach Claude here without one.
import type { ModelView } from '@alpha/core/api'
import { useState } from 'react'
import { api } from './api.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Confirm } from './ui/dialog.tsx'
import { pastedKey, SecretField } from './ui/field.tsx'

export function TokenForm({ has, onSaved }: { has: boolean; onSaved: (m: ModelView) => void }) {
  const [token, setToken] = useState('')
  const [removing, setRemoving] = useState(false)
  const { busy, problem, act } = useAct()
  return (
    <form
      className="flex flex-wrap items-center gap-2 px-4 pb-3 pl-15"
      onSubmit={(e) => {
        e.preventDefault()
        void act(async () => {
          onSaved(await api.post<ModelView>('/api/model/token', { token: token.trim() }))
          setToken('')
        })
      }}
    >
      <SecretField
        className="w-72"
        aria-label="Claude token"
        placeholder={has ? 'A token is saved. Paste a new one to replace it' : 'Paste the token'}
        value={token}
        onChange={(e) => setToken(pastedKey(e.target.value))}
      />
      <Button size="sm" type="submit" disabled={busy || !token.trim()}>
        Save
      </Button>
      {has && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRemoving(true)}>
          Delete
        </Button>
      )}
      <Refusal words={problem} />
      <Confirm
        open={removing}
        title="Delete the token?"
        yes="Delete the token"
        done={{ words: 'The token is deleted.' }}
        busy={busy}
        onClose={() => setRemoving(false)}
        onYes={() =>
          act(async () => {
            onSaved(await api.delete<ModelView>('/api/model/token'))
            setRemoving(false)
          })
        }
      >
        Alpha can’t reach Claude on this server until a new token is saved.
      </Confirm>
    </form>
  )
}
