# Journey revert-a-run: 2026-11-11 00:54

a turn and a schedule’s run reverted from Activity put the table back; reverting a revert puts the work back

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 28 s, $0.23.


## 1. Said “In a module called Shop, make a table Deals with a Name and a Stage (New, Won, Lost): Alder Bakery at New and Birch Dental at New.
”

Reply (6.8 s): I made a new Shop module with a Deals table. It has a Name and a Stage you can set to New, Won or Lost. Alder Bakery and Birch Dental are both in it at New.

I wrote short descriptions of the table, of what the module is for, and of each field, and they show as assumed until you change them. Won is coloured green and Lost red. The table also has a Notes field for free notes on each deal.

Steps: Made the table Deals; Added 2 rows to Deals.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 67070 (cache read 60828), out 639; $0.07.

- pass: rows in Deals: 2 (saw 2)
- pass: errors: 0 (saw 0)

## 2. Said “Make me a schedule in Shop called Opener that, when it runs, adds two deals at New: Cedar Garage and Dune Cafe. Start it now.
”

Reply (16.8 s): I made the Opener schedule in Shop and ran it. It added Cedar Garage and Dune Cafe to Deals at New, so the table now has four deals.

A schedule has to have a regular time, so I set it to every day at 08:00. Later runs won't add duplicates: if those two deals are already there, it adds nothing. I can change the time, or remove the schedule now that it has run once.

Steps: Looked for the right connection; Worked on it; Ran: List module files and show Shop's definition; Looked for the right connection; Kept the skill opener in Shop; Kept the skill opener in Shop; Kept the schedule opener in Shop; Ran Opener to try it.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 256829 (cache read 244458), out 2192; $0.19.

- pass: the last run ended ok (saw ok: Opener: Opener landed Cedar Garage and Dune Cafe at New (2 added, 0 already there).)
- pass: rows in Deals: 4 (saw 4)

## 3. Said “Set Alder Bakery and Birch Dental to Won.”

Reply (4.7 s): Alder Bakery and Birch Dental are now at Won. Cedar Garage and Dune Cafe are still at New.

Steps: Changed 2 rows in Deals; Looked through the tables; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 374738 (cache read 361434), out 2544; $0.23.

- pass: SELECT name FROM deals WHERE stage = 'Won' gives 2 (saw [{"name":"Alder Bakery"},{"name":"Birch Dental"}])

## 4. Reverted the last turn: In Deals, 2 values return.

Took 0.0 s.

- pass: SELECT name FROM deals WHERE stage = 'Won' gives 0 (saw [])
- pass: SELECT name FROM deals WHERE stage = 'New' gives 4 (saw [{"name":"Alder Bakery"},{"name":"Birch Dental"},{"name":"Cedar Garage"},{"name":"Dune Cafe"}])

## 5. Reverted the last run: In Deals, 2 rows go.

Took 0.0 s.

- pass: rows in Deals: 2 (saw 2)
- pass: SELECT name FROM deals WHERE name IN ('Cedar Garage', 'Dune Cafe') gives 0 (saw [])

## 6. Reverted the last revert: In Deals, 2 rows come back.

Took 0.0 s.

- pass: rows in Deals: 4 (saw 4)
- pass: SELECT name FROM deals WHERE name IN ('Cedar Garage', 'Dune Cafe') gives 2 (saw [{"name":"Cedar Garage"},{"name":"Dune Cafe"}])
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 50 lines.

## The world after

Deals: Name (text), Stage (choice), Notes (notes)

- name "Alder Bakery" [stated], stage "New" [stated]
- name "Birch Dental" [stated], stage "New" [stated]
- name "Cedar Garage" [looked_up], stage "New" [looked_up]
- name "Dune Cafe" [looked_up], stage "New" [looked_up]
