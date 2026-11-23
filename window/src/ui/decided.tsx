// A decision that feels finished (motion, 23 Nov): Approve stamps a tick over the card, a beat,
// and it folds away; Decline slides it out, greyed. The answer goes in meanwhile; if it fails, the
// card comes back as it was, with its problem.
import { Check } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { cn } from './cn.ts'
import { fold, pause, unfold } from './motion.ts'

export function useDecide() {
  const box = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState<'yes' | 'no' | null>(null)
  // seen first, then sent: sent first, the live update would take the card away mid-stamp
  const decide = async (yes: boolean, send: () => Promise<unknown>) => {
    setShown(yes ? 'yes' : 'no')
    await pause(yes ? 520 : 280)
    await fold(box.current)
    try {
      await send()
    } catch (err) {
      unfold(box.current)
      setShown(null)
      throw err
    }
  }
  return { box, shown, decide }
}

export function Decided({
  box,
  shown,
  children,
}: {
  box: React.RefObject<HTMLDivElement | null>
  shown: 'yes' | 'no' | null
  children: ReactNode
}) {
  return (
    <div
      ref={box}
      className={cn(
        'relative animate-rise transition-[opacity,translate,filter] duration-320 ease-soft',
        shown === 'no' && '-translate-x-6 opacity-0 grayscale',
      )}
    >
      {children}
      {shown === 'yes' && (
        <div className="absolute inset-0 grid animate-rise place-items-center rounded-lg bg-good-soft/90">
          <Check className="tick-draw size-9 text-good" strokeWidth={3} />
        </div>
      )}
    </div>
  )
}
