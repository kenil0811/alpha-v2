import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './app.css'
import { Companion } from './Companion.tsx'
import { shiftClock } from './clock.ts'
import { applyTheme, savedTheme } from './theme.ts'
import { LinkStatus } from './ui/link-status.tsx'
import { Tooltips } from './ui/tooltip.tsx'

applyTheme(savedTheme())

// a demo's clock comes first, so the first screen already says the core's day
const health = await fetch('/api/health')
  .then((r) => r.json() as Promise<{ now?: string }>)
  .catch(() => ({}) as { now?: string })
if (health.now) shiftClock(health.now)

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      {/* the Mac app's companion window opens on #/companion: the face alone, no screens */}
      {window.location.hash.startsWith('#/companion') ? <Companion /> : <App />}
      <Tooltips />
      <LinkStatus />
    </StrictMode>,
  )
}
