// What a plugin's screen may use: the window's own shared pieces and a way to its own routes,
// nothing else, so a plugin's page looks and acts as the window's own screens do and cannot drift
// from them. A plugin's screen imports only this.
import type { AgentView, ModuleSummary } from '@alpha/core/api'
import { type ComponentType, useCallback } from 'react'
import { api } from '../api.ts'
import { useLayout } from '../layout.ts'
import { openLink } from '../opened.ts'
import type { Next } from '../story/next.ts'

export { Check, ChevronRight, LoaderCircle, Pencil, Sparkles, X } from 'lucide-react'
export { wordsOf } from '../api.ts'

export { startAsk } from '../ask.ts'
// a module built from what the person asked, by the Module builder, as New module does
export { askFor, giveBuilder as startBuild } from '../NewModule.tsx'
export type { Next } from '../story/next.ts'
export { Repeat } from '../story/repeat.tsx'
export { Refusal, useAct } from '../ui/act.tsx'
export { Button, IconButton } from '../ui/button.tsx'
export { Actions, Card } from '../ui/card.tsx'
export { Field } from '../ui/field.tsx'
export { Group, Line, Quiet } from '../ui/groups.tsx'
export { Info } from '../ui/info.tsx'
export { List, Row, Tile } from '../ui/list.tsx'
export { Label, Pill } from '../ui/pill.tsx'
export { Answer, Question } from '../ui/question.tsx'
export { Empty, Section } from '../ui/section.tsx'
export { Switch } from '../ui/switch.tsx'
export { Words } from '../ui/words.tsx'
export { type Answer as YesNoAnswer, TickCross, YesNo } from '../ui/yes-no.tsx'

// A chapter of the plugin's in Set up Alpha, drawn in the story's own frame: its screen as its
// chapter's screen() said it, a way to read it again, the act at the story's foot it sets, and
// its act with a body (what the person did on the screen), the story moving on when it says.
export interface ChapterProps {
  screen: Record<string, unknown>
  reload: () => void
  next: (n: Next) => void
  act: (body: unknown) => Promise<void>
}

// A plugin's page and, when something waits for the person, its row on Home; on the page of an
// agent its kit carries, a part of its own beside the agent's buttons; and its chapters in Set up
// Alpha, by their keys.
export interface Screen {
  name: string // the plugin's: its page is #/p/<name>
  title: string // the page's name in the bar
  Page: ComponentType
  Waiting?: ComponentType // a row on Home; none when nothing waits
  agent?: { name: string; Part: ComponentType } // on that agent's page, by its name
  chapters?: Record<string, ComponentType<ChapterProps>>
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
  openLink(to)
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
  go(`#/settings/connections?connect=${connector}`)

// An agent its kit carries, its chat opened in Agents, by the agent's name: false when it is not
// here.
export function useOpenChat(): (agent: string) => Promise<boolean> {
  const { change } = useLayout()
  return useCallback(
    async (agent: string) => {
      const a = (await api.get<AgentView[]>('/api/agents')).find(
        (x) => x.from.kind === 'kit' && x.name.toLowerCase() === agent.toLowerCase(),
      )
      if (!a) return false
      change({ agent: a.id })
      go('#/conversation')
      return true
    },
    [change],
  )
}
