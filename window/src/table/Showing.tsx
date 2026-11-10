// The showing line under a list's tabs: what hides rows, Clear filters for the list's own filters
// and search, Show all for rows a page or a row sent the person to.
import { showingWords } from './hiding.ts'

export function Showing({
  shown,
  total,
  hiding,
  came,
  allHref,
  onClear,
}: {
  shown: number
  total: number
  hiding: string[]
  came: 'page' | 'row' | null
  allHref: string
  onClear: () => void
}) {
  const words = showingWords({ shown, total, hiding, came })
  if (!words) return null
  return (
    <div className="flex items-center gap-3 border-line border-b bg-accent-soft px-7 py-2 text-ink-2 text-md">
      <span className="flex-1">{words}</span>
      {hiding.length > 0 && (
        <button type="button" onClick={onClear} className="font-medium text-accent hover:underline">
          Clear filters
        </button>
      )}
      {came && (
        <a href={allHref} className="font-medium text-accent hover:underline">
          Show all
        </a>
      )}
    </div>
  )
}
