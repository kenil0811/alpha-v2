// The showing line under a list's tabs, for rows a page or a row sent the person to: how many
// show, and Show all for the rest.
import { showingWords } from './hiding.ts'

export function Showing({
  shown,
  total,
  came,
  allHref,
}: {
  shown: number
  total: number
  came: 'page' | 'row' | null
  allHref: string
}) {
  const words = showingWords({ shown, total, came })
  if (!words) return null
  return (
    <div className="flex items-center gap-3 border-line border-b bg-accent-soft px-7 py-2 text-ink-2 text-md">
      <span className="flex-1">{words}</span>
      <a href={allHref} className="font-medium text-accent hover:underline">
        Show all
      </a>
    </div>
  )
}
