// The shell (design §14, Ledger): the rail on the left and a 48px bar over every screen. The rail
// has the mark, Home with a badge for what waits on the person, Conversation, Activity, the modules as a tree
// of their tables, Settings and Alpha's state at its foot. Its top 48px is left for the Mac's
// window buttons when the window has a shell of its own.
import type { FoundRow, ModuleSummary } from '@alpha/core/api'
import {
  Activity,
  Briefcase,
  ChevronDown,
  ChevronRight,
  House,
  LayoutDashboard,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.ts'
import { cn } from './ui/cn.ts'
import { Kbd } from './ui/pill.tsx'

export type Place =
  | { at: 'home' }
  | { at: 'conversation' }
  | { at: 'activity' }
  | { at: 'parts' }
  | { at: 'table'; id: string; row: string | null; only: string[] | null; field: string | null }
  | { at: 'module'; id: string; tab: 'conversation' | 'agents' | null; page: string | null }
  | { at: 'settings'; open: string | null }

function Nav({
  href,
  icon,
  label,
  current,
  extra,
  small,
}: {
  href: string
  icon: ReactNode
  label: string
  current: boolean
  extra?: ReactNode
  small?: boolean
}) {
  return (
    <a
      href={href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'group flex w-full shrink-0 items-center gap-2.25 rounded-md px-2 text-md text-rail-ink-2 transition-colors hover:bg-rail-hover hover:text-rail-ink',
        small ? 'h-7' : 'h-7.5',
        current && 'bg-rail-sel font-medium text-rail-ink shadow-btn',
      )}
    >
      <span className={cn('shrink-0 text-rail-ink-3', current && 'text-accent')}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {extra}
    </a>
  )
}

