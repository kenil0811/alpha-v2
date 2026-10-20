// Changes to a view, each a new config: what a header click, a column's menu or a chip does.
import type { FieldView, FilterRule, TotalOp, ViewConfig } from '@alpha/core/api'

// A header click: ascending, descending, then off. With shift, the field is added as the next
// level (or its level turned) and the others kept.
export function cycleSort(c: ViewConfig, field: string, add: boolean): ViewConfig {
  const was = c.sorts.find((s) => s.field === field)
  const next = !was ? 'asc' : was.dir === 'asc' ? 'desc' : null
  if (!add) return { ...c, sorts: next ? [{ field, dir: next }] : [] }
  const others = c.sorts.filter((s) => s.field !== field)
  if (!next) return { ...c, sorts: others }
  return {
    ...c,
    sorts: was
      ? c.sorts.map((s) => (s.field === field ? { field, dir: next } : s))
      : [...others, { field, dir: next }],
  }
}

export function setSort(c: ViewConfig, field: string, dir: 'asc' | 'desc' | null): ViewConfig {
  const others = c.sorts.filter((s) => s.field !== field)
  return { ...c, sorts: dir ? [{ field, dir }, ...others] : others }
}

// One rule per field, as in v1: a new rule for a field takes the place of its old one.
export function setRule(c: ViewConfig, rule: FilterRule): ViewConfig {
  const rules = c.filters.rules.some((r) => r.field === rule.field)
    ? c.filters.rules.map((r) => (r.field === rule.field ? rule : r))
    : [...c.filters.rules, rule]
  return { ...c, filters: { ...c.filters, rules } }
}

export function removeRule(c: ViewConfig, field: string): ViewConfig {
  return {
    ...c,
    filters: { ...c.filters, rules: c.filters.rules.filter((r) => r.field !== field) },
  }
}

export function setGroup(c: ViewConfig, field: string | null): ViewConfig {
  return { ...c, group: field }
}

export function hide(c: ViewConfig, field: string, hidden: boolean): ViewConfig {
  const rest = c.hidden.filter((h) => h !== field)
  return { ...c, hidden: hidden ? [...rest, field] : rest }
}

// Moves a column one place among the columns shown, writing the whole order down.
export function move(c: ViewConfig, shown: FieldView[], field: string, by: -1 | 1): ViewConfig {
  const order = shown.map((f) => f.id)
  const i = order.indexOf(field)
  const j = i + by
  if (i < 0 || j < 0 || j >= order.length) return c
  ;[order[i], order[j]] = [order[j] as string, order[i] as string]
  return { ...c, order: [...order, ...c.order.filter((id) => !order.includes(id))] }
}

export function setWidth(c: ViewConfig, field: string, px: number): ViewConfig {
  return { ...c, widths: { ...c.widths, [field]: Math.round(Math.max(64, Math.min(1200, px))) } }
}

export function setTotal(c: ViewConfig, field: string, op: TotalOp | null): ViewConfig {
  const { [field]: _, ...rest } = c.totals
  return { ...c, totals: op ? { ...rest, [field]: op } : rest }
}

export function setTint(c: ViewConfig, field: string | null): ViewConfig {
  return { ...c, colours: { ...c.colours, tint: field } }
}

export function setWhen(
  c: ViewConfig,
  field: string,
  when: Omit<ViewConfig['colours']['when'][number], 'field'> | null,
): ViewConfig {
  const rest = c.colours.when.filter((w) => w.field !== field)
  return { ...c, colours: { ...c.colours, when: when ? [...rest, { field, ...when }] : rest } }
}
