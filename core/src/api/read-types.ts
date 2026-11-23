// What Alpha read, as the window shows it (api/read-report.ts): per source, what was read, kept,
// left out and why, and what was made from it; every count the journal's, never a model's words.

export interface ReadTableView {
  table: string | null // the table's id, to open it; none for files
  name: string
  read: number // what the reads met, left out included
  kept: number // what is in Alpha from them: new, changed and the same
  added: number
  changed: number
  leftOut: number // on the never-use list (rules N1)
  skipped: number // passed over: removed before by a person, or a read that only keeps rows up to date
  rows: string[] // the rows added or changed, newest first, at most 200, to open beside the page
}

export interface ReadSourceView {
  connection: string
  title: string // Gmail
  account: string
  off: string | null // why it reads nothing now, in words: switched off, needs sign-in
  allowed: { by: string; at: string } | null // who connected it, and when
  reads: number // how many reads the journal holds
  lastReadAt: string | null
  reading: boolean // a read under way now: its counts so far are in
  failed: number // reads that did not finish
  tables: ReadTableView[]
}

// A person's Get to know you in Set up Alpha (the interviews plugin): which sources they let it
// read and which they switched off, and what they did with the lines it proposed.
export interface LearnedView {
  person: string // their name
  at: string
  read: string[]
  off: string[]
  kept: number // lines kept into How to work
  dropped: number
  yes: number // playbacks answered yes
  no: number
}

export interface ReadReportView {
  says: string | null // "I've read 1,204 emails, 38 events and 212 pages so far"; none before any
  reading: boolean
  sources: ReadSourceView[]
  learned: LearnedView[]
}
