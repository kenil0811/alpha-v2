// Find (⌘K): every place in the window by its name, and rows whose words match; Return opens it.
// Out of Shell.tsx so that file only shrinks (Batch A, the window file wall).
import type { FoundRow, ModuleSummary } from '@alpha/core/api'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.ts'
import { cn } from './ui/cn.ts'

export function Find({ modules, onClose }: { modules: ModuleSummary[]; onClose: () => void }) {
  const [words, setWords] = useState('')
  const [at, setAt] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  const places = useMemo(
    () => [
      { label: 'Home', hint: '', href: '#/' },
      { label: 'Conversation', hint: '', href: '#/conversation' },
      { label: 'Tasks', hint: '', href: '#/tasks' },
      { label: 'New task', hint: 'Tasks', href: '#/tasks?list=open' },
      ...modules
        .filter((m) => m.people)
        .flatMap((m) => [
          { label: 'People', hint: m.name, href: '#/people' },
          { label: 'Organizations', hint: m.name, href: '#/people?companies' },
        ]),
      { label: 'Activity', hint: 'Settings', href: '#/settings/activity' },
      { label: 'Intelligence', hint: '', href: '#/intelligence' },
      { label: 'Settings', hint: '', href: '#/settings' },
      ...modules.map((m) => ({
        label: m.name,
        hint: modules.find((p) => p.id === m.parent)?.name ?? 'Module',
        href: `#/module/${m.id}`,
      })),
      ...modules.flatMap((m) =>
        m.tables.map((t) => ({ label: t.name, hint: m.name, href: `#/table/${t.id}` })),
      ),
    ],
    [modules],
  )
  const w = words.trim().toLowerCase()
  // rows whose words match, from the core, a moment after typing stops
  const [rows, setRows] = useState<FoundRow[]>([])
  useEffect(() => {
    if (w.length < 2) {
      setRows([])
      return
    }
    const t = setTimeout(() => {
      api
        .get<FoundRow[]>(`/api/find?words=${encodeURIComponent(w)}`)
        .then(setRows, () => setRows([]))
    }, 180)
    return () => clearTimeout(t)
  }, [w])
  // a name that starts with the words first, then one that holds them, then its module's
  const score = (p: { label: string; hint: string }) => {
    const l = p.label.toLowerCase()
    return l.startsWith(w) ? 0 : l.includes(w) ? 1 : p.hint.toLowerCase().includes(w) ? 2 : 3
  }
  const found = [
    ...(w ? places.filter((p) => score(p) < 3).sort((a, b) => score(a) - score(b)) : places),
    ...rows,
  ]
  const go = (href: string | undefined) => {
    if (href) window.location.hash = href
    onClose()
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop closes Find; Escape does too
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled by the field
    <div
      className="fixed inset-0 z-(--z-overlay) flex justify-center bg-ink/20 pt-24"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops a click inside from closing it */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the field takes the keys */}
      <div
        className="h-fit w-full max-w-140 overflow-hidden rounded-lg border border-line bg-surface shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-hair border-b px-3.5">
          <Search className="size-4 shrink-0 text-ink-3" />
          <input
            ref={input}
            value={words}
            placeholder="Find a screen, a table or a row"
            aria-label="Find"
            className="h-11 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
            onChange={(e) => {
              setWords(e.target.value)
              setAt(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') setAt((a) => Math.min(a + 1, found.length - 1))
              if (e.key === 'ArrowUp') setAt((a) => Math.max(a - 1, 0))
              if (e.key === 'Enter') go(found[at]?.href)
            }}
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {found.length === 0 && (
            <div className="px-2.5 py-2 text-ink-3 text-md">Nothing by that name.</div>
          )}
          {found.map((p, i) => (
            <button
              key={p.href}
              type="button"
              onMouseEnter={() => setAt(i)}
              onClick={() => go(p.href)}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-ink text-md',
                i === at && 'bg-hover',
              )}
            >
              <span className="flex-1 truncate">{p.label}</span>
              {p.hint && <span className="text-ink-3 text-sm">{p.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
