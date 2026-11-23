// A decision that feels finished: Approve stamps a tick over the card, a beat, and it folds away;
// Decline slides it out, greyed. The answer is sent at once, as the stamp shows: the card is
// held while it leaves (motion.ts), so a live update cannot take it mid-stamp, and closing the
// window then loses nothing. If the answer fails, the card comes back as it was, with its problem.
import { Check } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { cn } from './cn.ts'
import { fold, leaveWith, pause, unfold } from './motion.ts'

export function useDecide(id: string) {
  const box = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState<'yes' | 'no' | null>(null)
  const decide = async (yes: boolean, send: () => Promise<unknown>) => {
    setShown(yes ? 'yes' : 'no')
    await leaveWith(
      id,
      send,
      async () => {
        await pause(yes ? 520 : 280)
        await fold(box.current)
      },
      () => {
        unfold(box.current)
        setShown(null)
      },
    )
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
