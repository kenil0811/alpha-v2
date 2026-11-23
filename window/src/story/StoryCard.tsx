// Home's Set up Alpha card while a person's story waits: how many steps are done, a bar, the next
// step, Carry on and Decline (Vikas, 23 Nov). Decline takes it away until they open the story
// again from the workspace tile's menu.
import type { StoryView } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api } from '../api.ts'
import { Refusal, useAct } from '../ui/act.tsx'
import { Button } from '../ui/button.tsx'
import { Actions } from '../ui/card.tsx'
import { Group } from '../ui/groups.tsx'
import { notify } from '../ui/notice.tsx'
import { SET_UP } from './address.ts'

export function useStory(version: unknown) {
  const [story, setStory] = useState<StoryView | null>(null)
  useEffect(() => {
    void version
    api.get<StoryView>('/api/story').then(setStory, () => undefined)
  }, [version])
  return [story, setStory] as const
}

// The steps done (or skipped) of all.
export const stepsDone = (s: StoryView) =>
  s.chapters.filter((c) => c.state === 'done' || c.state === 'skipped').length

export function StoryCard({
  story,
  onChange,
}: {
  story: StoryView
  onChange: (s: StoryView) => void
}) {
  const { busy, problem, act } = useAct()
  const done = stepsDone(story)
  const all = story.chapters.length
  const next = story.chapters.find((c) => c.state === 'now' || c.state === 'ahead')
  return (
    <Group title="Set up Alpha" sub={`${done} of ${all} steps done`}>
      <div className="h-1.5 overflow-hidden rounded-full bg-sunk">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${(done / all) * 100}%` }}
        />
      </div>
      {next && (
        <p className="text-ink text-md">
          <span className="text-ink-3">Next: </span>
          {next.title}
        </p>
      )}
      <Refusal words={problem} />
      <Actions>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            window.location.hash = SET_UP
          }}
        >
          Carry on
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              onChange(await api.post<StoryView>('/api/story/decline'))
              notify({ words: 'Set up Alpha declined' })
            })
          }
        >
          Decline
        </Button>
      </Actions>
    </Group>
  )
}
