// Connections' Sites: the sites you signed in to in Alpha's browser, each with when, Sign in again
// and Sign out, and a box to sign in to one more. You type your login in the site itself (your own
// Chrome on a Mac, a live picture of the server's browser otherwise); Alpha never sees it.
import type { SiteView } from '@alpha/core/api'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { LiveSignIn } from './LiveSignIn.tsx'
import { when } from './Modules.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Field } from './ui/field.tsx'
import { List, Row } from './ui/list.tsx'
import { Section } from './ui/section.tsx'

export function Sites({ version }: { version: number }) {
  const [sites, setSites] = useState<SiteView[]>([])
  const [address, setAddress] = useState('')
  const [live, setLive] = useState<{ card: string; site: string } | null>(null)
  const [opened, setOpened] = useState<string | null>(null)
  const load = useCallback(() => {
    api.get<SiteView[]>('/api/sites').then(setSites, () => setSites([]))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const { busy, problem, act } = useAct(load)
  // the same Sign in card a run meets, answered here at once: your own Chrome on a Mac, the live
  // picture of the server's browser otherwise
  const signIn = (url: string) =>
    act(async () => {
      const { card, site } = await api.post<{ card: string; site: string }>('/api/sites/sign-in', {
        url,
      })
      const r = await api.post<{ live?: boolean }>(`/api/cards/${card}/sign-in`)
      if (r.live) setLive({ card, site })
      else setOpened(site)
      setAddress('')
    })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (address.trim()) void signIn(address.trim())
  }
  return (
    <Section
      title="Sites"
      about="Sites you signed in to in Alpha's browser. Agents read and work on them as you; Alpha never sees your password."
    >
      {sites.length > 0 && (
        <List>
          {sites.map((s) => (
            <Row
              key={s.site}
              title={s.site}
              sub={`Signed in ${when(s.at)}`}
              actions={
                <>
                  <Button size="sm" disabled={busy} onClick={() => signIn(`https://${s.site}`)}>
                    Sign in again
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => act(() => api.post('/api/sites/sign-out', { site: s.site }))}
                  >
                    Sign out
                  </Button>
                </>
              }
            />
          ))}
        </List>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <Field
          className="flex-1"
          value={address}
          placeholder="google.com"
          aria-label="A site to sign in to"
          onChange={(e) => setAddress(e.target.value)}
        />
        <Button type="submit" disabled={busy || !address.trim()}>
          Sign in
        </Button>
      </form>
      {opened && (
        <p className="text-ink-3 text-sm">
          {opened} opened in its own window of Google Chrome: sign in there, then quit that Chrome
          (⌘Q).
        </p>
      )}
      <Refusal words={problem} />
      {live && (
        <LiveSignIn
          card={live.card}
          site={live.site}
          onClose={() => {
            setLive(null)
            load()
          }}
        />
      )}
    </Section>
  )
}
