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
  Lock,
  Pencil,
  Plug,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { api } from '../api.ts'
import { underWay } from '../NewModule.tsx'
import { SCREENS } from '../plugin/screens.ts'
import { Refusal, useAct } from '../ui/act.tsx'
import { Button, IconButton } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { CodeLine } from '../ui/code-line.tsx'
import { Field } from '../ui/field.tsx'
import { Pill } from '../ui/pill.tsx'
import { type Answer, YesNo } from '../ui/yes-no.tsx'
import { squared } from '../Workspace.tsx'
import { Connect } from './connect.tsx'
import type { Next } from './next.ts'
import { Repeat } from './repeat.tsx'

export type { Next } from './next.ts'

interface Props {
  screen: ChapterScreen
  reload: () => void // read the screen again
  next: (n: Next) => void
  leave: () => void // out of the story, which waits on Home
  act: (body: unknown) => Promise<void> // the chapter's act, the story moving on when it says
  said?: boolean // Alpha's line is all there (Hello's types itself out first)
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
    case 'computer':
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
        {/* a row's words wrap on a narrow screen: a promise is never cut */}
        <span className="break-words text-ink">{head}</span>
        {sub && <span className="truncate text-ink-3 text-sm">{sub}</span>}
      </span>
      {end}
    </li>
  )
}

const PROMISE_ICONS = [ShieldCheck, EyeOff, Lock]

// Hello's promises, coming in one after another once Alpha's line is typed; their place is kept
// from the first frame (ui-rules U3).
function Welcome({ screen, next, said = true }: Props & { screen: WelcomeScreen }) {
  useEffect(() => next({ label: 'Start', ready: true }), [next])
  return (
    <ul className="flex flex-col">
      {screen.promises.map((words, i) => {
        const Icon = PROMISE_ICONS[i] ?? ShieldCheck
        return (
          <li
            key={words}
            className="transition-opacity duration-500 motion-reduce:transition-none"
            style={{ opacity: said ? 1 : 0, transitionDelay: said ? `${i * 350}ms` : '0ms' }}
          >
            <ul>
              <Item icon={<Icon className="size-4" />} head={words} />
            </ul>
          </li>
        )
      })}
    </ul>
  )
}

// What to do, in order; a command to run shown under the first step, with its copy button.
function Steps({ steps, code }: { steps: string[]; code?: string | null }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((words, i) => (
        <li key={words} className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent text-sm">
            {i + 1}
          </span>
          <span className="flex min-w-0 flex-col gap-2 pt-0.5 text-ink-2">
            {words}
            {i === 0 && code && <CodeLine text={code} className="self-start" />}
          </span>
        </li>
      ))}
    </ol>
  )
}

// Claude is connected one way on this Mac and online alike: the code claude setup-token prints,
// pasted here (Vikas, 23 Nov)
function Claude({ screen, next }: Props & { screen: ClaudeScreen }) {
  const [token, setToken] = useState('')
  useEffect(() => {
    if (screen.set) next({ label: 'Continue', ready: true })
    else
      next({
        label: 'Check and save',
        busy: 'Checking with Claude',
        ready: !!token.trim(),
        body: () => ({ token: token.trim() }),
      })
  }, [screen.set, token, next])
  if (screen.set)
    return (
      <p className="flex items-center gap-2 text-good">
        <Check className="size-4" /> Alpha reaches Claude.
      </p>
    )
  return (
    <div className="flex flex-col gap-6">
      <Steps steps={screen.steps} code={screen.command} />
      <Field
        className="w-full"
        type="password"
        autoComplete="off"
        aria-label="Claude code"
        placeholder="Paste the code, sk-ant-…"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
    </div>
  )
}

