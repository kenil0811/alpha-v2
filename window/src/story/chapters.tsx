// Set up Alpha's chapters as the person sees them, each drawn from the screen the core sends: what
// it shows, and what its act at the story's foot sends (Next). Counts and "connected" are the
// core's; nothing here works one out.
import type {
  ChapterScreen,
  ClaudeScreen,
  ConnectScreen,
  DoneScreen,
  HereScreen,
  PeopleScreen,
  TasksView,
  WelcomeScreen,
  WorkspaceScreen,
} from '@alpha/core/api'
import {
  Bot,
  Boxes,
  Check,
  EyeOff,
  Hammer,
  ImagePlus,
  KeyRound,
  Lock,
  Plug,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { api } from '../api.ts'
import { underWay } from '../NewModule.tsx'
import { SCREENS } from '../plugin/screens.ts'
import { Refusal, useAct } from '../ui/act.tsx'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { CopyButton } from '../ui/copy.tsx'
import { Field } from '../ui/field.tsx'
import { Pill } from '../ui/pill.tsx'
import { squared } from '../Workspace.tsx'
import { Connect } from './connect.tsx'
import type { Next } from './next.ts'

export type { Next } from './next.ts'

interface Props {
  screen: ChapterScreen
  reload: () => void // read the screen again
  next: (n: Next) => void
  leave: () => void // out of the story, which waits on Home
  act: (body: unknown) => Promise<void> // the chapter's act, the story moving on when it says
}

export function ChapterBody(p: Props) {
  const s = p.screen
  switch (s.key) {
    case 'welcome':
      return <Welcome {...p} screen={s as WelcomeScreen} />
    case 'claude':
      return <Claude {...p} screen={s as ClaudeScreen} />
    case 'workspace':
      return <Workspace {...p} screen={s as WorkspaceScreen} />
    case 'connect':
      return <Connect screen={s as ConnectScreen} reload={p.reload} next={p.next} />
    case 'people':
      return <People {...p} screen={s as PeopleScreen} />
    case 'here':
      return <Here {...p} screen={s as HereScreen} />
    case 'done':
      return <Done {...p} screen={s as DoneScreen} />
    default: {
      // a plugin's chapter, drawn by its own window part (plugins/<name>/window); the core sends
      // one only while its plugin is on here (rules P1), before the window has asked /api/me
      const plugin = 'plugin' in s ? String(s.plugin) : ''
      const Body = SCREENS.find((x) => x.name === plugin)?.chapters?.[s.key]
      return Body ? (
        <Body screen={s as Record<string, unknown>} reload={p.reload} next={p.next} act={p.act} />
      ) : null
    }
  }
}

// A line with its icon, as the chapters list things.
function Item({
  icon,
  head,
  sub,
  end,
}: {
  icon: ReactNode
  head: ReactNode
  sub?: ReactNode
  end?: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 border-hair border-t py-2.5 first:border-t-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sunk text-ink-2">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-ink">{head}</span>
        {sub && <span className="truncate text-ink-3 text-sm">{sub}</span>}
      </span>
      {end}
    </li>
  )
}

const PROMISE_ICONS = [ShieldCheck, EyeOff, Lock]

function Welcome({ screen, next }: Props & { screen: WelcomeScreen }) {
  useEffect(() => next({ label: 'Start', ready: true }), [next])
  return (
    <ul className="flex flex-col">
      {screen.promises.map((words, i) => {
        const Icon = PROMISE_ICONS[i] ?? ShieldCheck
        return <Item key={words} icon={<Icon className="size-4" />} head={words} />
      })}
    </ul>
  )
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((words, i) => (
        <li key={words} className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent text-sm">
            {i + 1}
          </span>
          <span className="pt-0.5 text-ink-2">{words}</span>
        </li>
      ))}
    </ol>
  )
}

