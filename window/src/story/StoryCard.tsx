// Home's Set up Alpha card while a person's story waits: how many steps are through, a bar, the
// next step, Carry on and Decline. Decline takes it away until they open the story again from
// Settings › Set up Alpha, which shows the same count.
import type { StoryView } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api } from '../api.ts'
import { Refusal, useAct } from '../ui/act.tsx'
import { Button } from '../ui/button.tsx'
import { Actions } from '../ui/card.tsx'
import { Group } from '../ui/groups.tsx'
import { notify } from '../ui/notice.tsx'
import { Section } from '../ui/section.tsx'
import { SET_UP } from './address.ts'

export function useStory(version: unknown) {
  const [story, setStory] = useState<StoryView | null>(null)
  useEffect(() => {
    void version
    api.get<StoryView>('/api/story').then(setStory, () => undefined)
  }, [version])
  return [story, setStory] as const
}

// The steps gone through, done or skipped, of all: the one count, on Home's card and in Settings.
export const stepsDone = (s: StoryView) =>
  s.chapters.filter((c) => c.state === 'done' || c.state === 'skipped').length
export const stepsWords = (s: StoryView) =>
  `${stepsDone(s)} of ${s.chapters.length} steps done or skipped`

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
    <Group title="Set up Alpha" sub={stepsWords(story)}>
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

// Settings' Set up Alpha: the same count as Home's card, and the way back into it once declined or
// finished (Open it again starts it over, what was done shown as done).
export function SetUpPart() {
  const [story, setStory] = useStory(0)
  const { busy, problem, act } = useAct()
  if (!story) return null
  const through = story.done || story.declined
  return (
    <Section
      title="Set up Alpha"
      about="The steps that connect your accounts and teach Alpha how you work."
    >
      <div className="flex items-center gap-3">
        <span className="flex-1 text-ink-2 text-md">
          {story.done
            ? 'Finished.'
            : story.declined
              ? 'Declined for now.'
              : `${stepsWords(story)}.`}
        </span>
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              if (through) setStory(await api.post<StoryView>('/api/story/reopen'))
              window.location.hash = SET_UP
            })
          }
        >
          {through ? 'Open it again' : 'Carry on'}
        </Button>
      </div>
      <Refusal words={problem} />
    </Section>
  )
}
