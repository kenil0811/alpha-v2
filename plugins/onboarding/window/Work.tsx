// Show the work (onboarding design §5): everything that went to Claude for a look, as it went (the
// overview, then each look with what it got), and Forget, which deletes all of it.
import { Button, Refusal, Section, useAct } from '@alpha/window/kit'
import { useState } from 'react'
import type { Run } from '../src/run.ts'
import { onboarding } from './routes.ts'

// What a look asked, in plain words (no tool's name): "Your day, 29 Oct", "Mail with Vikas".
const day = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
function asked(tool: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, string | undefined>
  const about = (what: string) => (i.words ? `${what} with “${i.words}”` : what)
  switch (tool) {
    case 'day':
      return i.date ? `Your day, ${day(i.date)}` : 'Your days'
    case 'sites':
      return i.site ? `Browsing: ${i.site}` : about('Browsing')
    case 'apps':
      return i.app ? `Apps: ${i.app}` : 'Apps'
    case 'files':
      return i.folder ? `File names in ${i.folder}` : about('File names')
    case 'mail':
      return i.who ? `Mail with ${i.who}` : about('Mail')
    case 'calendar':
      return about('Meetings')
    case 'contacts':
      return about('Contacts')
    default:
      return about('Everything')
  }
}

export function Work({ run, onForgot }: { run: Run; onForgot: () => void }) {
  const [open, setOpen] = useState(false)
  const [look, setLook] = useState<string | null>(null)
  const forget = useAct(onForgot)
  return (
    <Section
      title="What was sent"
      about="Everything that went to Claude for this look, as it went. Forget deletes it from this Mac."
    >
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setOpen(!open)}>
          {open ? 'Hide the work' : 'Show the work'}
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={forget.busy}
          onClick={() => void forget.act(() => onboarding.post('/forget', { run: run.id }))}
        >
          Forget this look
        </Button>
        <span className="text-ink-3 text-sm">
          {run.calls.length} {run.calls.length === 1 ? 'look' : 'looks'} after the overview
        </span>
        <Refusal words={forget.problem} />
      </div>
      {open && (
        <div className="flex flex-col gap-2">
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-hair bg-canvas px-3 py-2.5 text-ink text-sm">
            {run.overview}
          </pre>
          {run.calls.map((c) => (
            <div key={c.id} className="flex flex-col gap-1">
              <button
                type="button"
                className="self-start text-accent text-sm underline underline-offset-3"
                onClick={() => setLook(look === c.id ? null : c.id)}
              >
                {asked(c.tool, c.input)}
              </button>
              {look === c.id && (
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-hair bg-canvas px-3 py-2.5 text-ink text-sm">
                  {JSON.stringify(c.output, null, 1)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