function Claude({ screen, reload, next }: Props & { screen: ClaudeScreen }) {
  const [token, setToken] = useState('')
  const signIn = useAct()
  // on a Mac, watch for Claude's own sign-in finishing in the browser
  useEffect(() => {
    if (screen.how !== 'signin' || screen.set) return
    const t = setInterval(reload, 3000)
    return () => clearInterval(t)
  }, [screen.how, screen.set, reload])
  useEffect(() => {
    if (screen.set) next({ label: 'Continue', ready: true })
    else if (screen.how === 'token')
      next({
        label: 'Check and save',
        busy: 'Checking with Claude',
        ready: !!token.trim(),
        body: () => ({ token: token.trim() }),
      })
    else next({ label: 'Continue', ready: false })
  }, [screen.set, screen.how, token, next])
  if (screen.set)
    return (
      <p className="flex items-center gap-2 text-good">
        <Check className="size-4" /> Alpha reaches Claude.
      </p>
    )
  return (
    <div className="flex flex-col gap-6">
      <Steps steps={screen.steps} />
      {screen.how === 'token' ? (
        <Field
          className="w-full"
          type="password"
          autoComplete="off"
          aria-label="Claude token"
          placeholder="Paste the token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      ) : (
        <div className="flex items-center gap-3">
          <Button
            disabled={signIn.busy}
            onClick={() => void signIn.act(() => api.post('/api/setup/signin'))}
          >
            <KeyRound className="size-3.5" /> Sign in
          </Button>
          <Refusal words={signIn.problem} />
        </div>
      )}
    </div>
  )
}

function Workspace({ screen, next }: Props & { screen: WorkspaceScreen }) {
  const [name, setName] = useState(screen.name ?? '')
  const [picture, setPicture] = useState<string | null>(null)
  const [words, setWords] = useState(screen.for ?? '')
  const [site, setSite] = useState(screen.site ?? '')
  // the guessed site: asked once, Yes taking it, No leaving a box for their own
  const [asked, setAsked] = useState<'yes' | 'no' | null>(screen.site ? 'no' : null)
  const file = useRef<HTMLInputElement>(null)
  const guessed = !!screen.guess && asked === null
  useEffect(
    () =>
      next({
        label: 'Continue',
        ready: true,
        body: () => ({
          name: name.trim() || null,
          for: words.trim() || null,
          site: (asked === 'yes' ? screen.guess : site.trim()) || null,
          ...(picture ? { picture } : {}),
        }),
      }),
    [name, words, site, asked, picture, screen.guess, next],
  )
  // a word picked fills the box, unless the person has written their own there
  const pick = (kind: string) => {
    if (!words.trim() || screen.kinds.includes(words.trim())) setWords(kind)
  }
  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Workspace picture"
          data-tip="Add a picture"
          onClick={() => file.current?.click()}
          className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-line border-dashed bg-surface text-ink-3 hover:border-accent-line hover:text-accent"
        >
          {picture ? (
            <img src={picture} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-4.5" />
          )}
        </button>
        <Field
          className="flex-1"
          aria-label="Workspace name"
          placeholder="Your workspace’s name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void squared(f).then(setPicture, () => undefined)
            e.target.value = ''
          }}
        />
      </div>
      <div className="flex flex-col gap-2.5">
        <p className="font-semibold text-ink-2 text-sm">Who is the work for?</p>
        <div className="flex flex-wrap gap-1.5">
          {screen.kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => pick(k)}
              className={cn(
                'h-7.5 rounded-full border px-3 text-md transition-colors',
                words.trim() === k
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-surface text-ink-2 hover:border-accent-line hover:text-accent',
              )}
            >
              {k}
            </button>
          ))}
        </div>
        <Field
          aria-label="Who the work is for"
          placeholder="In your own words: our bookshop, me and two staff"
          value={words}
          maxLength={300}
          onChange={(e) => setWords(e.target.value)}
        />
      </div>
      <div className="flex min-h-15 flex-col gap-2.5">
        <p className="font-semibold text-ink-2 text-sm">Your website</p>
        {guessed ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink">Is {screen.guess} your website?</span>
            <Button size="sm" onClick={() => setAsked('yes')}>
              Yes
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAsked('no')}>
              No
            </Button>
          </div>
        ) : asked === 'yes' ? (
          <p className="flex items-center gap-2 text-ink">
            <Check className="size-4 text-good" /> {screen.guess}
            <Button size="sm" variant="ghost" onClick={() => setAsked('no')}>
              Change
            </Button>
          </p>
        ) : (
          <Field
            aria-label="Your website"
            placeholder="yourwebsite.com, if you have one"
            value={site}
            onChange={(e) => setSite(e.target.value)}
          />
        )}
      </div>
    </div>
  )
}

