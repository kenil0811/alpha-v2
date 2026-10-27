// The kinds and versions that are part of the kit API's contract: a kit cannot add one, and a
// change to any is an API change.

export const API_VERSION = 1
export const API_VERSIONS_SERVED = [1] as const
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
  // a row's free notes (core step 3b): Markdown, a person or a row mentioned as a link
  // ([@Ann](person:p_1), [Acme](row:r_1)); one per table, shown on the row, not in grids
  'notes',
] as const
export type FieldKind = (typeof FIELD_KINDS)[number]

export const PROVENANCE_KINDS = ['stated', 'looked_up', 'estimated', 'assumed', 'computed'] as const
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number]

export const TRIGGER_KINDS = ['every', 'cron', 'changes', 'filed'] as const
export const CARD_KINDS = ['permission', 'question', 'review', 'match', 'suggestion'] as const
