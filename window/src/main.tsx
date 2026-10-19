import type { Health } from '@alpha/core/api'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './app.css'

function Root() {
  const [health, setHealth] = useState<Health | null>(null)
  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? (res.json() as Promise<Health>) : null))
      .then(setHealth, () => setHealth(null))
  }, [])
  return <App health={health} />
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  )
}
