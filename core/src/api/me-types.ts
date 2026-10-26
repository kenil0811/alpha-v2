// Who is at the window and how they left it: the person's own, kept by Alpha per person (design
// §14), never in the browser. Re-exported by types.ts, the window's one import.

export interface Me {
  user: { id: string; name: string }
  tenant: string
  theme: 'mac' | 'light' | 'dark' // Appearance: Match Mac, or one look
  layout: Layout
  foldLines: number // a finished reply's lines shown before More (limits.yaml)
}

// How the person left the window (UI batch 2, 26 Oct: all of it here, none in the browser).
export interface Layout {
  railFolded: boolean
  folded: string[] // the modules folded in the rail
  railWidth: number | null // the rail dragged wider or narrower; none is 216px
  panel: number | null // the assistant's width; none is 320px
  assistant: 'open' | 'folded'
  pageSize: number | null // a table's rows to a page; none is 50
}
