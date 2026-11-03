// Who is at the window and how they left it: the person's own, kept by Alpha per person (design
// §14), never in the browser. Re-exported by types.ts, the window's one import.

export interface Me {
  user: { id: string; name: string }
  tenant: string
  theme: 'mac' | 'light' | 'dark' // Appearance: Match Mac, or one look
  textSize: 'small' | 'medium' | 'large' // Appearance: small is the plain size
  layout: Layout
  foldLines: number // a finished reply's lines shown before More (limits.yaml)
}

// How the person left the window (UI batch 2, 26 Oct: all of it here, none in the browser).
export interface Layout {
  railFolded: boolean
  folded: string[] // the modules folded in the rail
  hidden: string[] // the modules hidden from the rail, with the ones inside them
  order: string[] // the rail in the order the person dragged it: modules by id, Home, Agents and Tasks by their links; none is the core's
  railWidth: number | null // the rail dragged wider or narrower; none is 216px
  panel: number | null // the assistant's width; none is 320px
  assistant: 'open' | 'folded'
  pageSize: number | null // a table's rows to a page; none is 50
  pins: Record<string, string[]> // per module, the tables pinned to its switch; none is its first main tables
  seen: Record<string, number> // how often each screen and card was opened, which orders a module's cards
  docked: string[] | null // the places pinned as tiles atop the rail, up to 12; none is Home, Conversation, Tasks, Network
  // per page ("home", "overview:<module>"), its blocks as the person dragged them: rows top to
  // bottom, each row its blocks left to right; none is the page's own order
  arrange?: Record<string, string[][]>
}
