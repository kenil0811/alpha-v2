// One control for short lists (Batch A, pick 6): Add on the heading, ✕ on an entry when hovered,
// a double-click edits it in place; Enter keeps, Escape puts it back.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { editStep, ShortList } from './shortlist.tsx'

describe('a short list', () => {
  const items = [{ k: 'a', words: 'Reply to brokers within a day' }]
  const html = renderToString(
    <ShortList
      title="How to work"
      items={items}
      keyOf={(i) => i.k}
      wordsOf={(i) => i.words}
      addLabel="Add an instruction"
      onAdd={() => {}}
      onEdit={async () => {}}
      remove={{ title: 'Forget this?', yes: 'Forget it', what: () => 'it', run: async () => {} }}
      empty="Nothing yet."
    />,
  )

  it('has Add on its heading and ✕ on each entry, shown when the entry is hovered', () => {
    expect(html).toContain('aria-label="Add an instruction"')
    expect(html).toContain('aria-label="Delete “Reply to brokers within a day”"')
    expect(html).toContain('group-hover/row:opacity-100')
    expect(html).toContain('Double-click to change it')
  })

  it('edits in place: a double-click starts, Enter keeps a change, Escape puts it back', () => {
    let s = editStep(null, { type: 'start', key: 'a', words: 'Reply to brokers within a day' })
    expect(s.edit).toEqual({
      key: 'a',
      words: 'Reply to brokers within a day',
      was: 'Reply to brokers within a day',
    })
    s = editStep(s.edit, { type: 'type', words: 'Reply to brokers within two days' })
    const kept = editStep(s.edit, { type: 'keep' })
    expect(kept).toEqual({
      edit: null,
      keep: { key: 'a', words: 'Reply to brokers within two days' },
    })
    expect(editStep(s.edit, { type: 'cancel' })).toEqual({ edit: null })
    // nothing changed, or nothing left: nothing kept
    const same = editStep(null, { type: 'start', key: 'a', words: 'x' }).edit
    expect(editStep(same, { type: 'keep' })).toEqual({ edit: null })
    const blank = editStep(same, { type: 'type', words: '  ' }).edit
    expect(editStep(blank, { type: 'keep' })).toEqual({ edit: null })
  })
})
