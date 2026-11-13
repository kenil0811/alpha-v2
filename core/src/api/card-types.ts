// A card's shape for the window (split from types.ts for its wall): what waits for the person, and
// what each kind of card shows beside its words.
import type { DraftView, FilingView, MatchView } from './types.ts'

export interface CardView {
  id: string
  task: string | null // raised in this task's own thread
  kind: string
  state: string
  words: string
  detail: string | null // the whole of it: the message as it will go
  gate: string | null
  connector: string | null // for a connection's sign-in: which form to open
  site: string | null // for a site's sign-in: the site, opened in a window of Alpha's browser
  options: string[]
  cannotUndo: string | null
  answer: string | null
  restsOn: string[] // what the card rests on, in words
  module: string | null // the module it belongs to, for a lens
  filing?: FilingView | null // a file from the mail: where it is proposed to go
  draft?: DraftView | null // a schedule's email for the person's yes
  match?: MatchView | null // people or companies that may be one, side by side
  review?: ReviewView | null // rows a schedule puts to the person, a choice on each
  acting?: ActingView | null // a step in the browser that waits for the person's yes
}

// A browser step's card: the page's picture with the element outlined, and the standing
// permission's sentence when Always is offered.
export interface ActingView {
  picture: string | null
  always: string | null
}

// Rows a schedule puts to the person on one card: each with why, and the choices it offers.
export interface ReviewView {
  table: string
  field: string
  choices: string[] // the first is the usual yes
  rows: { id: string; name: string; note: string | null; value: string | null }[]
  open: number // rows not yet decided
}
