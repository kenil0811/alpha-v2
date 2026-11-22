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
  const load = useCallback(() => {
    api.get<SiteView[]>('/api/sites').then(setSites, () => setSites([]))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const { busy, problem, act } = useAct(load)
  const site = useSiteSignIn(load)
  const signIn = (url: string) =>
    act(async () => {
      await site.signIn(url)
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
              sub={`Signed in ${when(s.at)}${s.on ? ` on ${s.on}` : ''}`}
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
      <Refusal words={problem} />
      {site.shown}
    </Section>
  )
}

// Signing in to a site in Alpha's browser, as a run's Sign in card does: your own Chrome on a Mac,
// a computer of yours through the Bridge, or the live picture of the server's browser. What it
// shows while the person signs in; in Settings › Sites and on Set up Alpha's Apps you use.
export function useSiteSignIn(onDone: () => void) {
  const [live, setLive] = useState<{ card: string; site: string } | null>(null)
  // a sign-in window open: in Chrome on this Mac, or on a computer of yours (the Bridge)
  const [opened, setOpened] = useState<{ site: string; on: string | null } | null>(null)
  const signIn = async (url: string) => {
    const { card, site } = await api.post<{ card: string; site: string }>('/api/sites/sign-in', {
      url,
    })
    const r = await api.post<{ live?: boolean; on?: string }>(`/api/cards/${card}/sign-in`)
    if (r.live) setLive({ card, site })
    else setOpened({ site, on: r.on ?? null })
  }
  const shown = (
    <>
      {opened && (
        <p className="text-ink-3 text-sm">
          {opened.on
            ? `${opened.site} opened in its own Chrome window on ${opened.on}: sign in there, then quit that Chrome (⌘Q on a Mac; on Windows, close its window).`
            : `${opened.site} opened in its own window of Google Chrome: sign in there, then quit that Chrome (⌘Q).`}
        </p>
      )}
      {live && (
        <LiveSignIn
          card={live.card}
          site={live.site}
          onClose={() => {
            setLive(null)
            onDone()
          }}
        />
      )}
    </>
  )
  return { signIn, shown }
}
