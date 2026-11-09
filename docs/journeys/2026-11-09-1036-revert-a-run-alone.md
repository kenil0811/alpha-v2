# Journey revert-a-run: 2026-11-09 10:36

a turn and an agent’s run reverted from Activity put the table back; reverting a revert puts the work back

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 38 s, $0.25.


## 1. Said “In a module called Shop, make a table Deals with a Name and a Stage (New, Won, Lost): Alder Bakery at New and Birch Dental at New.
”

Reply (6.3 s): The Shop module now has a Deals table with a Name and a Stage (New, Won or Lost). Alder Bakery and Birch Dental are both in it at New, as you stated. The table also came with a free Notes field on each row.

Steps: Made the table Deals; Added 2 rows to Deals.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 62680 (cache read 56530), out 610; $0.07.

- pass: rows in Deals: 2 (saw 2)
- pass: errors: 0 (saw 0)

## 2. Said “Make me an agent in Shop called Opener that, when it runs, adds two deals at New: Cedar Garage and Dune Cafe. Start it now.
”

Reply (29.6 s): Opener is set up in Shop and has run: Cedar Garage and Dune Cafe are now in Deals at New, alongside Alder Bakery and Birch Dental.

- **No real schedule:** Alpha won't save an agent without a timing, even though you only asked for it to run when started. I set it to 31 February, a date that never comes, so it should only run when you start it. If you'd like it to run regularly, tell me how often.
- **Running it again:** it won't create duplicates. If either deal is still there, it's matched by name and stays as one row. But if you've since moved one to Won or Lost, a re-run may put it back to New, because I haven't tested that case.

Steps: Looked for the right connection; Worked on it; Kept the skill opener in Shop; Kept the agent opener in Shop; Kept the skill opener in Shop; Kept the agent opener in Shop; Kept the agent opener in Shop; Ran Opener to try it; Kept the agent opener in Shop; Ran Opener to try it; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 294648 (cache read 281857), out 3653; $0.23.

- pass: the last run ended ok (saw ok: Opener: Opener: 2 added, 0 changed, 0 already there (Cedar Garage, Dune Cafe at New).)
- pass: rows in Deals: 4 (saw 4)

## 3. Said “Set Alder Bakery and Birch Dental to Won.”

Reply (2.4 s): Alder Bakery and Birch Dental are now at Won, as you stated. Cedar Garage and Dune Cafe are still at New.

Steps: Changed 2 rows in Deals.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 351534 (cache read 338118), out 3874; $0.25.

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