function People({ screen, reload, next }: Props & { screen: PeopleScreen }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [links, setLinks] = useState<Record<string, string>>({})
  const add = useAct(reload)
  useEffect(() => next({ label: 'Continue', ready: true }), [next])
  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add.act(async () => {
            const made = await api.post<{ id: string; link: string }>('/api/accounts', {
              name: name.trim(),
              email: email.trim(),
            })
            setLinks((l) => ({ ...l, [made.id]: made.link }))
            setName('')
            setEmail('')
          })
        }}
      >
        <Field
          className="w-44"
          aria-label="Name"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          className="min-w-48 flex-1"
          type="email"
          aria-label="Email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={add.busy || !name.trim() || !email.trim()}>
          Add
        </Button>
        <Refusal words={add.problem} />
      </form>
      {screen.people.length > 0 && (
        <ul className="flex flex-col">
          {screen.people.map((p) => (
            <Item
              key={p.id}
              icon={<UserRound className="size-4" />}
              head={p.name}
              sub={links[p.id] ? 'Copy their link and pass it on: it works once.' : (p.email ?? '')}
              end={
                links[p.id] ? (
                  <CopyButton text={() => links[p.id] ?? ''} />
                ) : p.state === 'waiting' ? (
                  <Pill tone="warn">Has not signed in yet</Pill>
                ) : null
              }
            />
          ))}
        </ul>
      )}
      <p className="text-ink-3 text-sm">{screen.sees}</p>
    </div>
  )
}

function Here({ screen, next }: Props & { screen: HereScreen }) {
  useEffect(() => next({ label: 'Continue', ready: true }), [next])
  return (
    <div className="flex flex-col gap-6">
      {screen.modules.length > 0 && (
        <ul className="flex flex-col">
          {screen.modules.map((m) => (
            <Item
              key={m.name}
              icon={<Boxes className="size-4" />}
              head={m.name}
              sub={m.line ?? undefined}
            />
          ))}
        </ul>
      )}
      {screen.agents.length > 0 && (
        <ul className="flex flex-col">
          {screen.agents.map((a) => (
            <Item key={a.name} icon={<Bot className="size-4" />} head={a.name} sub={a.title} />
          ))}
        </ul>
      )}
      {screen.people.length > 0 && (
        <p className="text-ink-2">Also here: {screen.people.join(', ')}.</p>
      )}
      <p className="text-ink-2">{screen.shared}</p>
    </div>
  )
}

function Done({ screen, next }: Props & { screen: DoneScreen }) {
  const [builds, setBuilds] = useState<ReturnType<typeof underWay>>([])
  useEffect(() => {
    api.get<TasksView>('/api/tasks?list=open').then(
      (v) => setBuilds(underWay(v.lines)),
      () => undefined,
    )
  }, [])
  useEffect(() => next({ label: 'Go to Home', ready: true }), [next])
  return (
    <ul className="flex flex-col">
      {screen.connected.map((c) => (
        <Item key={c} icon={<Plug className="size-4" />} head={c} />
      ))}
      {builds.map((b) => (
        <Item key={b.id} icon={<Hammer className="size-4" />} head={b.what} sub="Being built" />
      ))}
      {screen.people.map((n) => (
        <Item
          key={n}
          icon={<UserRound className="size-4" />}
          head={n}
          sub="Added to this workspace"
        />
      ))}
      {!screen.connected.length && !builds.length && !screen.people.length && (
        <li className="text-ink-3">You can connect things and add people any time in Settings.</li>
      )}
    </ul>
  )
}
