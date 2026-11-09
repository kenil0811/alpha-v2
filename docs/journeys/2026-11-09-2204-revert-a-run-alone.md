# Journey revert-a-run: 2026-11-09 22:04

a turn and a schedule’s run reverted from Activity put the table back; reverting a revert puts the work back

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 34 s, $0.23.


## 1. Said “In a module called Shop, make a table Deals with a Name and a Stage (New, Won, Lost): Alder Bakery at New and Birch Dental at New.
”

Reply (6.1 s): The Shop module now has a Deals table with Name and Stage (New, Won, Lost). Alder Bakery and Birch Dental are both in it at New.

Steps: Made the table Deals; Added 2 rows to Deals.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 66574 (cache read 60351), out 565; $0.07.

- pass: rows in Deals: 2 (saw 2)
- pass: errors: 0 (saw 0)

## 2. Said “Make me a schedule in Shop called Opener that, when it runs, adds two deals at New: Cedar Garage and Dune Cafe. Start it now.
”

Reply (25.6 s): Opener is set up in Shop and has run: Cedar Garage and Dune Cafe are now in Deals at New, alongside Alder Bakery and Birch Dental.

A schedule has to have a timing and you didn't give one, so I set it to once a year, on 1 January at 09:00, as a placeholder. Running it again won't create duplicates, but if you delete either deal, the next run will add it back.

Do you want it on a regular timing, or should I remove it now that it's done its job?

Steps: Worked on it; Looked for the right connection; Ran: List the module folders; Kept the skill opener in Shop; Kept the schedule opener in Shop; Kept the schedule opener in Shop; Ran Opener to try it; Kept the schedule opener in Shop; Ran Opener to try it; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 281395 (cache read 269024), out 3042; $0.21.

- pass: the last run ended ok (saw ok: Opener: Opener: 2 added, 0 changed, 0 already there.)
- pass: rows in Deals: 4 (saw 4)

## 3. Said “Set Alder Bakery and Birch Dental to Won.”

Reply (2.2 s): Alder Bakery and Birch Dental are now at Won. Cedar Garage and Dune Cafe are still at New.

Steps: Changed 2 rows in Deals.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 339745 (cache read 326805), out 3258; $0.23.

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

## The world after

Deals: Name (text), Stage (choice), Notes (notes)

- name "Alder Bakery" [stated], stage "New" [stated]
- name "Birch Dental" [stated], stage "New" [stated]
- name "Cedar Garage" [looked_up], stage "New" [looked_up]
- name "Dune Cafe" [looked_up], stage "New" [looked_up]
