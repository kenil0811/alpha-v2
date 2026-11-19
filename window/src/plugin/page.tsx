// A plugin's own page, or plain words where no plugin of that name is on in this window.
import { screenOf } from './screens.ts'

export function PluginPage({ name }: { name: string }) {
  const Page = screenOf(name)?.Page
  return Page ? <Page /> : <p className="p-8 text-ink-2 text-md">Nothing is here.</p>
}
