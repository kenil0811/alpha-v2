// This computer's setup: the browser for reading websites and the PDF reader downloaded, Chrome
// there for sites the person signs in to, the Mac kept awake; and Claude's own sign-in, for Models.
import type { SetupView } from '@alpha/core/api'
import { LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { Button } from './ui/button.tsx'
import { notify } from './ui/notice.tsx'
import { type State, StateCard } from './ui/state-card.tsx'
import { Switch } from './ui/switch.tsx'

const READY: Record<SetupView['readers']['browser'], [State, string]> = {
  ready: ['good', 'Ready'],
  preparing: ['warn', 'Downloading…'],
  'not yet': ['off', 'Not downloaded yet'],
  failed: ['bad', 'Did not download'],
}

export function useSetup(): [SetupView | null, () => void] {
  const [view, setView] = useState<SetupView | null>(null)
  const load = useCallback(() => {
    api.get<SetupView | null>('/api/setup').then(setView, () => setView(null))
  }, [])
  useEffect(() => load(), [load])
  // while something downloads, look again every few seconds
  useEffect(() => {
    if (!view || (view.readers.browser !== 'preparing' && view.readers.documents !== 'preparing'))
      return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [view, load])
  return [view, load]
}

// What this computer gives Alpha, as cards among Connections (they were under
// Permissions): the browser and the PDF reader with Download, Chrome, and keeping the Mac awake.
// Claude's sign-in is the LLM's; each connector is its own card.
export function ThisComputer() {
  const [view, reload] = useSetup()
  if (!view) return null
  const reader = (of: 'browser' | 'documents', title: string, about: string) => {
    const at = view.readers[of]
    const [state, says] = READY[at]
    return (
      <StateCard
        state={state}
        says={says}
        title={title}
        about={about}
        act={
          at === 'preparing' ? (
            <LoaderCircle className="size-3.5 animate-spin text-ink-3" />
          ) : at !== 'ready' ? (
            <Button size="sm" onClick={() => api.post('/api/setup/prepare').then(reload, reload)}>
              Download
            </Button>
          ) : null
        }
        sub={at === 'failed' ? view.readers.problem : null}
      />
    )
  }
  return (
    <>
      {reader(
        'browser',
        'Browser for reading websites',
        'What Alpha reads websites with. About 200 MB.',
      )}
      {reader(
        'documents',
        'PDF reader',
        'What reads PDFs with their pages and places. About 1.6 GB.',
      )}
      <StateCard
        state={view.chrome ? 'good' : 'off'}
        says={view.chrome ? 'On this computer' : 'Not on this computer'}
        title="Chrome"
        about="Only for sites you sign in to; Alpha opens them in Chrome for you to sign in yourself."
      />
      {view.keepAwake !== null && (
        <StateCard
          state={view.keepAwake ? 'good' : 'off'}
          says={view.keepAwake ? 'On' : 'Off'}
          title="Keep this Mac awake"
          about="While plugged in, so schedules run on time; the screen still turns off, and on battery the Mac sleeps."
          act={
            <Switch
              checked={view.keepAwake}
              label="Keep this Mac awake while plugged in"
              named
              onChange={(on) =>
                api.post('/api/setup/awake', { on }).then(() => {
                  reload()
                  if (!on)
                    notify({
                      words: 'This Mac may sleep while plugged in. Turn it on again in',
                      where: { label: 'Connections', href: '#/settings/connections' },
                    })
                }, reload)
              }
            />
          }
        />
      )}
    </>
  )
}

// Claude's own sign-in, started from here: the browser opens, and the line turns green once the
// person has signed in there (asked again every few seconds for a while). Settings › Models uses it.
export function useSignIn(onChange: () => void): [boolean, () => void] {
  const [waiting, setWaiting] = useState(false)
  useEffect(() => {
    if (!waiting) return
    let n = 0
    const t = setInterval(() => {
      onChange()
      if (++n > 60) setWaiting(false)
    }, 3000)
    return () => clearInterval(t)
  }, [waiting, onChange])
  const start = () => {
    setWaiting(true)
    api.post('/api/setup/signin').catch(() => setWaiting(false))
  }
  return [waiting, start]
}
