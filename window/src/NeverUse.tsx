// Settings › Permissions, Never use (rules N1): what Alpha reads but never keeps. The kinds Alpha
// ships, each with its words, on for everyone unless the owner turns one off where it is the
// firm's own work; then the firm's own words, the owner's to change; then the person's own.
import type { NeverView } from '@alpha/core/api'
import { Ban } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Section } from './ui/section.tsx'
import { ShortList } from './ui/shortlist.tsx'
import { Switch } from './ui/switch.tsx'

const ADD = 'A word, or a few in a row; end with * for any word holding it'

export function NeverUse({ version }: { version: number }) {
  const [view, setView] = useState<NeverView | null>(null)
  const load = useCallback(() => {
    api.get<NeverView>('/api/never').then(setView, () => setView(null))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const { busy, on, problem, act } = useAct(load)
  if (!view) return null
  const words = (who: 'me' | 'everyone', list: string[], owner: boolean) => (
    <ShortList
      title={who === 'everyone' ? 'Words for everyone here' : 'Your own words'}
      about={
        who === 'everyone'
          ? 'Left out of every connection here, as the list Alpha ships is.'
          : 'Left out of your own connections and your computer, besides the list for everyone.'
      }
      items={list}
      keyOf={(w) => w}
      wordsOf={(w) => w}
      lead={() => (
        <Tile>
          <Ban className="size-4" />
        </Tile>
      )}
      addLabel={who === 'everyone' ? 'Add a word for everyone' : 'Add a word of your own'}
      onAdd={{
        typed: (word) => api.post('/api/never/add', { for: who, word }).finally(load),
        placeholder: ADD,
      }}
      readOnly={owner ? undefined : 'The owner keeps this list'}
      remove={{
        title: 'Take this word off?',
        yes: 'Take it off',
        what: (w) =>
          `From each connection's next read, what holds “${w}” is kept again. What was left out before stays out.`,
        run: (w) => api.post('/api/never/remove', { for: who, word: w }).finally(load),
      }}
      empty="None yet."
    />
  )
  return (
    <>
      <Section
        title="Never use"
        about="What Alpha reads but never keeps. A mail, an event, a contact, a site, a file or an AI request holding one of these words is left out as it is read, here or on your computer, and each connection says how many it left out. Turn a kind off where it is your own work, as a dental practice's patients are."
      >
        <List>
          {view.kinds.map((k) => (
            <Row
              key={k.key}
              wrap
              title={k.title}
              sub={
                <>
                  {on === k.key && <Refusal words={problem} />}
                  <span>
                    {k.on ? k.words.join(', ') : 'Off for everyone here: kept as it is read'}
                  </span>
                </>
              }
              actions={
                <span {...(view.owner ? {} : { 'data-tip': 'The owner turns a kind on or off' })}>
                  <Switch
                    checked={k.on}
                    disabled={busy || !view.owner}
                    label={`Leave out ${k.title.toLowerCase()}`}
                    onChange={(v) =>
                      act(() => api.post('/api/never/kind', { key: k.key, on: v }), k.key)
                    }
                  />
                </span>
              }
            />
          ))}
        </List>
      </Section>
      {words('everyone', view.everyone, view.owner)}
      {words('me', view.yours, true)}
    </>
  )
}
