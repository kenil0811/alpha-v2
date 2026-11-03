// Find at the top of Home and of every Overview (Vikas, 2 Nov: "a search bar at top similar to
// home page"): one wide box that opens Find (⌘K), the same everywhere.
import { Search } from 'lucide-react'

export function FindBar() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('alpha:find'))}
      className="flex h-11 w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 text-ink-3 shadow-pop hover:border-accent-line"
    >
      <Search className="size-4" />
      <span className="flex-1 text-left">Find a client, a person, a task or a module</span>
      <kbd className="text-sm">⌘K</kbd>
    </button>
  )
}
