// The one Back (Vikas, 28 Oct): an arrow and the word, at the left of a header, the same in the
// window's bar and the side panel. Its tooltip names where it goes.
import { ArrowLeft } from 'lucide-react'
import { cn } from './cn.ts'

const LOOK =
  'flex h-7 shrink-0 items-center gap-1.5 rounded-md pr-2.5 pl-1.5 text-base text-ink-2 transition-colors hover:bg-hover hover:text-ink'

export function Back({ to, href, onClick }: { to: string; href?: string; onClick?: () => void }) {
  const inner = (
    <>
      <ArrowLeft className="size-4 shrink-0" />
      Back
    </>
  )
  return href ? (
    <a href={href} data-tip={`Back to ${to}`} className={cn(LOOK)}>
      {inner}
    </a>
  ) : (
    <button type="button" data-tip={`Back to ${to}`} onClick={onClick} className={LOOK}>
      {inner}
    </button>
  )
}
