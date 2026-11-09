// Copy to the clipboard, with a moment's tick to say it went.
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { IconButton } from './button.tsx'

export function CopyButton({ text, className }: { text: () => string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <IconButton
      label={done ? 'Copied' : 'Copy'}
      className={className}
      onClick={() => {
        void navigator.clipboard?.writeText(text())
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </IconButton>
  )
}
