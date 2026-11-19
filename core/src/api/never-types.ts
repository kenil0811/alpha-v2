// The never-use list as Settings › Permissions shows it (rules N1).

// One kind Alpha ships: its name and whether the firm has it on. Its words stay in
// core/config/never.yaml and are never shown.
export interface NeverKindView {
  key: string
  title: string
  on: boolean
}

export interface NeverView {
  kinds: NeverKindView[] // the kinds Alpha ships, each on unless the owner turned it off
  everyone: string[] // the firm's own words, kept by the owner
  yours: string[] // this person's own
  owner: boolean // whether this person may change the kinds and the firm's words
}
