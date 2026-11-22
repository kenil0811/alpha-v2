// Signing in to Alpha, on an Alpha that asks: before anything else
// loads, the session is looked at; no session, the sign-in page or, from a one-time link, the page
// that sets a password. A session that runs out comes back here.

import { EyeOff, Lock, ShieldCheck } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { Face } from './Face.tsx'
import { Button } from './ui/button.tsx'
import { Field } from './ui/field.tsx'

interface Session {
  signIn: boolean
  signedIn: boolean
  microsoft: boolean
}

const linkToken = () => new URLSearchParams(window.location.search).get('link')

export function Gate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    api.get<Session>('/api/session').then(setSession, (e) => setProblem(wordsOf(e)))
    const out = () => setSession((s) => (s ? { ...s, signedIn: false } : s))
    window.addEventListener('alpha:signed-out', out)
    return () => window.removeEventListener('alpha:signed-out', out)
  }, [])
  if (problem) return <Page title="Alpha">{problem}</Page>
  if (!session) return null
  const link = linkToken()
  if (session.signIn && link) return <SetPassword token={link} />
  if (session.signIn && !session.signedIn) return <SignIn microsoft={session.microsoft} />
  return <>{children}</>
}

function Page({ title, head, children }: { title: string; head?: ReactNode; children: ReactNode }) {
  return (
    <main className="grid h-dvh place-items-center bg-canvas p-6 text-ink">
      <div className="flex w-full max-w-90 flex-col gap-4">
        {head}
        <h1 className="font-serif text-2xl">{title}</h1>
        {children}
      </div>
    </main>
  )
}

function SignIn({ microsoft }: { microsoft: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem(null)
    try {
      await api.post('/api/session', { email, password })
      window.location.replace('/')
    } catch (err) {
      setProblem(wordsOf(err))
      setBusy(false)
    }
  }
  return (
    <Page title="Sign in to Alpha">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field
          type="email"
          autoFocus
          autoComplete="username"
          aria-label="Email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          type="password"
          autoComplete="current-password"
          aria-label="Password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {problem && <p className="text-bad text-md">{problem}</p>}
        <Button type="submit" variant="primary" disabled={busy || !email || !password}>
          Sign in
        </Button>
      </form>
      {microsoft && (
        <a
          className="text-center text-accent text-md hover:underline"
          href="/api/session/microsoft"
        >
          Sign in with Microsoft
        </a>
      )}
      <p className="text-ink-3 text-sm">
        Forgot your password? Ask the person who runs Alpha here.
      </p>
    </Page>
  )
}

// A member's link: Set up Alpha's Welcome to the workspace, before they are signed in.
interface Welcome {
  workspace: string
  picture: string | null
  addedBy: string | null
  promises: string[]
}

const PROMISE_ICONS = [ShieldCheck, EyeOff, Lock]

function SetPassword({ token }: { token: string }) {
  const [known, setKnown] = useState<{ name: string; email: string | null } | null | undefined>(
    undefined,
  )
  const [welcome, setWelcome] = useState<Welcome | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    api
      .get<{ link: { name: string; email: string | null } | null; welcome?: Welcome | null }>(
        `/api/session/link?token=${encodeURIComponent(token)}`,
      )
      .then(
        (r) => {
          setKnown(r.link)
          setWelcome(r.welcome ?? null)
        },
        () => setKnown(null),
      )
  }, [token])
  if (known === undefined) return null
  if (known === null)
    return (
      <Page title="This link has been used">
        <p className="text-ink-2 text-md">
          It was used already, or is too old. Ask the person who runs Alpha here for a new one.
        </p>
      </Page>
    )
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== again) {
      setProblem('The two passwords are not the same.')
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      await api.post('/api/session/link', {
        token,
        password,
        ...(known.email ? {} : { email }),
      })
      window.location.replace('/')
    } catch (err) {
      setProblem(wordsOf(err))
      setBusy(false)
    }
  }
  return (
    <Page
      title={welcome ? `Welcome to ${welcome.workspace}` : `Welcome, ${known.name}`}
      head={
        welcome && (
          <div className="flex items-center gap-3">
            {welcome.picture ? (
              <img src={welcome.picture} alt="" className="size-12 rounded-lg object-cover" />
            ) : (
              <div className="size-12">
                <Face mood="quiet" />
              </div>
            )}
            {welcome.addedBy && (
              <p className="text-ink-2 text-md">{`${welcome.addedBy} added you, ${known.name}.`}</p>
            )}
          </div>
        )
      }
    >
      {welcome && (
        <ul className="flex flex-col">
          {welcome.promises.map((words, i) => {
            const Icon = PROMISE_ICONS[i] ?? ShieldCheck
            return (
              <li
                key={words}
                className="flex items-center gap-3 border-hair border-t py-2 first:border-t-0"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-sunk text-ink-2">
                  <Icon className="size-3.5" />
                </span>
                <span className="text-ink text-md">{words}</span>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-ink-2 text-md">Choose a password of at least 12 characters.</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {known.email ? (
          <p className="text-ink text-md">{known.email}</p>
        ) : (
          <Field
            type="email"
            autoFocus
            autoComplete="username"
            aria-label="Your email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <Field
          type="password"
          autoFocus={!!known.email}
          autoComplete="new-password"
          aria-label="Password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          type="password"
          autoComplete="new-password"
          aria-label="The same again"
          placeholder="The same again"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />
        {problem && <p className="text-bad text-md">{problem}</p>}
        <Button type="submit" variant="primary" disabled={busy || !password || !again}>
          {welcome ? 'Start' : 'Set my password'}
        </Button>
      </form>
    </Page>
  )
}
