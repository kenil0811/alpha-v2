// A server has no browser for Claude's own sign-in, so a subscription is given as the token
// `claude setup-token` makes on the person's own computer.
import type { ModelView } from '@alpha/core/api'
import { useState } from 'react'
import { api } from './api.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Field } from './ui/field.tsx'

export function TokenForm({ has, onSaved }: { has: boolean; onSaved: (m: ModelView) => void }) {
  const [token, setToken] = useState('')
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
      <Field
        className="w-72"
        type="password"
        autoComplete="off"
        aria-label="Claude token"
        placeholder={has ? 'A token is kept. Paste a new one to replace it' : 'sk-ant-…'}
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <Button size="sm" type="submit" disabled={busy || !token.trim()}>
        Save
      </Button>
      <Refusal words={problem} />
    </form>
  )
}
