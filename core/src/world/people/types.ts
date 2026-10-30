export type KeyKind = 'email' | 'phone' | 'profile' | 'domain' | 'company'
export type Keys = Partial<Record<KeyKind, string[]>>
export type Kind = 'person' | 'company'

export const KEYS_OF: Record<Kind, KeyKind[]> = {
  person: ['email', 'phone', 'profile'],
  company: ['domain', 'company'],
}

// How good a name is: the person's word, a row that is the person (a contact card), a name a
// message or meeting gives, a key standing in for a name.
export const RANK = { person: 4, row: 3, header: 2, key: 1 } as const

// What a row said of someone.
export interface Said {
  kind: Kind
  name: string
  rank: number
  keys: Keys
  // what a row says that names someone without being theirs alone: a role address, a phone
  // another name holds; kept for the match card, never a key that merges (item 25, 25 Oct)
  soft?: { email?: string[]; phone?: string[] }
  company?: string | null
  title?: string | null
}

export interface Exchange {
  value: string // the address it reached them at
  channel: string
  at: string
  by: 'you' | 'them' | null
}

// The person's own word is a source like a row, under this record.
export const PERSONS_WORD = 'person'

// The rules rows are read for people by; raised when they change, so every row is read again.
// 2: companies by their main domain, named in words (21 Oct).
export const PEOPLE_RULES = 2

export interface Contact {
  days: number
  last: string | null
  count: number
  channels: { channel: string; count: number }[]
  first: 'you' | 'them' | null // who wrote first in those days
}

export interface PersonOut {
  id: string
  kind: Kind
  name: string
  keys: Keys
  merged: { id: string; name: string }[] // merged into it, each as it was on its own
  companies: {
    id: string
    name: string
    title: string | null
    since: string
    ended: string | null
  }[]
  people: { id: string; name: string; title: string | null }[] // a company's, now
  sources: { table: string | null; record: string; said: Said; at: string }[]
  contact: Contact
  createdAt: string
}

export interface PersonLine {
  id: string
  kind: Kind
  name: string
  emails: string[]
  phones: string[]
  companies: string[]
  titles: string[] // their titles now, as rows give them
  domains: string[]
  last: string | null
  count: number
  first: 'you' | 'them' | null
  people: number // a company's, now
  tables: (string | null)[] // the tables whose rows said them; none: the person's own word
}

export interface Pair {
  id: string
  a: string
  b: string
  why: string
  state: 'found' | 'proposed' | 'merged' | 'apart' | 'withdrawn'
  card: string | null
}

// Why two may be one, as the card says it.
export const SAME_NAME = 'the same name'
export const SAME_PLACE = 'the same name and company'
export const NAMES_BOTH = 'a row names both'
export const SAME_ADDRESS = 'the same address'
export const SAME_PHONE = 'the same phone'

// One side of a pair on its card: enough to tell the two apart.
export interface Side {
  id: string
  kind: Kind
  name: string
  emails: string[]
  phones: string[]
  profile: string | null
  companies: string[]
  from: string[] // the tables it came from
  last: string | null
  count: number
}

export interface MatchView {
  pairs: { id: string; why: string; state: Pair['state']; a: Side; b: Side }[]
  open: number
  samePlace: number // undecided pairs with the same name and company
}

// ---- words and keys -------------------------------------------------------------------------

export interface PersonRow {
  id: string
  kind: Kind
  name: string
  rank: number
  merged_into: string | null
  created_at: string
}