export function Rail({
  modules,
  place,
  name,
  waiting,
  running,
  online,
}: {
  modules: ModuleSummary[]
  place: Place
  name: string
  waiting: number
  running: number
  online: boolean
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setClosed((c) => {
      const n = new Set(c)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  return (
    <nav className="flex w-54 shrink-0 flex-col overflow-hidden border-rail-line border-r bg-rail px-2.5 pb-2.5 text-rail-ink">
      <div className="h-12 shrink-0" aria-hidden="true" />
      <div className="flex items-center gap-2.5 px-1.5 pb-3.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ink font-semibold font-serif text-canvas text-lg leading-none">
          A
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-base leading-tight">Alpha</span>
          <span className="block truncate text-rail-ink-3 text-xs">
            {name ? `${name} · on this Mac` : 'On this Mac'}
          </span>
        </span>
      </div>
      <Nav
        href="#/"
        icon={<House className="size-4" />}
        label="Home"
        current={place.at === 'home'}
        extra={
          waiting > 0 && (
            <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1.25 font-semibold text-accent-ink text-xs">
              {waiting}
            </span>
          )
        }
      />
      <Nav
        href="#/conversation"
        icon={<MessageSquare className="size-4" />}
        label="Conversation"
        current={place.at === 'conversation'}
      />
      <Nav
        href="#/activity"
        icon={<Activity className="size-4" />}
        label="Activity"
        current={place.at === 'activity'}
        extra={
          running > 0 && (
            <span
              title={`${running} running`}
              className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent"
            />
          )
        }
      />
      <div className="px-2 pt-4 pb-1 font-semibold text-rail-ink-3 text-xs uppercase tracking-label">
        Modules
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {modules.length === 0 && (
          <div className="px-2 py-1 text-rail-ink-3 text-sm">
            Modules appear here as you ask for them.
          </div>
        )}
        {modules.map((m) => {
          const open = !closed.has(m.id)
          return (
            <div key={m.id}>
              <div className="flex items-center">
                <Nav
                  href={`#/module/${m.id}`}
                  icon={<Briefcase className="size-4" />}
                  label={m.name}
                  current={place.at === 'module' && place.id === m.id}
                />
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={open ? `Fold ${m.name}` : `Unfold ${m.name}`}
                  onClick={() => toggle(m.id)}
                  className="-ml-7 grid size-7 shrink-0 place-items-center rounded-md text-rail-ink-3 hover:text-rail-ink"
                >
                  {open ? (
                    <ChevronDown className="size-3.25" />
                  ) : (
                    <ChevronRight className="size-3.25" />
                  )}
                </button>
              </div>
              {open && (
                <div className="flex flex-col pl-4">
                  {m.pages.map((pg) => (
                    <Nav
                      key={pg.name}
                      small
                      href={`#/module/${m.id}/page/${pg.name}`}
                      icon={<LayoutDashboard className="size-4" />}
                      label={pg.title}
                      current={place.at === 'module' && place.id === m.id && place.page === pg.name}
                    />
                  ))}
                  {m.tables.map((t) => (
                    <Nav
                      key={t.id}
                      small
                      href={`#/table/${t.id}`}
                      icon={<Table2 className="size-4" />}
                      label={t.name}
                      current={place.at === 'table' && place.id === t.id}
                      extra={
                        <span className="shrink-0 text-rail-ink-3 text-xs tabular-nums">
                          {t.rows}
                        </span>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex flex-col gap-0.5 pt-2">
        <Nav
          href="#/settings"
          icon={<SlidersHorizontal className="size-4" />}
          label="Settings"
          current={place.at === 'settings'}
        />
        <div className="flex items-center gap-1.75 px-2 py-1.5 text-rail-ink-3 text-xs">
          <span className={cn('size-1.75 shrink-0 rounded-full', online ? 'bg-good' : 'bg-warn')} />
          {online ? 'Alpha is running' : 'Alpha is not answering'}
        </div>
      </div>
    </nav>
  )
}

// Where a screen sits, for the bar: a few words, the last in bold.
export interface Crumb {
  icon?: ReactNode
  parts: string[]
}

export function Bar({
  crumb,
  onFind,
  lens,
  onClearLens,
  ask,
  onAsk,
}: {
  crumb: Crumb
  onFind: () => void
  lens: { id: string; name: string } | null
  onClearLens: () => void
  ask: { name: string } | null // Ask Alpha, or Ask about a module on its screen; none where the conversation is
  onAsk: () => void
}) {
  const last = crumb.parts.at(-1) ?? ''
  return (
    <div className="flex h-12 shrink-0 items-center gap-2.5 border-hair border-b bg-canvas pr-3.5 pl-6">
      <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-ink-3 text-md">
        {crumb.icon && <span className="shrink-0">{crumb.icon}</span>}
        {crumb.parts.slice(0, -1).map((p) => (
          <span key={p} className="flex items-center gap-1.5">
            <span>{p}</span>
            <ChevronRight className="size-3.25" />
          </span>
        ))}
        <b className="truncate font-semibold text-ink">{last}</b>
      </div>
      {lens && (
        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-accent-soft pr-0.75 pl-2.25 font-medium text-accent text-sm">
          Only {lens.name}
          <button
            type="button"
            aria-label={`Show all, not only ${lens.name}`}
            title="Show all"
            onClick={onClearLens}
            className="grid size-5 place-items-center rounded-full hover:bg-accent-line/40"
          >
            <X className="size-3.25" />
          </button>
        </span>
      )}
      <span className="flex-1" />
      {ask && (
        <button
          type="button"
          onClick={onAsk}
          className="flex h-7.5 items-center gap-2 rounded-md px-2.5 text-ink-2 text-md transition-colors hover:bg-hover hover:text-ink"
        >
          <MessageSquare className="size-3.5 shrink-0" />
          {ask.name ? `Ask about ${ask.name}` : 'Ask Alpha'}
          <Kbd>⌘J</Kbd>
        </button>
      )}
      <button
        type="button"
        onClick={onFind}
        className="flex h-7.5 w-52.5 items-center gap-2 rounded-md border border-line bg-surface pr-2 pl-2.5 text-ink-3 text-md transition-colors hover:border-accent-line"
      >
        <Search className="size-3.25 shrink-0" />
        <span className="flex-1 text-left">Find anything</span>
        <Kbd>⌘K</Kbd>
      </button>
    </div>
  )
}

// Find (⌘K): every place in the window by its name; Return opens it.
export function Find({ modules, onClose }: { modules: ModuleSummary[]; onClose: () => void }) {
  const [words, setWords] = useState('')
  const [at, setAt] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  const places = useMemo(
    () => [
      { label: 'Home', hint: '', href: '#/' },
      { label: 'Conversation', hint: '', href: '#/conversation' },
      { label: 'Activity', hint: '', href: '#/activity' },
      { label: 'Settings', hint: '', href: '#/settings' },
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
    <div className="fixed inset-0 z-20 flex justify-center bg-ink/20 pt-24" onClick={onClose}>
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
