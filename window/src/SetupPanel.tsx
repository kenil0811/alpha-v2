// This Mac's setup in words (packaging, piece 3): Claude signed in, the reading browser and the
// document reader downloaded, Gmail, Calendar and Contacts connected, Chrome there for sites the
// person signs in to. On Home while something essential is not ready; always in Settings.
import type { SetupView } from '@alpha/core/api'
import { Check, ChevronRight, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Switch } from './ui/switch.tsx'

const READY: Record<SetupView['readers']['browser'], string> = {
  ready: 'Ready',
  preparing: 'Downloading…',
  'not yet': 'Not downloaded yet',
  failed: 'Did not download',
}

// Whether the Mac still needs something before Alpha can work fully.
export function unready(s: SetupView): boolean {
  return !s.claude.signedIn || s.readers.browser !== 'ready' || s.readers.documents !== 'ready'
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

export function SetupList({ view, onChange }: { view: SetupView; onChange: () => void }) {
  const prepare = () => api.post('/api/setup/prepare').then(onChange, onChange)
  const items: {
    done: boolean
    busy?: boolean
    words: string
    sub: string
    act?: React.ReactNode
  }[] = [
    {
      done: view.claude.signedIn,
      words: view.claude.signedIn
        ? `Claude: signed in${view.claude.email ? ` as ${view.claude.email}` : ''}`
        : 'Sign in to Claude',
      sub: view.claude.signedIn
        ? view.route === 'key'
          ? 'Through the API key kept in the Keychain'
          : 'On your own Claude subscription; Alpha never sees your sign-in'
        : (view.claude.problem ??
          'In Terminal, run alpha signin and sign in with your Claude account in the page that opens.'),
    },
    {
      done: view.readers.browser === 'ready',
      busy: view.readers.browser === 'preparing',
      words: `The reading browser: ${READY[view.readers.browser]}`,
      sub: 'What Alpha reads websites with, about 200 MB',
    },
    {
      done: view.readers.documents === 'ready',
      busy: view.readers.documents === 'preparing',
      words: `The document reader: ${READY[view.readers.documents]}`,
      sub: 'What reads PDFs with their pages and places, about 1.6 GB',
    },
    {
      done: view.connected.gmail,
      words: view.connected.gmail ? 'Gmail: connected' : 'Connect Gmail',
      sub: 'So Alpha can read your mail and send what you say yes to',
      act: view.connected.gmail ? null : <a href="#/settings?connect=gmail">Connect</a>,
    },
    {
      done: view.connected.calendar && view.connected.contacts,
      words: 'Calendar and contacts',
      sub: 'Through your Mac’s own Calendar and Contacts; macOS asks you once for each',
      act:
        view.connected.calendar && view.connected.contacts ? null : (
          <a href="#/settings?connect=calendar">Connect</a>
        ),
    },
    {
      done: view.chrome,
      words: view.chrome ? 'Google Chrome is on this Mac' : 'Google Chrome',
      sub: 'Only for sites you sign in to; Alpha opens them in Chrome for you to sign in yourself',
    },
  ]
  const waiting =
    (view.readers.browser !== 'ready' && view.readers.browser !== 'preparing') ||
    (view.readers.documents !== 'ready' && view.readers.documents !== 'preparing')
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {items.map((s) => (
          <div
            key={s.words}
            className="flex items-center gap-3 border-hair border-t px-4 py-3 first:border-t-0"
          >
            <span
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-full border',
                s.done ? 'border-good bg-good text-surface' : 'border-line',
              )}
            >
              {s.done && <Check className="size-3" />}
              {s.busy && <LoaderCircle className="size-3 animate-spin text-ink-3" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink">{s.words}</span>
              <span className="block text-ink-3 text-sm">{s.sub}</span>
            </span>
            {s.act && (
              <span className="flex items-center gap-1 text-accent text-sm">
                {s.act}
                <ChevronRight className="size-3.5" />
              </span>
            )}
          </div>
        ))}
      </div>
      {view.keepAwake !== null && (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-ink">Keep this Mac awake while plugged in</span>
            <span className="block text-ink-3 text-sm">
              So agents run on time; the screen still turns off, and on battery the Mac sleeps
            </span>
          </span>
          <Switch
            checked={view.keepAwake}
            label="Keep this Mac awake while plugged in"
            onChange={(on) => api.post('/api/setup/awake', { on }).then(onChange, onChange)}
          />
        </div>
      )}
      {view.readers.problem && <p className="text-bad text-sm">{view.readers.problem}</p>}
      {waiting && (
        <div>
          <Button size="sm" onClick={prepare}>
            Download what reading needs
          </Button>
        </div>
      )}
    </div>
  )
}
