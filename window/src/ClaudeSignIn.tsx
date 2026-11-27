// Claude's own sign-in, started from Alpha: on a Mac the browser opens by itself, and Alpha shows
// the person signed in once they finish there (asked again every few seconds for a while). On a
// PC, Claude runs inside Alpha's Linux and cannot reach the browser: its page is opened from here,
// and the code that page shows is pasted back here, for Claude. Settings › Models and Set up Alpha
// use it.
import { useEffect, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { Button } from './ui/button.tsx'
import { Field } from './ui/field.tsx'

export interface SigningIn {
  page: string | null // on a PC: Claude's page, opened in the person's browser
  problem: string | null // what Claude said when its sign-in did not start
}

export function useSignIn(onChange: () => void): [boolean, () => void, SigningIn] {
  const [waiting, setWaiting] = useState(false)
  const [on, setOn] = useState<SigningIn>({ page: null, problem: null })
  useEffect(() => {
    if (!waiting) return
    let n = 0
    const t = setInterval(() => {
      onChange()
      if (++n > 100) setWaiting(false)
    }, 3000)
    return () => clearInterval(t)
  }, [waiting, onChange])
  const start = () => {
    setWaiting(true)
    setOn({ page: null, problem: null })
    api
      .post<{ started: boolean; open: string | null; said: string | null }>('/api/setup/signin')
      .then(
        (r) => {
          if (r.open) window.open(r.open, '_blank', 'noreferrer')
          setOn({
            page: r.open,
            problem:
              r.open || (r.started && !r.said)
                ? null
                : `Claude’s sign-in did not start. ${r.said ?? ''}`,
          })
          if (!r.started) setWaiting(false)
        },
        (err) => {
          setWaiting(false)
          setOn({ page: null, problem: wordsOf(err) })
        },
      )
  }
  return [waiting, start, on]
}

// On a PC, under Sign in: the page opened again if it did not show, and the code Claude's page
// shows, pasted here for Claude.
export function ClaudeCode({ on }: { on: SigningIn }) {
  const [code, setCode] = useState('')
  const [said, setSaid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (on.problem) return <p className="text-bad text-sm">{on.problem}</p>
  if (!on.page) return null
  const send = async () => {
    setBusy(true)
    setSaid(null)
    try {
      await api.post('/api/setup/signin/code', { code })
      setSaid('Sent to Claude. Alpha shows you signed in in a moment.')
      setCode('')
    } catch (err) {
      setSaid(wordsOf(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-2 text-md">
      <p className="text-ink-2">
        Claude’s sign-in opened in your browser (
        <a
          className="text-accent underline underline-offset-3"
          href={on.page}
          target="_blank"
          rel="noreferrer"
        >
          open it again
        </a>
        ). When it shows a code, paste it here.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim()) void send()
        }}
      >
        <Field
          className="min-w-0 flex-1"
          aria-label="Claude’s code"
          placeholder="Paste the code"
          value={code}
          onChange={(e) => setCode(e.target.value.trim())}
        />
        <Button type="submit" variant="primary" disabled={busy || !code.trim()}>
          Send
        </Button>
      </form>
      {said && <p className="text-ink-2 text-sm">{said}</p>}
    </div>
  )
}
