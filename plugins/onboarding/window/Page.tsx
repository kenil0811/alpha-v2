// Onboarding's page (Kenil's yes 2 Nov): before a run, what Alpha reads and Start; while it looks,
// that it is looking; then what it found, each item for the person to keep, answer, add or decline;
// what was sent, and Forget; Look again.
import {
  Button,
  Check,
  List,
  LoaderCircle,
  openConnection,
  Pill,
  Refusal,
  Row,
  Section,
  useAct,
  wordsOf,
} from '@alpha/window/kit'
import { useCallback, useEffect, useState } from 'react'
import type { Run } from '../src/run.ts'
import { Results } from './Results.tsx'
import { onboarding } from './routes.ts'

export interface Source {
  name: string
  title: string
  connected: boolean
  private: boolean
}

export interface AboutRow {
  id: string
  values: { Line?: string; From?: string; Sure?: string; State?: string }
}

// What each source gives Alpha, as Start says it.
const READS: Record<string, string> = {
  calendar: 'Your meetings and who was in them',
  contacts: 'Names, organizations and titles, and your own card',
  gmail: 'Who you write to and the subjects; never the text',
  outlook: 'Who you write to and the subjects; never the text',
  browsing: 'Sites and page titles from Chrome and Safari; never the rest of an address',
  apps: 'Which apps you use, when, and for how long',
  filenames: 'Names of files in Documents, Desktop and Downloads; never what is in them',
}

export function Page() {
  const [run, setRun] = useState<Run | null | undefined>(undefined)
  const [about, setAbout] = useState<AboutRow[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const [r, a, s] = await Promise.all([
        onboarding.get<Run | null>('/run'),
        onboarding.get<AboutRow[]>('/about'),
        onboarding.get<Source[]>('/sources'),
      ])
      setRun(r)
      setAbout(a)
      setSources(s)
      setProblem(null)
    } catch (err) {
      setProblem(wordsOf(err))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  // while Alpha looks, the page looks again every few seconds
  useEffect(() => {
    if (run?.state !== 'looking') return
    const t = setInterval(() => void load(), 3000)
    return () => clearInterval(t)
  }, [run?.state, load])
  const start = useAct(() => void load())

  return (
    <div className="@container h-full overflow-y-auto">
      <div className="mx-auto flex max-w-page flex-col gap-7 px-8 pt-8 pb-12">
        <p className="text-ink-2 text-md">
          Alpha reads what you allow on this Mac, looks closer at what matters, and tells you what
          it learned about your work. Nothing is kept until you keep it.
        </p>
        {problem && <div className="text-bad text-sm">{problem}</div>}

        {run?.state === 'looking' && <Looking since={run.at} />}

        {run?.state === 'done' && run.checked && (
          <Results run={run} about={about} onChange={() => void load()} />
        )}

        {run !== undefined && run?.state !== 'looking' && (
          <Section
            title={run?.state === 'done' ? 'Look again' : 'What Alpha reads'}
            about="Each source as it is connected on this Mac. What Alpha reads stays here; only what its looks find goes to Claude, and you can see all of it after."
          >
            {run?.state === 'failed' && (
              <div className="text-bad text-sm">The last look failed: {run.problem}</div>
            )}
            <List>
              {sources.map((s) => (
                <Row
                  key={s.name}
                  title={s.title}
                  sub={READS[s.name] ?? ''}
                  actions={
                    s.connected ? (
                      <Pill tone="good">
                        <Check className="size-3" />
                        Connected
                      </Pill>
                    ) : s.private ? (
                      <span className="text-ink-3 text-sm">Not connected on this Mac</span>
                    ) : (
                      <Button size="sm" onClick={() => openConnection(s.name)}>
                        Connect
                      </Button>
                    )
                  }
                />
              ))}
            </List>
            <div className="text-ink-2 text-sm">
              Never sent: what a message or a file says, a web address, anything on your never-use
              list. Names of people, sites, files and subjects can be.
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant={run?.state === 'done' ? 'default' : 'primary'}
                disabled={start.busy}
                onClick={() => void start.act(() => onboarding.post('/look'))}
              >
                {run?.state === 'done' ? 'Look again' : 'Start'}
              </Button>
              <Refusal words={start.problem} />
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

// While Alpha looks: one line, and how long so far.
function Looking({ since }: { since: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const s = Math.max(0, Math.round((now - Date.parse(since)) / 1000))
  return (
    <div className="flex items-center gap-2 text-ink-2 text-md">
      <LoaderCircle className="size-3.5 animate-spin text-ink-3" />
      Alpha is looking closer at what you allowed (
      {s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`}
      so far). It usually takes about a minute.
    </div>
  )
}
