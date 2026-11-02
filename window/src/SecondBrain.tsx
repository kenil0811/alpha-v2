// Intelligence › Second Brain (moved out of Settings.tsx so it only shrinks): how to work (the
// standing instructions), the Alpha module's two tables, and a plugin's own part, where what it keeps
// is about the person (onboarding's About you, Kenil's call 2 Nov).
import type { InstructionView, ModuleSummary, TableView as TableData } from '@alpha/core/api'
import { BookmarkCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { startAsk } from './ask.ts'
import { SCREENS } from './plugin/screens.ts'
import { TableView } from './TableView.tsx'
import { Tile } from './ui/list.tsx'
import { Empty, Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { ShortList } from './ui/shortlist.tsx'

// Second Brain: how to work (the standing instructions), and the Alpha module's two tables,
// Decisions and Noticed, which are shown here instead of as a module on the rail.
// A plugin's part is its own (onboarding's About you), after Alpha's.
type Part = 'work' | 'Decisions' | 'Noticed' | `p:${string}`

export function SecondBrain({ version }: { version: number }) {
  const [part, setPart] = useState<Part>('work')
  const plugin = SCREENS.find((s) => part === `p:${s.name}`)?.brain
  return (
    <>
      <div className="self-start">
        <Segmented
          label="Second Brain"
          value={part}
          onChange={setPart}
          options={[
            { value: 'work', label: 'How to work' },
            { value: 'Decisions', label: 'Decisions' },
            { value: 'Noticed', label: 'Noticed' },
            ...SCREENS.flatMap((s) =>
              s.brain ? [{ value: `p:${s.name}` as Part, label: s.brain.label }] : [],
            ),
          ]}
        />
      </div>
      {part === 'work' ? (
        <HowToWork version={version} />
      ) : plugin ? (
        <plugin.Part />
      ) : part === 'Decisions' || part === 'Noticed' ? (
        <AlphaTable key={part} name={part} version={version} />
      ) : null}
    </>
  )
}

// What each holds: the person's own words, noticed by Watson and kept once they say so; rules are
// in Settings › Permissions
const ABOUT_ALPHA = {
  Decisions: 'Decisions you made in conversation, noticed by Watson and kept once you say so.',
  Noticed: 'Facts you stated about people and organizations, kept once you confirm them.',
}

// One of the Alpha module's tables, found by its name, drawn with the shared table.
function AlphaTable({ name, version }: { name: keyof typeof ABOUT_ALPHA; version: number }) {
  const [data, setData] = useState<TableData | null | undefined>(undefined)
  useEffect(() => {
    if (version < 0) return
    api
      .get<ModuleSummary[]>('/api/modules')
      .then((ms) => {
        const id = alphaOf(ms)?.tables.find((t) => t.name === name)?.id
        return id ? api.get<TableData>(`/api/tables/${id}`) : null
      })
      .then(setData, () => setData(null))
  }, [name, version])
  return (
    <Section title={name} about={ABOUT_ALPHA[name]}>
      {data === null && <Empty>Nothing here yet.</Empty>}
      {data && (
        <div className="h-[min(520px,70vh)] overflow-hidden rounded-lg border border-line bg-surface">
          <TableView data={data} />
        </div>
      )}
    </Section>
  )
}

// Alpha's own module, as the core marks it (its module.yaml says core: true), whatever its name.
export const alphaOf = (modules: ModuleSummary[]) => modules.find((m) => m.alpha)

// How to work: the standing instructions the person gave, on the one control for short lists
// (Batch A, pick 6): Add asks Alpha, as it must understand them; a double-click changes the words;
// ✕ forgets one on a yes.
function HowToWork({ version }: { version: number }) {
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
