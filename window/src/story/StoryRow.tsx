// Home's one row while a person's Set up Alpha waits: how far they got, Carry on, and Decline,
// which takes the row away until they open the story again from the workspace tile's menu.
import type { StoryView } from '@alpha/core/api'
import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api.ts'
import { Refusal, useAct } from '../ui/act.tsx'
import { Button } from '../ui/button.tsx'
import { SET_UP } from './address.ts'

export function StoryRow({ version }: { version: unknown }) {
  const [story, setStory] = useState<StoryView | null>(null)
  const { busy, problem, act } = useAct()
  useEffect(() => {
    void version
    api.get<StoryView>('/api/story').then(setStory, () => undefined)
  }, [version])
  if (!story?.row) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5">
      <Sparkles className="size-3.5 shrink-0 text-accent" />
      <span className="min-w-0 flex-1 text-ink text-md">{story.row}</span>
      <Refusal words={problem} />
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() =>
          void act(async () => setStory(await api.post<StoryView>('/api/story/decline')))
        }
      >
        Decline
      </Button>
      <Button
        size="sm"
        variant="primary"
        onClick={() => {
          window.location.hash = SET_UP
        }}
      >
        Carry on
      </Button>
    </div>
  )
}
