// A task's own fields on its page: when (a day, or a day and a time) and how it repeats. Out of
// Tasks.tsx, which holds the lists and the page.
import { useEffect, useRef, useState } from 'react'
import { DateField, parseDay } from './ui/date-field.tsx'
import { Field } from './ui/field.tsx'

// A day, or a day and a time, saved once the person has settled on it: a day as soon as it is
// picked; a time when they leave the field, or a moment after they stop changing it, so stepping
// through the minutes is one change, not ten. A time with no day yet is today's; a day with no
// time yet is at 09:00.
export function WhenField({
  type,
  label,
  value,
  onSave,
}: {
  type: 'date' | 'datetime-local'
  label: string
  value: string
  onSave: (v: string) => void
}) {
  const [v, setV] = useState(value)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => setV(value), [value])
  const save = (next: string) => {
    window.clearTimeout(timer.current)
    if (next !== value) onSave(next)
  }
  const [day = '', time = ''] = v.split('T')
  const pickDay = (d: string) => {
    const next = d && type === 'datetime-local' ? `${d}T${time || '09:00'}` : d
    setV(next)
    save(next)
  }
  return (
    <div className="flex gap-2">
      <DateField aria-label={label} value={day} onChange={pickDay} className="w-40" />
      {type === 'datetime-local' && (
        <Field
          type="time"
          aria-label={`${label}, time`}
          value={time}
          onChange={(e) => {
            if (!e.target.value) return
            const next = `${day || parseDay('today')}T${e.target.value}`
            setV(next)
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => save(next), 1500)
          }}
          onBlur={() => save(v)}
        />
      )}
    </div>
  )
}

export function RepeatField({
  value,
  onSave,
}: {
  value: string | null
  onSave: (v: string | null) => void
}) {
  const [words, setWords] = useState(value ?? '')
  useEffect(() => setWords(value ?? ''), [value])
  return (
    <Field
      aria-label="Repeats"
      placeholder="every Monday, monthly…"
      value={words}
      onChange={(e) => setWords(e.target.value)}
      onBlur={() => (words.trim() || null) !== value && onSave(words.trim() || null)}
    />
  )
}
