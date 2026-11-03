// New module (Vikas, 26 Oct; 3 Nov: the prompt alone, no empty table, and an upload under it for
// a module sent as a file): its name and what it should keep. Build it sends the words to Alpha
// and opens the assistant on the right, where Alpha asks and plans; when the module is made, the page goes to it.
// Cancel and Escape go back.
import type { ModuleSummary } from '@alpha/core/api'
import { type FormEvent, type RefObject, useEffect, useRef, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { Button } from './ui/button.tsx'
import { DropZone } from './ui/drop-zone.tsx'
import { Field, Select } from './ui/field.tsx'

// the words Alpha is sent
export const buildWords = (name: string, what: string) =>
  name.trim()
    ? `Make a module called ${name.trim()}: ${what.trim()}`
    : `Make a module: ${what.trim()}`

const back = () => {
  if (window.history.length > 1) window.history.back()
  else window.location.hash = '#/'
}

// Escape goes back: not while a pop-up is open, or while typing outside the page (the
// assistant's composer).
function useEscapeBack(page: RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('dialog[open]')) return
      const t = e.target
      if (
        t instanceof HTMLElement &&
        t.closest('input, textarea, select, [contenteditable=true]') &&
        !page.current?.contains(t)
      )
        return
      e.preventDefault()
      back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page])
}

export const agentWords = (what: string) => `Make an agent in this module: ${what.trim()}`

// New agent (proposal 28 Oct §1 #2): New module's page, asking what it should do and in which
// module. Make it sends the words to Alpha in that module's conversation and opens the assistant;
// the agent comes paused, with Activate, in the Agents list.
export function NewAgent({
  modules,
  onAsked,
}: {
  modules: { id: string; name: string }[]
  onAsked: () => void
}) {
  const [what, setWhat] = useState('')
  // from a module's Agents card (#/agent/new?module=<id>), that module
  const [module, setModule] = useState(
    () => /[?&]module=([\w-]+)/.exec(window.location.hash)?.[1] ?? modules[0]?.id ?? '',
  )
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const page = useRef<HTMLFormElement>(null)
  useEscapeBack(page)
  const at = (modules.some((m) => m.id === module) && module) || modules[0]?.id || ''

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!what.trim() || !at || busy) return
    setBusy(true)
    setProblem(null)
    try {
      await api.post('/api/say', { words: agentWords(what), from: at })
      onAsked()
      window.location.hash = '#/intelligence/agents'
    } catch (err) {
      setProblem(wordsOf(err))
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <form ref={page} onSubmit={send} className="flex max-w-page flex-col gap-4 px-7 py-6">
        <textarea
          // biome-ignore lint/a11y/noAutofocus: the page is for this
          autoFocus
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) page.current?.requestSubmit()
          }}
          rows={4}
          placeholder="What should it do, and when?"
          aria-label="What should it do, and when?"
          disabled={busy}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink text-md outline-none placeholder:text-ink-3 focus:border-accent-line focus:ring-3 focus:ring-accent-soft"
        />
        <div className="flex items-center gap-3 text-ink-2 text-md">
          In
          <Select
            aria-label="Module"
            value={at}
            onChange={(e) => setModule(e.target.value)}
            disabled={busy}
            className="w-64"
          >
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={!what.trim() || !at || busy}>
            {busy ? 'Making…' : 'Make it'}
          </Button>
          <Button variant="ghost" onClick={back}>
            Cancel
          </Button>
          {problem && <span className="text-bad text-sm">{problem}</span>}
        </div>
      </form>
    </div>
  )
}

export function NewModule({
  modules,
  onAsked,
}: {
  modules: ModuleSummary[]
  onAsked: () => void // the assistant opens on the conversation
}) {
  const [name, setName] = useState('')
  const [what, setWhat] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // the modules there were when the words went, so the new one shows when it comes
  const [before, setBefore] = useState<Set<string> | null>(null)
  const page = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const made = before && modules.find((m) => !before.has(m.id))
    if (made) window.location.hash = `#/module/${made.id}`
  }, [before, modules])

  const [uploading, setUploading] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  // a module pack installed, or its kit updated; the new module opens as it comes
  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setProblem(null)
    try {
      setBefore(new Set(modules.map((m) => m.id)))
      setSaid((await api.uploadTo<{ words: string }>('/api/kits/pack', file)).words)
    } catch (err) {
      setProblem(wordsOf(err))
    } finally {
      setUploading(false)
    }
  }
  useEscapeBack(page)

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!what.trim() || busy) return
    setBusy(true)
    setProblem(null)
    try {
      await api.post('/api/say', { words: buildWords(name, what) })
      setBefore(new Set(modules.map((m) => m.id)))
      onAsked()
    } catch (err) {
      setProblem(wordsOf(err))
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <form ref={page} onSubmit={send} className="flex max-w-page flex-col gap-4 px-7 py-6">
        <Field
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          aria-label="Name"
          disabled={busy}
          className="h-auto max-w-md border-transparent bg-transparent px-0 font-serif text-2xl focus:ring-0"
        />
        <textarea
          // biome-ignore lint/a11y/noAutofocus: the page is for this
          autoFocus
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) page.current?.requestSubmit()
          }}
          rows={4}
          placeholder="What should it keep track of?"
          aria-label="What should it keep track of?"
          disabled={busy}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink text-md outline-none placeholder:text-ink-3 focus:border-accent-line focus:ring-3 focus:ring-accent-soft"
        />
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={!what.trim() || busy}>
            {busy ? 'Building…' : 'Build it'}
          </Button>
          <Button variant="ghost" onClick={back}>
            Cancel
          </Button>
          {problem && <span className="text-bad text-sm">{problem}</span>}
        </div>
        {/* or a module someone made, sent as a file (Vikas, 3 Nov: no empty table here) */}
        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-ink-2 text-sm">Or upload a module</span>
          <DropZone accept=".alphakit" busy={uploading} onFiles={(f) => void upload(f[0])} />
          {said && <span className="text-ink-2 text-sm">{said}</span>}
        </div>
      </form>
    </div>
  )
}
