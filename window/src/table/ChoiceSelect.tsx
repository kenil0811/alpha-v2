// A choice field's dropdown: the one dropdown (ui/field.tsx) with each choice in its colour and a ★
// on each line making it the field's default for everyone, which new rows take (T10, T17). In a
// table of a module only: a kept list keeps no default, and a tags field has none.
import type { FieldView } from '@alpha/core/api'
import { type ComponentProps, useState } from 'react'
import { api } from '../api.ts'
import { Select } from '../ui/field.tsx'
import { useTableId } from './context.ts'

export function ChoiceSelect({
  of,
  ...props
}: Omit<ComponentProps<typeof Select>, 'of' | 'star'> & { of: FieldView }) {
  const table = useTableId()
  // the default as just set, until the table is read again
  const [set, setSet] = useState<string | null | undefined>(undefined)
  const value = set === undefined ? of.default : set
  const star =
    table && !of.many
      ? {
          value,
          onStar: async (v: string) => {
            const to = v === value ? null : v
            await api.post(`/api/tables/${table}/default`, { field: of.id, value: to })
            setSet(to)
          },
        }
      : undefined
  return <Select of={of} star={star} {...props} />
}
