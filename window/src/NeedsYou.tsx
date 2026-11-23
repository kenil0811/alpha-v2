// Needs you: one card for everything that waits on the person. Along its title, a face for each
// one with something waiting (an agent, Schedules, Sign-ins) and how many; the chosen one's things one at a
// time, the page numbers under them (Vikas, 23 Nov).
import type { AgentView, CardView, Stream } from '@alpha/core/api'
import { Clock, KeyRound } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { api } from './api.ts'
import { CardBox } from './CardBox.tsx'
import { signInWith } from './SignInApps.tsx'
import { Pages } from './table/FootBar.tsx'
import { Avatar } from './ui/avatar.tsx'
import { cn } from './ui/cn.ts'
import { Group, Line } from './ui/groups.tsx'

type SignIn = Stream['attention'][number]

// Who waiting things are from: an agent, Schedules (what a schedule's run raised and no agent did),
// or Sign-ins (a connection's).
export interface From {
  key: string
  name: string
  icon?: ReactNode // in place of the initials
  cards: CardView[]
  signIns: SignIn[]
}

const SCHEDULES = { name: 'Schedules', icon: <Clock className="size-4" /> }

// The ones with something waiting: the agents in the team's order, then Schedules, Sign-ins last.
export function fromWhom(cards: CardView[], signIns: SignIn[], agents: AgentView[]): From[] {
  const chief = agents.find((a) => a.chief)?.id
  const whose = (c: CardView) => (c.schedule && c.agent === chief ? 'schedules' : c.agent)
  const place = (key: string) => {
    const i = agents.findIndex((a) => a.id === key)
    return i < 0 ? agents.length : i
  }
  const out = [...new Set(cards.map(whose))]
    .sort((x, y) => place(x) - place(y))
    .map(
      (key): From => ({
        key,
        ...(key === 'schedules'
          ? SCHEDULES
          : { name: agents.find((a) => a.id === key)?.name ?? 'An agent' }),
        cards: cards.filter((c) => whose(c) === key),
        signIns: [],
      }),
    )
  if (signIns.length)
    out.push({
      key: 'sign-ins',
      name: 'Sign-ins',
      icon: <KeyRound className="size-4" />,
      cards: [],
      signIns,
    })
  return out
}

const many = (f: From) => f.cards.length + f.signIns.length

export function NeedsYou({ from, onChange }: { from: From[]; onChange: (c: CardView) => void }) {
  const [chosen, setChosen] = useState<string | null>(null)
  const [at, setAt] = useState(0)
  const pick = from.find((f) => f.key === chosen) ?? from[0]
  if (!pick) return null
  const n = many(pick)
  const i = Math.min(at, n - 1)
  const card = pick.cards[i]
  const signIn = pick.signIns[i - pick.cards.length]
  const pager = n > 1 && (
    <div className="flex justify-center text-ink-3 text-xs">
      <Pages at={i} pages={n} onPage={setAt} />
    </div>
  )
  return (
    <Group
      title="Needs you"
      count={from.reduce((s, f) => s + many(f), 0)}
      action={
        from.length > 1 && (
          <div className="flex gap-2">
            {from.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={f === pick}
                aria-label={`${f.name}: ${many(f)}`}
                data-tip={f.name}
                onClick={() => {
                  setChosen(f.key)
                  setAt(0)
                }}
                className={cn('relative rounded-full', f === pick && 'ring-2 ring-accent-line')}
              >
                {f.icon ? (
                  <span className="grid size-8 place-items-center rounded-full bg-sunk text-ink-2">
                    {f.icon}
                  </span>
                ) : (
                  <Avatar name={f.name} />
                )}
                <span className="-top-1.5 -right-1.5 absolute grid h-4 min-w-4 place-items-center rounded-full bg-warn-soft px-1 font-semibold text-warn text-xs">
                  {many(f)}
                </span>
              </button>
            ))}
          </div>
        )
      }
    >
      {card ? (
        <CardBox key={card.id} id={card.id} card={card} onChange={onChange} bare pager={pager} />
      ) : (
        signIn && (
          <>
            <SignInLine a={signIn} />
            {pager}
          </>
        )
      )}
    </Group>
  )
}

function SignInLine({ a }: { a: SignIn }) {
  return (
    <Line
      icon={<KeyRound className="size-3.5 text-warn" />}
      head={a.waiting ? 'Waiting on your side' : 'Sign-in'}
      words={
        a.waiting
          ? `${a.title}: ${a.waiting}`
          : a.inBrowser
            ? `${a.title} needs you to sign in: it opens in Chrome`
            : a.signsInWith
              ? `${a.title} needs you to sign in with ${a.signsInWith}: it opens in your browser`
              : `${a.title} needs you to sign in again`
      }
      {...(a.waiting
        ? { href: '#/settings/connections' }
        : a.inBrowser
          ? {
              onClick: () => {
                void api.post(`/api/connections/${a.connection}/sign-in`)
              },
            }
          : a.signsInWith
            ? {
                onClick: () => {
                  void signInWith(a.connection)
                },
              }
            : { href: `#/settings/connections?connect=${a.connector}` })}
    />
  )
}
