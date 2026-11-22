// Under a table's last row: three blank rows when it has none (an empty table keeps its frame, and
// says nothing, T5), then whatever room is left in the box, so the totals row always rests on the
// foot however few the rows (T3).
import { type RefObject, useEffect, useRef, useState } from 'react'

export function useRoomBelow(box: RefObject<HTMLDivElement | null>, rows: number, span: number) {
  const table = useRef<HTMLTableElement>(null)
  const [room, setRoom] = useState(0)
  useEffect(() => {
    const b = box.current
    const t = table.current
    if (!b || !t) return
    // the box's height less the table's own, without the room already given
    const fit = () => setRoom((was) => Math.max(0, b.clientHeight - (t.offsetHeight - was)))
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(b)
    watch.observe(t)
    return () => watch.disconnect()
  }, [box])
  const below = (
    <>
      {rows === 0 &&
        [0, 1, 2].map((n) => (
          <tr key={`blank${n}`} aria-hidden>
            <td colSpan={span} className="h-9.5 border-hair border-b p-0" />
          </tr>
        ))}
      {room > 0 && (
        <tr aria-hidden>
          <td colSpan={span} className="p-0" style={{ height: room }} />
        </tr>
      )}
    </>
  )
  return [table, below] as const
}
