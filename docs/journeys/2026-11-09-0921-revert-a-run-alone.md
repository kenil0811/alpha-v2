# Journey revert-a-run: 2026-11-09 09:21

a turn and an agent’s run reverted from Activity put the table back; reverting a revert puts the work back

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 31 s, $0.23.


## 1. Said “In a module called Shop, make a table Deals with a Name and a Stage (New, Won, Lost): Alder Bakery at New and Birch Dental at New.
”

Reply (6.7 s): The Shop module now has a Deals table with a Name and a Stage (New, Won, Lost). Alder Bakery and Birch Dental are both in it at New, as you stated. It also came with a Notes field, which every main table gets.

Steps: Made the table Deals; Added 2 rows to Deals.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 62631 (cache read 56507), out 585; $0.07.

- pass: rows in Deals: 2 (saw 2)
- pass: errors: 0 (saw 0)

## 2. Said “Make me an agent in Shop called Opener that, when it runs, adds two deals at New: Cedar Garage and Dune Cafe. Start it now.
”

Reply (21.9 s): Opener is set up in Shop and has run. It added Cedar Garage and Dune Cafe at New, so Deals now has four deals, all at New.

- **Schedule:** every agent has to have a schedule and you didn't ask for one, so I set Opener's to 31 February, a date that never comes. It will only run when someone starts it. If you'd like it to run regularly, tell me how often.
- **Running it again:** it won't create duplicates. It finds the same two deals and leaves them as they are, unless a stage has changed, in which case it may set that deal back to New.

Steps: Worked on it; Looked for the right connection; Ran: List the module folders; Kept the skill opener in Shop; Kept the skill opener in Shop; Kept the agent opener in Shop; Kept the agent opener in Shop; Ran Opener to try it; Kept the agent opener in Shop; Ran Opener to try it; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 266509 (cache read 254434), out 2892; $0.21.

- pass: the last run ended ok (saw ok: Opener: Opener: 2 added, 0 changed, 0 already there.)
- pass: rows in Deals: 4 (saw 4)

## 3. Said “Set Alder Bakery and Birch Dental to Won.”

Reply (2.5 s): Alder Bakery and Birch Dental are now at Won. Cedar Garage and Dune Cafe are still at New.

Steps: Changed 2 rows in Deals.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 321908 (cache read 309237), out 3109; $0.23.

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
