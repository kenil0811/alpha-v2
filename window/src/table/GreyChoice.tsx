// A grey value (estimated, assumed) double-clicked: ✓ keeps it as the person's own, ✕ empties it
// and keeps it turned down so Alpha does not guess the same again. Escape leaves it as it was.
import { YesNo } from '../ui/yes-no.tsx'

export type Grey = 'accept' | 'reject'

export const isGrey = (kind: string | undefined) => kind === 'estimated' || kind === 'assumed'

export function GreyChoice({
  text,
  onChoose,
  onCancel,
}: {
  text: string
  onChoose: (g: Grey) => void
  onCancel: () => void
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only catches Escape and focus leaving from its buttons
    <span
      className="flex items-center gap-1 px-2.5"
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && onCancel()}
    >
      <span className="truncate text-ink-2 italic">{text}</span>
      {/* opened by a double-click, so Escape and Tab work at once */}
      <YesNo
        value={null}
        yes="Accept as yours"
        no="Empty it"
        autoFocus
        onChange={(a) => onChoose(a === 'yes' ? 'accept' : 'reject')}
      />
    </span>
  )
}
