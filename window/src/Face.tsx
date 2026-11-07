// Alpha's face in the assistant's header: quiet, working, or something needs you. A stand-in until
// Kenil picks Alpha's character.
import { cn } from './ui/cn.ts'

export type Mood = 'quiet' | 'working' | 'needs'

export function Face({ mood }: { mood: Mood }) {
  const light = {
    quiet: 'var(--face-quiet)',
    working: 'var(--face-busy)',
    needs: 'var(--face-needs)',
  }[mood]
  const eyeY = 46
  const eyeRy = mood === 'needs' ? 8.5 : 7
  const look = mood === 'working' ? 3 : 0
  const ink = 'var(--face-ink)'
  return (
    <svg viewBox="0 0 100 100" className="size-full" aria-hidden="true">
      <line x1="50" y1="16" x2="50" y2="8" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      <circle
        cx="50"
        cy="6.5"
        r="5"
        fill={light}
        stroke={ink}
        strokeWidth="2"
        className={cn(mood === 'working' && 'face-pulse')}
      />
      <rect
        x="12"
        y="15"
        width="76"
        height="70"
        rx="30"
        fill="var(--face)"
        stroke={ink}
        strokeWidth="2.6"
      />
      <ellipse cx="38" cy="26" rx="14" ry="5" fill="var(--face-shine)" opacity="0.28" />
      <g className={cn(mood !== 'needs' && 'face-blink')}>
        <ellipse cx={37 + look} cy={eyeY} rx="5.5" ry={eyeRy} fill={ink} />
        <ellipse cx={63 + look} cy={eyeY} rx="5.5" ry={eyeRy} fill={ink} />
      </g>
      <circle cx={39 + look} cy={eyeY - 3} r="1.8" fill="var(--face-shine)" />
      <circle cx={65 + look} cy={eyeY - 3} r="1.8" fill="var(--face-shine)" />
      <ellipse cx="26" cy="60" rx="6" ry="3.6" fill="var(--face-cheek)" opacity="0.75" />
      <ellipse cx="74" cy="60" rx="6" ry="3.6" fill="var(--face-cheek)" opacity="0.75" />
      {mood === 'needs' ? (
        <ellipse cx="50" cy="63" rx="3.6" ry="4.2" fill={ink} />
      ) : mood === 'working' ? (
        <path
          d="M45 62 Q50 64 55 62"
          stroke={ink}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M43 59 Q50 66 57 59"
          stroke={ink}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}
