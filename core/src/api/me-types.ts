// Who is at the window and how they left it: the person's own, kept by Alpha per person (design
// §14), never in the browser. Re-exported by types.ts, the window's one import.

export interface Me {
  user: { id: string; name: string; role: 'owner' | 'member' }
  signIn: boolean // each person signs in here
  developer: boolean // alpha.yaml says so: modules and connectors come from folders too
  tenant: string
  theme: 'mac' | 'light' | 'dark' // Appearance: Match Mac, or one look
  layout: Layout
  foldLines: number // a finished reply's lines shown before More (limits.yaml)
}

// How the person left the window (UI batch 2, 26 Oct: all of it here, none in the browser).
export interface Layout {
  railFolded: boolean
  folded: string[] // the modules folded in the rail
  hidden: string[] // the modules hidden from the rail, with the ones inside them
  railWidth: number | null // the rail dragged wider or narrower; none is 216px
  panel: number | null // the assistant's width; none is 320px
  assistant: 'open' | 'folded'
  pageSize: number | null // a table's rows to a page; none is 50
  agent: string | null // the agent the assistant shows; none is the Chief of staff
}
