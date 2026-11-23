import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './app.css'
import { Gate } from './SignIn.tsx'
import { StoryGate } from './story/Story.tsx'
import { applyTextSize, applyTheme, savedTextSize, savedTheme } from './theme.ts'
import { LinkStatus } from './ui/link-status.tsx'
import { Notices } from './ui/notice.tsx'
import { Tooltips } from './ui/tooltip.tsx'

applyTheme(savedTheme())
applyTextSize(savedTextSize())

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Gate>
        <StoryGate>
          <App />
        </StoryGate>
      </Gate>
      <Tooltips />
      <LinkStatus />
      <Notices />
    </StrictMode>,
  )
}
