// Home will be the stream (design §14); until week 1 it only says the core is there.
import type { Health } from '@alpha/core/api'

export function App({ health }: { health: Health | null }) {
  return (
    <main className="flex h-screen items-center justify-center text-neutral-500">
      {health ? `Alpha ${health.version}` : 'Alpha'}
    </main>
  )
}
