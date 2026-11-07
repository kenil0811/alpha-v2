// Intelligence › How to work: the standing instructions the person gave (Kenil's Q4, 7 Nov).
import type { InstructionView } from '@alpha/core/api'
import { BookmarkCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { startAsk } from './ask.ts'
import { Tile } from './ui/list.tsx'
import { ShortList } from './ui/shortlist.tsx'

// How to work: the standing instructions the person gave, on the one control for short lists
// (Batch A, pick 6): Add asks Alpha, as it must understand them; a double-click changes the words;
// ✕ forgets one on a yes.
export function HowToWork({ version }: { version: number }) {
  const [lines, setLines] = useState<InstructionView[] | null>(null)
  const load = useCallback(() => {
    api.get<InstructionView[]>('/api/instructions').then(setLines, () => setLines([]))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const after = <T,>(p: Promise<T>) => p.finally(load)
  return (
    <ShortList
      title="How to work"
      about="How you asked things to be done from now on. Add asks Alpha; a double-click changes one."
      items={lines}
      keyOf={(l) => `${l.for}${l.words}`}
      wordsOf={(l) => l.words}
      subOf={(l) => (l.for === 'me' ? 'For you' : 'For everyone here')}
      lead={() => (
        <Tile>
          <BookmarkCheck className="size-4" />
        </Tile>
      )}
      addLabel="Add an instruction"
      onAdd={() => startAsk('From now on, ')}
      onEdit={(l, to) =>
        after(api.post('/api/instructions/change', { for: l.for, words: l.words, to }))
      }
      remove={{
        title: 'Forget this?',
        yes: 'Forget it',
        what: (l) =>
          `Alpha stops doing it from now on: “${l.words}”. Saying it again brings it back.`,
        run: (l) => after(api.post('/api/instructions/remove', { for: l.for, words: l.words })),
      }}
      empty="Nothing configured yet. Say “from now on…” to Alpha to add one."
    />
  )
}
