// Find at the top of Home and of every Overview (Vikas, 2 Nov: "a search bar at top similar to
// home page"): one wide box that opens Find (⌘K). On a module's Overview it finds only what the
// module keeps, and says so (Vikas, 3 Nov).
import { Search } from 'lucide-react'

export function FindBar({ within }: { within?: { id: string; name: string; tables: string[] } }) {
  const kept = within?.tables.map((t) => t.toLowerCase()) ?? []
  const listed =
    kept.length > 1 ? `${kept.slice(0, -1).join(', ')} and ${kept.at(-1)}` : (kept[0] ?? '')
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent('alpha:find', { detail: within?.id ?? null }))
      }
      className="flex h-11 w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 text-ink-3 shadow-pop hover:border-accent-line"
    >
      <Search className="size-4" />
      <span className="flex-1 truncate text-left">
        {within
          ? `Find in ${within.name}${listed ? `: ${listed}` : ''}`
          : 'Find a client, a person, a task or a module'}
      </span>
      <kbd className="text-sm">⌘K</kbd>
    </button>
  )
}
