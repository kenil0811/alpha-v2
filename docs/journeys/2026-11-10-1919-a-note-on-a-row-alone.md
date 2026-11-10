# Journey a-note-on-a-row: 2026-11-10 19:19

a main table gets notes, and Alpha writes a note on a row that mentions another row

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 13 s, $0.09.


## 1. Said “In a module called Clients desk, make a table Clients with a Name. Add Acme and Bolt.”

Reply (9.7 s): I made the Clients desk module with a Clients table, and added Acme and Bolt to it.

The table also has a few fields I added: Status (Prospect, Active or Past), Contact email and Client since. There's a Notes space on each client too. These are all empty for Acme and Bolt for now, so fill them in or tell me and I'll add them.

Steps: Made the table Clients; Made the table Clients; Added 2 rows to Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 85885 (cache read 80584), out 875; $0.08.

- pass: Clients is main (saw main)
- pass: rows in Clients: 2 (saw 2)
- pass: SELECT row FROM row_notes gives 0 (saw [])

## 2. Said “On Acme, note that we met them at the trade fair, and that Bolt shares their yard.”

Reply (2.9 s): I added a note to Acme saying you met them at the trade fair and that Bolt shares their yard. Bolt's name in the note links to its client entry.

Steps: Changed a row in Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 130969 (cache read 125127), out 1079; $0.09.

- pass: SELECT notes FROM row_notes gives 1 showing /trade fair/ (saw [{"notes":"We met them at the trade fair. [Bolt](row:r_f4j2093228) shares their yard."}])
- pass: SELECT notes FROM row_notes showing /\(row:r_/ (saw [{"notes":"We met them at the trade fair. [Bolt](row:r_f4j2093228) shares their yard."}])
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 19 lines.

## The world after

Clients: Name (text), Status (choice), Contact email (email), Client since (date), Notes (notes)

- name "Acme" [stated], notes "We met them at the trade fair. [Bolt](row:r_f4j2093228) shares their yard." [stated]
- name "Bolt" [stated]
