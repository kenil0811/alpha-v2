// Interviews in the window (the onboarding plan, calls 6, 9 and 24): a row on Home that asks to
// get to know the person until they finish or Decline, with how far it has got; Start an
// interview on the Interviewer's own page afterwards; and the plugin's page. Start opens the
// Interviewer's chat, where the interview is; Finish now is there while it is under way. Built
// only from the window's kit, so it looks and acts as the window's own screens do.
import {
  Button,
  Group,
  Info,
  Refusal,
  routes,
  type Screen,
  Section,
  Sparkles,
  useAct,
  useOpenChat,
} from '@alpha/window/kit'
import { useCallback, useEffect, useState } from 'react'
import type { HomeView } from '../src/home-view.ts'

const interviews = routes('interviews')

const HELP =
  'The Interviewer reads what you allow, one source at a time, asks only what it can’t tell from that, and ends with lines about you for How to work and a report of your work in Your work. Nothing is kept without your yes.'

function useHome() {
  const [home, setHome] = useState<HomeView | null>(null)
  const load = useCallback(
    () => interviews.get<HomeView>('/home').then(setHome, () => setHome(null)),
    [],
  )
  useEffect(() => {
    void load()
  }, [load])
  return { home, setHome }
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

// How far it has got, in one line.
export function whereWords(h: HomeView): string {
  if (h.state === 'start') return 'Not started'
  const said = `${h.sources.answered} of ${h.sources.of} sources answered`
  return h.workflows.all
    ? `${said} · ${plural(h.workflows.all, 'workflow')}, ${h.workflows.closed} closed`
    : said
}

// Start (or Carry on, or Start an interview), Decline on Home before it starts, Finish now while
// it is under way.
function Buttons({
  home,
  onHome,
  onChange,
}: {
  home: HomeView
  onHome: boolean
  onChange: (h: HomeView) => void
}) {
  const openChat = useOpenChat()
  const { busy, problem, act } = useAct()
  const post = (path: string, chat: boolean) =>
    act(async () => {
      onChange(await interviews.post<HomeView>(path))
      if (chat) await openChat(home.agent)
    })
  const underWay = home.state === 'part way'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={onHome || !underWay ? 'primary' : 'default'}
        disabled={busy}
        onClick={() => post('/start', true)}
      >
        {underWay ? 'Carry on' : onHome ? 'Start' : 'Start an interview'}
      </Button>
      {onHome && home.state === 'start' && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => post('/decline', false)}>
          Decline
        </Button>
      )}
      {underWay && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => post('/finish', true)}>
          Finish now
        </Button>
      )}
      <Refusal words={problem} />
    </div>
  )
}

// The row on Home, until they finish or Decline.
function Waiting() {
  const { home, setHome } = useHome()
  if (!home || home.state === 'done' || home.state === 'declined') return null
  return (
    <Group title={home.title}>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5">
        <Sparkles className="size-3.5 shrink-0 text-accent" />
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-ink text-md">
          {whereWords(home)}
          <Info help={HELP} />
        </span>
        <Buttons home={home} onHome onChange={setHome} />
      </div>
    </Group>
  )
}

// On the Interviewer's page: Start an interview, or Carry on and Finish now while one is under way.
function OnAgent() {
  const { home, setHome } = useHome()
  return home ? <Buttons home={home} onHome={false} onChange={setHome} /> : null
}

function Page() {
  const { home, setHome } = useHome()
  return (
    <div className="mx-auto flex max-w-page flex-col gap-4 px-8 pt-8 pb-12">
      <Section title="Interviews" about={HELP}>
        {home && (
          <div className="flex flex-col gap-3">
            <p className="text-ink-2 text-md">{whereWords(home)}</p>
            <Buttons home={home} onHome={false} onChange={setHome} />
          </div>
        )}
      </Section>
    </div>
  )
}

export const screen: Screen = {
  name: 'interviews',
  title: 'Interviews',
  Page,
  Waiting,
  agent: { name: 'Interviewer', Part: OnAgent },
}
