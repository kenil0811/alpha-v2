// The form that adds a property: its name and kind, choices for a choice, the table a relation
// points at. On a table it posts to the table; on People and Organizations to their own route, and
// the list reads itself again; and the + at the end of a table's header that opens it. Out of
// Grid.tsx (the window file wall).
import { Plus } from 'lucide-react'
import { createContext, type FormEvent, useContext, useEffect, useRef, useState } from 'react'
import { api, Problem } from '../api.ts'
import { Button } from '../ui/button.tsx'
import { Field, Select } from '../ui/field.tsx'
import { Popover } from '../ui/popover.tsx'
import { useShapeFixed } from './Mirror.tsx'

// Where a property is added from this table's header when it is not the module table's own route:
// People's and Organizations' lists have theirs (rules T16).
export const FieldsAt = createContext<string | undefined>(undefined)
export const useFieldsAt = () => useContext(FieldsAt)
// what a kept list does once a property is added there: reads itself again, as a table does live
export const FieldsAdded = createContext<(() => void) | undefined>(undefined)

const KINDS: [string, string][] = [
  ['text', 'Words'],
  ['number', 'A number'],
  ['money', 'Money'],
  ['date', 'A date'],
  ['choice', 'A choice'],
  ['tags', 'Tags (several choices)'],
  ['link', 'A link'],
  ['email', 'An email address'],
  ['phone', 'A phone number'],
  ['relation', 'A row of another table'],
  ['person', 'A person'],
  ['file', 'A file'],
]

// A new column: its name and kind, choices for a choice, the table a relation points at.
export function AddFieldForm({
  tableId,
  title,
  onAdded,
}: {
  tableId: string
  title: string
  onAdded: (name: string) => void
}) {
  const at = useFieldsAt() ?? `/api/tables/${tableId}/fields`
  const reread = useContext(FieldsAdded)
  const [name, setName] = useState('')
  const [kind, setKind] = useState('text')
  const [choices, setChoices] = useState('')
  const [relatesTo, setRelatesTo] = useState('')
  const [tables, setTables] = useState<{ id: string; name: string }[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    if (kind === 'relation' && !tables.length)
      api.get<{ tables: { id: string; name: string }[] }[]>('/api/modules').then(
        (ms) => setTables(ms.flatMap((m) => m.tables)),
        () => undefined,
      )
  }, [kind, tables.length])
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setProblem(null)
    try {
      // tags are a choice that holds several
      const tags = kind === 'tags'
      await api.post(at, {
        name,
        kind: tags ? 'choice' : kind,
        ...(tags ? { many: true } : {}),
        ...(kind === 'choice' || tags
          ? {
              choices: choices
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean),
            }
          : {}),
        ...(kind === 'relation' ? { relatesTo } : {}),
      })
      onAdded(name)
      reread?.()
      setName('')
      setChoices('')
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That field was not added.')
    }
  }
  return (
    <form onSubmit={save} className="flex w-68 flex-col gap-2 p-1.5">
      <div className="font-medium text-ink">{title}</div>
      <Field
        autoFocus
        value={name}
        placeholder="Its name"
        aria-label="The field’s name"
        onChange={(e) => setName(e.target.value)}
      />
      <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Its kind">
        {KINDS.map(([k, w]) => (
          <option key={k} value={k}>
            {w}
          </option>
        ))}
      </Select>
      {(kind === 'choice' || kind === 'tags') && (
        <Field
          value={choices}
          placeholder="Its choices, with commas: New, Looking, Passed"
          aria-label="Its choices"
          onChange={(e) => setChoices(e.target.value)}
        />
      )}
      {kind === 'relation' && (
        <Select
          value={relatesTo}
          onChange={(e) => setRelatesTo(e.target.value)}
          aria-label="The table it points at"
        >
          <option value="">Which table?</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      )}
      {problem && <div className="text-bad text-sm">{problem}</div>}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          variant="primary"
          disabled={
            !name.trim() ||
            ((kind === 'choice' || kind === 'tags') && !choices.trim()) ||
            (kind === 'relation' && !relatesTo)
          }
        >
          Add it
        </Button>
      </div>
    </form>
  )
}

// + at the end of the header: a field the person adds, with its kind.
export function AddField({ tableId }: { tableId: string }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const fixed = useShapeFixed()
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label="Add a property"
        data-tip={fixed ?? 'Add a property'}
        disabled={!!fixed}
        onClick={() => setOpen((o) => !o)}
        className="ml-auto grid h-9 w-11 place-items-center text-ink-3 hover:bg-hover hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Plus className="size-3.75" />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="end">
        <AddFieldForm tableId={tableId} title="Add a property" onAdded={() => setOpen(false)} />
      </Popover>
    </>
  )
}
