// A new property: its name, then its kind from a short list, each kind with its variants beside it
// (Vikas, 20 Nov): a number is money or a phone number by its icon, choices are one (a circle) or
// several (a box), a link is an email address by its icon. Choices take their words, a row of
// another table its table.
import { Circle, CircleDot, DollarSign, Mail, Phone, Square, SquareCheck } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { api, Problem } from '../api.ts'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { Field, Select } from '../ui/field.tsx'

const I = 'size-3.5'
const KINDS: {
  base: string
  words: string
  more?: { kind: string; words: string; icon: (on: boolean) => ReactNode }[]
}[] = [
  { base: 'text', words: 'Text' },
  {
    base: 'number',
    words: 'Number',
    more: [
      { kind: 'money', words: 'Money', icon: () => <DollarSign className={I} /> },
      { kind: 'phone', words: 'A phone number', icon: () => <Phone className={I} /> },
    ],
  },
  { base: 'date', words: 'Date' },
  {
    base: 'choice',
    words: 'Choices',
    more: [
      {
        kind: 'choice',
        words: 'One of them',
        icon: (on) => (on ? <CircleDot className={I} /> : <Circle className={I} />),
      },
      {
        kind: 'tags',
        words: 'Several of them',
        icon: (on) => (on ? <SquareCheck className={I} /> : <Square className={I} />),
      },
    ],
  },
  {
    base: 'link',
    words: 'Link',
    more: [{ kind: 'email', words: 'An email address', icon: () => <Mail className={I} /> }],
  },
  { base: 'relation', words: 'A row of another table' },
  { base: 'person', words: 'A person' },
  { base: 'file', words: 'A file' },
]

export function AddFieldForm({
  tableId,
  title,
  onAdded,
}: {
  tableId: string
  title: string
  onAdded: (name: string) => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('text')
  const [choices, setChoices] = useState('')
  const [relatesTo, setRelatesTo] = useState('')
  const [tables, setTables] = useState<{ id: string; name: string }[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const choosing = kind === 'choice' || kind === 'tags'
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
      // several choices are a choice that holds several
      const tags = kind === 'tags'
      await api.post(`/api/tables/${tableId}/fields`, {
        name,
        kind: tags ? 'choice' : kind,
        ...(tags ? { many: true } : {}),
        ...(choosing
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
      setName('')
      setChoices('')
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That property was not added.')
    }
  }
  return (
    <form onSubmit={save} className="flex w-68 flex-col gap-2 p-1.5">
      <div className="font-medium text-ink">{title}</div>
      <Field
        autoFocus
        value={name}
        placeholder="Its name"
        aria-label="The property’s name"
        onChange={(e) => setName(e.target.value)}
      />
      <fieldset aria-label="Its kind" className="flex flex-col">
        {KINDS.map((k) => {
          const on = k.base === kind || !!k.more?.some((m) => m.kind === kind)
          return (
            <div
              key={k.base}
              className={cn(
                'flex items-center rounded-md',
                on ? 'bg-accent-soft' : 'hover:bg-hover',
              )}
            >
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setKind(k.base)}
                className={cn('flex-1 px-2 py-1 text-left', on ? 'text-ink' : 'text-ink-2')}
              >
                {k.words}
              </button>
              {k.more?.map((m) => {
                const picked = kind === m.kind
                return (
                  <button
                    key={m.kind}
                    type="button"
                    aria-pressed={picked}
                    aria-label={m.words}
                    data-tip={m.words}
                    // a second click on a variant goes back to the plain kind
                    onClick={() => setKind(picked ? k.base : m.kind)}
                    className={cn(
                      'grid size-7 place-items-center rounded-md',
                      picked ? 'text-accent' : 'text-ink-3 hover:text-ink',
                    )}
                  >
                    {m.icon(picked)}
                  </button>
                )
              })}
            </div>
          )
        })}
      </fieldset>
      {choosing && (
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
            !name.trim() || (choosing && !choices.trim()) || (kind === 'relation' && !relatesTo)
          }
        >
          Add it
        </Button>
      </div>
    </form>
  )
}
