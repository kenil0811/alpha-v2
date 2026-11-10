// While something loads: nothing at first, so a quick load never flashes words; a quiet line only
// once it has taken a while.
import { useEffect, useState } from 'react'
import { cn } from './cn.ts'

const LATE_MS = 800

export function Waiting({ className }: { className?: string }) {
  const [late, setLate] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLate(true), LATE_MS)
    return () => clearTimeout(t)
  }, [])
  return (
    <p
      aria-busy="true"
      className={cn(
        'p-6 text-ink-3 transition-opacity duration-300',
        late ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      Loading…
    </p>
  )
}
