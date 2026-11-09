import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './app.css'
import { Gate } from './SignIn.tsx'
import { applyTheme, savedTheme } from './theme.ts'
import { LinkStatus } from './ui/link-status.tsx'
import { Tooltips } from './ui/tooltip.tsx'

applyTheme(savedTheme())

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Gate>
        <App />
      </Gate>
      <Tooltips />
      <LinkStatus />
    </StrictMode>,
  )
}
