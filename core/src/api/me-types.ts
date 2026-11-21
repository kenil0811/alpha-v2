// Who is at the window and how they left it: the person's own, kept by Alpha per person (design
//), never in the browser. Re-exported by types.ts, the window's one import.

export interface Me {
  user: { id: string; name: string; role: 'owner' | 'member' }
  signIn: boolean // each person signs in here
  developer: boolean // alpha.yaml says so: modules and connectors come from folders too
  tenant: string
  theme: 'mac' | 'light' | 'dark' // Appearance: Match Mac, or one look
  textSize: 'small' | 'medium' | 'large' // Appearance: Medium is the window's own sizes
  layout: Layout
  plugins: string[] // the plugins on here (rules P1): the window shows a plugin's screens only then
}

// How the person left the window: all of it here, none in the browser.
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
  workspaceName: string | null // the workspace tile's name, as the person renamed it; none: "<name>'s workspace"
  workspacePicture: string | null // the tile's picture, a small image kept as a data address; none: the initial
}
