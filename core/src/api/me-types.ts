// Who is at the window and how they left it: the person's own, kept by Alpha per person (design
//), never in the browser. Re-exported by types.ts, the window's one import.
import type { ViewKind } from './types.ts'

export interface Me {
  user: { id: string; name: string; role: 'owner' | 'member' }
  signIn: boolean // each person signs in here
  developer: boolean // alpha.yaml says so: modules and connectors come from folders too
  tenant: string
  theme: 'mac' | 'light' | 'dark' // Appearance: Match Mac, or one look
  textSize: 'small' | 'medium' | 'large' // Appearance: Medium is the window's own sizes
  layout: Layout
  plugins: string[] // the plugins on here (rules P1): the window shows a plugin's screens only then
  workspace: Workspace // the whole Alpha's, the same for everyone
}

// The workspace tile's name and picture, one for the whole Alpha, set by the owner; none: the
// person's name ("Kenil's workspace") and initial, as before.
export interface Workspace {
  name: string | null
  picture: string | null // its own address, which changes with the picture
}

// How the person left the window: all of it here, none in the browser.
// How a table is drawn, the person's: the layout kind and what only that layout reads (a board's
// or chart's group, a calendar's, timeline's or map's dates, a chart's measure). A list decides
// which rows show, never how they are drawn.
export interface ViewOf {
  kind: ViewKind
  by: string | null
  until: string | null
  group: string | null
  measure: string | null
}

export interface Layout {
  railFolded: boolean
  folded: string[] // the modules folded in the rail
  hidden: string[] // the modules hidden from the rail, with the ones inside them
  pinned: string[] // the modules pinned to the top of the rail, in the order pinned
  railWidth: number | null // the rail dragged wider or narrower; none is 216px
  panel: number | null // the assistant's width; none is 320px
  assistant: 'open' | 'folded'
  pageSize: number | null // a table's rows to a page; none is 50
  agent: string | null // the agent the assistant shows; none is the Chief of staff
  listOrder: Record<string, string[]> // a table's lists in the person's order: table id → list ids ('all' is All); the first is where the table opens
  viewOf: Record<string, ViewOf> // a table's view for this person: table id → how it is drawn; none opens on the first list's own layout
  tabs: Record<string, TabsKept> // a module's table tabs for this person: module id → their order, the hidden and the pinned
  records: Record<string, RecordKept> // a record page for this person: table id, or person or company → its hidden properties and tabs
  dashboardHidden: string[] // the tables whose dashboard row this person hid (right-click, Hide)
  cardWidth: Record<string, CardWidth> // a Home card's width for this person: card key → its share of the row; none is the card's own
}

// A card's share of Home's row: the whole, a half, a third, a quarter; an eighth and a sixteenth
// are squares, an icon and a number.
export const CARD_WIDTHS = ['1', '1/2', '1/3', '1/4'] as const
export type CardWidth = (typeof CARD_WIDTHS)[number]

// A module's table tabs as one person keeps them (ui-rules M1, T19): their order (table ids, the
// ones not named after, as they came), the tables hidden from the header, and the part or setup
// tables pinned to it beside those the module keeps as tabs for everyone.
export interface TabsKept {
  order: string[]
  hidden: string[]
  pinned: string[]
}

// A record page as one person keeps it, for every record of a table, or of People's and
// Organizations': the properties hidden from it (field ids) and the blocks pinned as its tabs, in
// their order.
export interface RecordKept {
  hidden: string[]
  tabs: string[]
}
