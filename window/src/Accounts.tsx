// Settings › People (the clean base, step 4b): who may sign in to this Alpha, the owner's to change.
// Adding someone or making a new link shows a one-time link to pass on; Alpha sends no mail.
import type { Me } from '@alpha/core/api'
import { Copy, UserRound } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { dayWords } from './time.ts'
import { Button } from './ui/button.tsx'
import { Confirm } from './ui/dialog.tsx'
import { Field } from './ui/field.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { Section } from './ui/section.tsx'

interface Person {
  id: string
  name: string
  email: string | null
  role: 'owner' | 'member'
  state: 'waiting' | 'in'
  lastIn: string | null
}

export function AccountsSection() {
  const [people, setPeople] = useState<Person[] | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [link, setLink] = useState<{ who: string; url: string } | null>(null)
  const [leaving, setLeaving] = useState<Person | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const load = useCallback(() => {
    api.get<Person[]>('/api/accounts').then(setPeople, (e) => setProblem(wordsOf(e)))
  }, [])
  useEffect(() => load(), [load])
  const act = async (fn: () => Promise<unknown>) => {
    setProblem(null)
    try {
      await fn()
      load()
    } catch (err) {
      setProblem(wordsOf(err))
    }
  }
  const add = (e: FormEvent) => {
    e.preventDefault()
    void act(async () => {
      const made = await api.post<{ link: string }>('/api/accounts', { name, email })
      setLink({ who: name.trim(), url: made.link })
      setName('')
      setEmail('')
    })
  }
  return (
    <Section title="People" about="Who can sign in to this Alpha. Only you see this.">
      {people && (
        <List>
          {people.map((p) => (
            <Row
              key={p.id}
              lead={
                <Tile>
                  <UserRound className="size-4" />
                </Tile>
              }
              title={
                <span className="flex items-center gap-2">
                  {p.name}
                  {p.role === 'owner' && <Pill>Owner</Pill>}
                  {p.state === 'waiting' && <Pill tone="warn">Has not signed in yet</Pill>}
                </span>
              }
              sub={`${p.email ?? ''}${p.lastIn ? ` · last in ${dayWords(p.lastIn)}` : ''}`}
              actions={
                p.role === 'owner' ? undefined : (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void act(async () => {
                          const made = await api.post<{ link: string }>(
                            `/api/accounts/${p.id}/link`,
                          )
                          setLink({ who: p.name, url: made.link })
                        })
                      }
                    >
                      New link
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setLeaving(p)}>
                      Delete
                    </Button>
                  </>
                )
              }
            />
          ))}
        </List>
      )}
      <form onSubmit={add} className="flex gap-2">
        <Field
          className="flex-1"
          aria-label="Their name"
          placeholder="Their name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          className="flex-1"
          type="email"
          aria-label="Their email"
          placeholder="Their email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={!name.trim() || !email.trim()}>
          Add
        </Button>
      </form>
      {link && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-3">
          <p className="text-ink-2 text-md">
            Send this to {link.who}. It works once, for seven days, and you will not see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate text-sm text-ink">{link.url}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void navigator.clipboard?.writeText(link.url)}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
        </div>
      )}
      {problem && <p className="text-bad text-md">{problem}</p>}
      <Confirm
        open={!!leaving}
        title={`Delete ${leaving?.name}'s sign-in?`}
        yes="Delete"
        onClose={() => setLeaving(null)}
        onYes={() => {
          const p = leaving
          setLeaving(null)
          if (p) void act(() => api.post(`/api/accounts/${p.id}/remove`))
        }}
      >
        They can no longer sign in. What they did stays in Activity under their name.
      </Confirm>
    </Section>
  )
}

// Settings' foot: the version the core runs, and who is signed in with Sign out.
export function Foot({ me }: { me: Me | null }) {
  const [health, setHealth] = useState<{ version: string; build?: string } | null>(null)
  useEffect(() => {
    api.get<{ version: string; build?: string }>('/api/health').then(setHealth, () => undefined)
  }, [])
  return (
    <div className="flex flex-col gap-1 text-ink-3 text-sm">
      {health && (
        <p>
          Alpha {health.version}
          {health.build ? ` · build ${health.build}` : ''}
        </p>
      )}
      {me?.signIn && (
        <p className="flex items-center gap-2">
          Signed in as {me.user.name}
          <button
            type="button"
            className="underline underline-offset-3 hover:text-ink"
            onClick={() => {
              void api.post('/api/session/out').finally(() => window.location.replace('/'))
            }}
          >
            Sign out
          </button>
        </p>
      )}
    </div>
  )
}
