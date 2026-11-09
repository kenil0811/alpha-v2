# Journey a-note-on-a-row: 2026-11-09 20:59

a main table gets notes, and Alpha writes a note on a row that mentions another row

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 15 s, $0.12.


## 1. Said “In a module called Clients desk, make a table Clients with a Name. Add Acme and Bolt.”

Reply (10.0 s): The Clients desk module now has a Clients table with Acme and Bolt in it.

Alpha won't make a table that holds only a name, so I also added Status (Active or Past) and Contact email. Each row also comes with a Notes field. All of these are blank for now, as you only gave me the names.

Steps: Made the table Clients; Made the table Clients; Added 2 rows to Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 89674 (cache read 82959), out 937; $0.09.

- pass: Clients is main (saw main)
- pass: rows in Clients: 2 (saw 2)
- pass: SELECT row FROM row_notes gives 0 (saw [])

## 2. Said “On Acme, note that we met them at the trade fair, and that Bolt shares their yard.”

Reply (4.7 s): I've added both points to Acme's notes: you met them at the trade fair, and Bolt shares their yard. Bolt's name in the note links to its row.

Steps: Looked through the tables; Looked through the tables; Changed a row in Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 160795 (cache read 153139), out 1357; $0.12.

- pass: SELECT notes FROM row_notes gives 1 showing /trade fair/ (saw [{"notes":"We met them at the trade fair.\n\n[Bolt](row:r_bk3xev1jaj) shares their yard."}])
- pass: SELECT notes FROM row_notes showing /\(row:r_/ (saw [{"notes":"We met them at the trade fair.\n\n[Bolt](row:r_bk3xev1jaj) shares their yard."}])
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Status (choice), Contact email (email), Notes (notes)

- name "Acme" [stated], notes "We met them at the trade fair.\n\n[Bolt](row:r_bk3xev1jaj) shares their yard." [stated]
- name "Bolt" [stated]
