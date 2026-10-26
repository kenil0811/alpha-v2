import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './app.css'
import { Companion } from './Companion.tsx'
import { applyTheme, savedTheme } from './theme.ts'
import { Tooltips } from './ui/tooltip.tsx'

applyTheme(savedTheme())

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      {/* the Mac app's companion window opens on #/companion: the face alone, no screens */}
      {window.location.hash.startsWith('#/companion') ? <Companion /> : <App />}
      <Tooltips />
    </StrictMode>,
  )
}
