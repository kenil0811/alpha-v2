// A card's shape for the window (split from types.ts for its wall): what waits for the person, and
// what each kind of card shows beside its words.
import type { DraftView, FieldView, FilingView, MatchView } from './types.ts'

export interface CardView {
  id: string
  task: string | null // raised in this task's own thread
  kind: string
  state: string
  words: string
  detail: string | null // the whole of it: the message as it will go
  help?: string | null // what its ⓘ says (ui-rules R10)
  gate: string | null
  connector: string | null // for a connection's sign-in: which form to open
  connects?: string | null // a question whose yes opens Connections, at this connector ('' the list)
  site: string | null // for a site's sign-in: the site, opened in a window of Alpha's browser
  options: string[]
  cannotUndo: string | null
  answer: string | null
  restsOn: string[] // what the card rests on, in words
  module: string | null // the module it belongs to, for a lens
  agent: string // the agent whose chat it shows in; the Chief of staff for what no agent raised
  filing?: FilingView | null // a file from the mail: where it is proposed to go
  draft?: DraftView | null // a schedule's email for the person's yes
  match?: MatchView | null // people or companies that may be one, side by side
  review?: ReviewView | null // rows a schedule puts to the person, a choice on each
  check?: CheckView | null // Alpha's guesses in one table, each kept or changed
  acting?: ActingView | null // a step in the browser that waits for the person's yes
}

// A browser step's card: the page's picture with the element outlined, and the standing
// permission's sentence when Always is offered.
export interface ActingView {
  picture: string | null
  always: string | null
  watch: string | null // the work's tab to open, on a card that asks the person onto a page
}

// Rows a schedule puts to the person on one card: each with why, and the choices it offers.
export interface ReviewView {
  table: string
  field: string
  choices: string[] // the first is the usual yes
  rows: { id: string; name: string; note: string | null; value: string | null }[]
  open: number // rows not yet decided
  edits?: string // a field the person may reword on a row before deciding it (a line for How to work)
}

// Alpha's guesses in one table (assumed, estimated), read from the table as the card shows: each
// with the words it rests on, and its field so a change is read for its kind.
export interface CheckView {
  table: string
  fields: FieldView[]
  lines: {
    row: string
    name: string
    field: string
    value: unknown
    kind: 'assumed' | 'estimated'
    why: string
  }[]
}
