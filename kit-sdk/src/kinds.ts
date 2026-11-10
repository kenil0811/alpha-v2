// The kinds and versions that are part of the kit API's contract: a kit cannot add one, and a
// change to any is an API change.

export const API_VERSION = 2
export const API_VERSIONS_SERVED = [2] as const
export const NODE_MAJOR = 26

export const FIELD_KINDS = [
  'text',
  'number',
  'money',
  'date',
  'choice',
  'relation',
  'person',
  'file',
  'link',
  'email',
  'phone',
  // a row's free notes: Markdown, a person or a row mentioned as a link
  // ([@Ann](person:p_1), [Acme](row:r_1)); one per table, shown on the row, not in grids
  'notes',
  // worked out from the rows of another table that point at this one: their
  // count, or a field's sum, least, most or latest, with one condition; never written
  'summary',
] as const
export type FieldKind = (typeof FIELD_KINDS)[number]

// What a summary field does with the rows that point at its row, and the ops its one condition
// may take: a view's filter's, but none relative to today.
export const SUMMARY_OPS = ['count', 'sum', 'min', 'max', 'latest'] as const
export const CONDITION_OPS = [
  'is',
  'is_not',
  'contains',
  'not_contains',
  'starts',
  'ends',
  'eq',
  'ne',
  'gt',
  'lt',
  'between',
  'before',
  'after',
  'in',
  'all_of',
  'none_of',
  'empty',
  'not_empty',
] as const

export const PROVENANCE_KINDS = ['stated', 'looked_up', 'estimated', 'assumed', 'computed'] as const
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number]

export const TRIGGER_KINDS = ['every', 'cron', 'changes', 'filed'] as const
export const CARD_KINDS = ['permission', 'question', 'review', 'match', 'suggestion'] as const
