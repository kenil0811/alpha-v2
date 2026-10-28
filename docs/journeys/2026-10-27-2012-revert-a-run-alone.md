# Journey revert-a-run: 2026-10-27 20:12

a turn and an agent’s run reverted from Activity put the table back; reverting a revert puts the work back

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 33 s.


## 1. Said “In a module called Shop, make a table Deals with a Name and a Stage (New, Won, Lost): Alder Bakery at New and Birch Dental at New.
”

Reply (6.7 s): I made a new module called Shop with a Deals table. Each deal has a Name and a Stage, which can be New, Won or Lost. I added Alder Bakery and Birch Dental, both at New, using the names and stages you gave me. The table also has a Notes field for anything else you want to jot down on a deal.

Steps: Made the table Deals; Added 2 rows to Deals.

Tokens so far in the session: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 60473 (cache read 54970), out 593.

- pass: rows in Deals: 2 (saw 2)
- pass: errors: 0 (saw 0)

## 2. Said “Make me an agent in Shop called Opener that, when it runs, adds two deals at New: Cedar Garage and Dune Cafe. Start it now.
”

Reply (23.2 s): I made Opener in Shop and started it. It added Cedar Garage and Dune Cafe at New, so Deals now has four deals, all at New.

- **Running it again:** it won't add copies, because it looks for each deal by name. If you've since moved Cedar Garage or Dune Cafe to another stage, a re-run won't put it back to New.
- **When it runs:** you didn't give it a schedule, and Alpha needs every agent to have either a schedule or tasks to work on. So I set it to wait for tasks: it runs when you start it or give it a task. I can put it on a schedule instead if you want.

Steps: Worked on it; Looked for the right connection; Kept the skill opener in Shop; Kept the skill opener in Shop; Kept the agent opener in Shop; Kept the skill opener in Shop; Kept the agent opener in Shop; Ran Opener to try it; Kept the agent opener in Shop; Ran Opener to try it; Looked through the tables; Looked through the tables.

Tokens so far in the session: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 285312 (cache read 273625), out 3018.

- pass: the last run ended ok (saw ok: Opener: Added Cedar Garage and Dune Cafe at New (2 added, 0 changed, 0 already there).)
- pass: rows in Deals: 4 (saw 4)

## 3. Said “Set Alder Bakery and Birch Dental to Won.”

Reply (2.6 s): Alder Bakery and Birch Dental are now at Won, as you asked. Cedar Garage and Dune Cafe are still at New.

Steps: Changed 2 rows in Deals.

Tokens so far in the session: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 339721 (cache read 327428), out 3238.

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
