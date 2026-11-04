// One control for short lists (Batch A, pick 6, Kenil's yes 1 Nov): Add on the heading, ✕ on an
// entry when it is hovered (asked first in our own pop-up, R3), and a double-click edits it in
// place, Enter keeping the change and Escape putting it back, as a saved list is renamed. Where
// Alpha must understand an entry, Add starts the conversation (M3); the list says how it adds.
import { Plus, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Refusal, useAct } from './act.tsx'
import { IconButton } from './button.tsx'
import { Confirm } from './dialog.tsx'
import { Field } from './field.tsx'
import { List, Row } from './list.tsx'
import { Empty, Section } from './section.tsx'

export type Edit = { key: string; words: string; was: string } | null
type Step =
  | { type: 'start'; key: string; words: string }
  | { type: 'type'; words: string }
  | { type: 'keep' }
  | { type: 'cancel' }

// What a keystroke does to an edit in place: kept only when it changed and is not empty.
export function editStep(
  edit: Edit,
  step: Step,
): { edit: Edit; keep?: { key: string; words: string } } {
  if (step.type === 'start') return { edit: { key: step.key, words: step.words, was: step.words } }
  if (!edit || step.type === 'cancel') return { edit: null }
  if (step.type === 'type') return { edit: { ...edit, words: step.words } }
  const words = edit.words.trim()
  return words && words !== edit.was
    ? { edit: null, keep: { key: edit.key, words } }
    : { edit: null }
}

export function ShortList<T>({
  title,
  about,
  items,
  keyOf,
  wordsOf,
  subOf,
  lead,
  addLabel,
  onAdd,
  onEdit,
  remove,
  empty,
}: {
  title: string
  about?: string
  items: T[] | null
  keyOf: (item: T) => string
  wordsOf: (item: T) => string
  subOf?: (item: T) => ReactNode
  lead?: (item: T) => ReactNode
  addLabel: string // "Add an instruction": the button's name, read aloud and on hover
  onAdd: () => void
  onEdit?: (item: T, words: string) => Promise<unknown> // none: the entry is not edited in place
  remove: {
    title: string
    yes: string
    what: (item: T) => ReactNode
    run: (item: T) => Promise<unknown>
  }
  empty: ReactNode
}) {
  const [edit, setEdit] = useState<Edit>(null)
  const [asking, setAsking] = useState<string | null>(null)
  const { busy, on, problem, act } = useAct()
  const asked = items?.find((i) => keyOf(i) === asking)
  const step = (s: Step) => {
    const out = editStep(edit, s)
    setEdit(out.edit)
    const item = out.keep && items?.find((i) => keyOf(i) === out.keep?.key)
    if (out.keep && item && onEdit) void act(() => onEdit(item, out.keep?.words ?? ''), keyOf(item))
  }
  return (
    <Section
      title={title}
      sticky
      {...(about ? { about } : {})}
      action={
        <IconButton label={addLabel} onClick={onAdd}>
          <Plus className="size-4" />
        </IconButton>
      }
    >
      {items?.length === 0 && <Empty>{empty}</Empty>}
      {items && items.length > 0 && (
        <List>
          {items.map((item) => {
            const key = keyOf(item)
            const editing = edit?.key === key
            return (
              <Row
                key={key}
                {...(lead ? { lead: lead(item) } : {})}
                title={
                  editing ? (
                    <Field
                      autoFocus
                      aria-label={`Change “${wordsOf(item)}”`}
                      value={edit.words}
                      onChange={(e) => step({ type: 'type', words: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') step({ type: 'keep' })
                        if (e.key === 'Escape') step({ type: 'cancel' })
                      }}
                      onBlur={() => step({ type: 'keep' })}
                    />
                  ) : (
                    <span
                      className="whitespace-normal font-normal"
                      {...(onEdit
                        ? {
                            'data-tip': 'Double-click to change it',
                            onDoubleClick: () => step({ type: 'start', key, words: wordsOf(item) }),
                          }
                        : {})}
                    >
                      {wordsOf(item)}
                    </span>
                  )
                }
                {...(subOf ? { sub: subOf(item) } : {})}
                actions={
                  <>
                    {on === key && <Refusal words={problem} />}
                    <IconButton
                      label={`Delete “${wordsOf(item)}”`}
                      disabled={busy}
                      className="opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100"
                      onClick={() => setAsking(key)}
                    >
                      <X className="size-3.5" />
                    </IconButton>
                  </>
                }
              />
            )
          })}
        </List>
      )}
      <Confirm
        open={!!asked}
        title={remove.title}
        yes={remove.yes}
        busy={busy}
        onClose={() => setAsking(null)}
        onYes={() => {
          setAsking(null)
          if (asked) void act(() => remove.run(asked), keyOf(asked))
        }}
      >
        {asked ? remove.what(asked) : null}
      </Confirm>
    </Section>
  )
}
