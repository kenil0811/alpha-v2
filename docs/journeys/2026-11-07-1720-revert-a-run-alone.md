# Journey revert-a-run: 2026-11-07 17:20

a turn and an agent’s run reverted from Activity put the table back; reverting a revert puts the work back

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 43 s, $0.28.


## 1. Said “In a module called Shop, make a table Deals with a Name and a Stage (New, Won, Lost): Alder Bakery at New and Birch Dental at New.
”

Reply (7.1 s): I made the Shop module with a Deals table, and added Alder Bakery and Birch Dental, both at New. The table has Name and Stage (New, Won, Lost), plus a Notes field that Alpha adds to every main table.

Steps: Made the table Deals; Added 2 rows to Deals.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 62718 (cache read 56559), out 606; $0.07.

- pass: rows in Deals: 2 (saw 2)
- pass: errors: 0 (saw 0)

## 2. Said “Make me an agent in Shop called Opener that, when it runs, adds two deals at New: Cedar Garage and Dune Cafe. Start it now.
”

Reply (33.8 s): Opener is set up in Shop and has run: Cedar Garage and Dune Cafe are now in Deals at New, alongside Alder Bakery and Birch Dental.

- **No real schedule:** every agent has to have a trigger, and you didn't ask for one. I set it to 31 February, a date that never comes, so Opener only runs when you start it.
- **Running it again:** it won't add the two deals a second time, because it recognises the ones it already added. If you've moved one of them to Won or Lost, a rerun could put it back to New; I haven't tested that.

The first run failed because Opener hadn't been given access to Deals. I gave it access to that table only, and the second run worked.

Steps: Worked on it; Looked for the right connection; Ran: List the module folders and files; Kept the skill opener in Shop; Kept the skill opener in Shop; Kept the agent opener in Shop; Kept the skill opener in Shop; Kept the agent opener in Shop; Kept the skill opener in Shop; Kept the agent opener in Shop; Ran Opener to try it; Kept the agent opener in Shop; Ran: Show the Shop module's settings and files; Ran Opener to try it; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 331293 (cache read 316937), out 4265; $0.26.

- pass: the last run ended ok (saw ok: Opener: Opener: 2 added, 0 changed, 0 already there.)
- pass: rows in Deals: 4 (saw 4)

## 3. Said “Set Alder Bakery and Birch Dental to Won.”

Reply (2.4 s): Alder Bakery and Birch Dental are now at Won. Cedar Garage and Dune Cafe are still at New.

Steps: Changed 2 rows in Deals.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 391314 (cache read 376328), out 4482; $0.28.

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