function Workspace({ screen, next }: Props & { screen: WorkspaceScreen }) {
  const [name, setName] = useState(screen.name ?? screen.suggested ?? '')
  const [naming, setNaming] = useState(!screen.name && !screen.suggested)
  const [picture, setPicture] = useState<string | null>(null)
  const [use, setUse] = useState(screen.use)
  // the guessed site: asked once, the tick taking it, the cross leaving a box for their own
  const [isSite, setIsSite] = useState<Answer>(screen.site ? 'no' : null)
  const [site, setSite] = useState(screen.site ?? '')
  const file = useRef<HTMLInputElement>(null)
  useEffect(
    () =>
      next({
        label: 'Continue',
        ready: true,
        body: () => ({
          name: name.trim() || null,
          site: (isSite === 'yes' ? screen.guess : site.trim()) || null,
          use,
          ...(picture ? { picture } : {}),
        }),
      }),
    [name, site, isSite, use, picture, screen.guess, next],
  )
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
        {naming ? (
          <Field
            className="flex-1"
            aria-label="Your organization’s name"
            placeholder="Your organization’s name"
            value={name}
            maxLength={80}
            autoFocus={!!screen.suggested}
            onChange={(e) => setName(e.target.value)}
          />
        ) : (
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-lg text-ink">
            <span className="truncate">{name}</span>
            <IconButton label="Change the name" onClick={() => setNaming(true)}>
              <Pencil className="size-3.5" />
            </IconButton>
          </p>
        )}
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
      {screen.guess && isSite !== 'no' ? (
        <div className="flex min-h-8 flex-wrap items-center gap-3">
          <span className="text-ink">Is {screen.guess} your organization’s website?</span>
          <YesNo value={isSite} yes="Yes" no="No" onChange={setIsSite} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-semibold text-ink-2 text-sm">Your organization’s website</p>
          <Field
            aria-label="Your organization’s website"
            placeholder="example.com, if it has one"
            value={site}
            onChange={(e) => setSite(e.target.value)}
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <p className="font-semibold text-ink-2 text-sm">Is this for a business, or personal?</p>
        <div className="flex gap-1.5">
          {(['business', 'personal'] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={use === u}
              onClick={() => setUse(u)}
              className={cn(
                'h-7.5 rounded-full border px-3 text-md transition-colors',
                use === u
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-surface text-ink-2 hover:border-accent-line hover:text-accent',
              )}
            >
              {u === 'business' ? 'Business' : 'Personal'}
            </button>
          ))}
        </div>
        <p className="text-ink-3 text-sm">
          A business may need its admin’s approval later, to connect what the firm owns.
        </p>
      </div>
    </div>
  )
}

// Invite team: names and addresses gathered first; nothing is made until Send, which makes each
// person's one-time link to pass on (Alpha sends no mail, call 22).
function People({ screen, reload, next }: Props & { screen: PeopleScreen }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [queued, setQueued] = useState<{ name: string; email: string }[]>([])
  const [links, setLinks] = useState<Record<string, string>>({})
  const send = useAct(reload)
  useEffect(() => next({ label: 'Continue', ready: !queued.length }), [next, queued.length])
  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setQueued((q) => [...q, { name: name.trim(), email: email.trim() }])
          setName('')
          setEmail('')
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
        <Button type="submit" disabled={!name.trim() || !email.trim()}>
          Add
        </Button>
      </form>
      {queued.length > 0 && (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col">
            {queued.map((p) => (
              <Item
                key={p.email}
                icon={<UserRound className="size-4" />}
                head={p.name}
                sub={p.email}
                end={
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setQueued((q) => q.filter((x) => x !== p))}
                  >
                    Remove
                  </Button>
                }
              />
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Button
              disabled={send.busy}
              onClick={() =>
                void send.act(async () => {
                  for (const p of queued) {
                    const made = await api.post<{ id: string; link: string }>('/api/accounts', p)
                    setLinks((l) => ({ ...l, [made.id]: made.link }))
                    setQueued((q) => q.filter((x) => x !== p))
                  }
                })
              }
            >
              Send
            </Button>
            <Refusal words={send.problem} />
          </div>
        </div>
      )}
      {screen.people.length > 0 && (
        <ul className="flex flex-col">
          {screen.people.map((p) => (
            <Item
              key={p.id}
              icon={<UserRound className="size-4" />}
              head={p.name}
              sub={links[p.id] ? 'Pass this link on to them: it works once.' : (p.email ?? '')}
              end={
                links[p.id] ? (
                  <CodeLine text={links[p.id] ?? ''} className="w-56" />
                ) : p.state === 'waiting' ? (
                  <Pill tone="warn">Hasn’t joined yet</Pill>
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
        <ul className="flex flex-col">
          {screen.people.map((n) => (
            <Item key={n} icon={<UserRound className="size-4" />} head={n} sub="Works here" />
          ))}
        </ul>
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
      {screen.none && <li className="text-ink-2">{screen.none}</li>}
      {screen.repeat && (
        <li className="pt-4">
          <Repeat />
        </li>
      )}
    </ul>
  )
}
