// What a plugin's screen may use: the window's own shared pieces and a way to its own routes,
// nothing else, so a plugin's page looks and acts as the window's own screens do and cannot drift
// from them. A plugin's screen imports only this.
import type { ModuleSummary } from '@alpha/core/api'
import type { ComponentType } from 'react'
import { api } from '../api.ts'

export { Check, LoaderCircle, Sparkles } from 'lucide-react'
export { wordsOf } from '../api.ts'

export { startAsk } from '../ask.ts'
export { Refusal, useAct } from '../ui/act.tsx'
export { Button, IconButton } from '../ui/button.tsx'
export { Actions, Card } from '../ui/card.tsx'
export { Field } from '../ui/field.tsx'
export { Group, Line, Quiet } from '../ui/groups.tsx'
export { List, Row, Tile } from '../ui/list.tsx'
export { Label, Pill } from '../ui/pill.tsx'
export { Answer, Question } from '../ui/question.tsx'
export { Empty, Section } from '../ui/section.tsx'
export { Switch } from '../ui/switch.tsx'
export { Words } from '../ui/words.tsx'

// A plugin's page and, when something waits for the person, its row on Home.
export interface Screen {
  name: string // the plugin's: its page is #/p/<name>
  title: string // the page's name in the bar
  Page: ComponentType
  Waiting?: ComponentType // a row on Home; none when nothing waits
}

// The plugin's own routes, answered by the core as the person (/api/plugins/<name>/…).
export function routes(plugin: string) {
  const at = (path: string) => `/api/plugins/${plugin}${path}`
  return {
    get: <T>(path: string) => api.get<T>(at(path)),
    post: <T>(path: string, body: unknown = {}) => api.post<T>(at(path), body),
  }
}

// To another place in the window: a module, a connection, Home.
export const go = (to: string) => {
  window.location.hash = to
}

// A module's page, by the module's name: none when it is not there.
export async function openModule(name: string): Promise<boolean> {
  const m = (await api.get<ModuleSummary[]>('/api/modules')).find(
    (x) => x.name.toLowerCase() === name.toLowerCase(),
  )
  if (m) go(`#/module/${m.id}`)
  return !!m
}

// A connection's own page, where it is connected.
export const openConnection = (connector: string) =>
  go(`#/intelligence/connections?connect=${connector}`)
