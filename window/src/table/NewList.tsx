// New list: the + beside a table's lists opens this in place of the rows, as New module does for a
// module (Vikas, 25 Nov). One warm question; Send hands the words to the Chief of staff as a task on
// this table, which saves the list (shape's save_view), and the page then shows that work.
import { ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { CHIEF } from '../Agents.tsx'
import { api, Problem } from '../api.ts'
import { TaskWork } from '../TaskThread.tsx'
import { Button } from '../ui/button.tsx'

const noName = () => undefined

// What the agent is asked: the person's words, the table by its name and id, and how to keep it
export const listAsk = (words: string, table: { id: string; name: string }) =>
  `${words.trim()}\n\nMake this a saved list on the table ${table.name} (id ${table.id}): work out its filters, sorts, grouping and columns, and save it with the shape tool's save_view, named in a few words.`

export function NewList({
  table,
  task,
  onTask,
  onClose,
}: {
  table: { id: string; name: string }
  task: string | null // the task Send made, once sent
  onTask: (id: string) => void
  onClose: () => void
}) {
  const [words, setWords] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const send = async () => {
    setProblem(null)
    try {
      const t = await api.post<{ id: string }>('/api/tasks', {
        title: `Make a list: ${words.split('\n')[0]?.slice(0, 60) ?? ''}`,
        notes: listAsk(words, table),
        owner: { kind: 'alpha', id: CHIEF },
        on: { table: table.id },
      })
      onTask(t.id)
    } catch (e) {
      setProblem(e instanceof Problem ? e.message : 'That did not go to the Chief of staff.')
    }
  }
  // over the rows, the list pills still above it
  const over = 'absolute inset-x-0 top-11 bottom-0 z-10 flex flex-col bg-surface'
  if (task)
    return (
      <div className={over}>
        <div className="min-h-0 flex-1">
          <TaskWork id={task} version={0} onName={noName} />
        </div>
        <div className="flex justify-end border-hair border-t px-4 py-2">
          <Button size="sm" onClick={onClose}>
            Back to the rows
          </Button>
        </div>
      </div>
    )
  return (
    <div className={`${over} overflow-y-auto`}>
      <div className="mx-auto flex w-full max-w-stream flex-col gap-4 px-8 py-16">
        <h1 className="font-medium text-2xl text-ink">What list do you want to see?</h1>
        <textarea
          aria-label="What list do you want to see?"
          placeholder={`Say which ${table.name.toLowerCase()} it shows and how, in your own words`}
          rows={4}
          value={words}
          // biome-ignore lint/a11y/noAutofocus: opened by a click on +, to type in
          autoFocus
          onChange={(e) => setWords(e.target.value)}
          className="min-w-0 rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink shadow-pop outline-none transition-colors placeholder:text-ink-3 focus:border-accent-line focus:ring-3 focus:ring-accent-soft"
        />
        <div className="flex items-center justify-end gap-3">
          {problem && <span className="text-bad text-md">{problem}</span>}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!words.trim()} onClick={() => void send()}>
            <ArrowUp className="size-4" />
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
