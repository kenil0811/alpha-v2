// Where a person's interview stands, as its routes answer the window: shared by the plugin's code
// and its screens, so neither drifts from the other.
export interface HomeView {
  title: string // Let Alpha get to know you
  state: 'start' | 'part way' | 'declined' | 'done'
  sources: { answered: number; of: number }
  workflows: { all: number; closed: number }
  agent: string // whose chat the interview is in
}
