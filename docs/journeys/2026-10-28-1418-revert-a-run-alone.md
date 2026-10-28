# Journey revert-a-run: 2026-10-28 14:18

a turn and an agent’s run reverted from Activity put the table back; reverting a revert puts the work back

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 34 s.


## 1. Said “In a module called Shop, make a table Deals with a Name and a Stage (New, Won, Lost): Alder Bakery at New and Birch Dental at New.
”

Reply (7.9 s): I made a new module called Shop with a Deals table. It has a Name and a Stage that can be New, Won or Lost, and a Notes field was added on its own. Alder Bakery and Birch Dental are both in it at New, as you gave them.

I also wrote a short description of what the module is for: it tracks the shop's deals and where each one stands, to help decide which to push forward. That part was my guess and is marked as assumed, so change it if it doesn't fit.

Steps: Made the table Deals; Added 2 rows to Deals.

Tokens so far in the session: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 60503 (cache read 54974), out 687.

- pass: rows in Deals: 2 (saw 2)
- pass: errors: 0 (saw 0)

## 2. Said “Make me an agent in Shop called Opener that, when it runs, adds two deals at New: Cedar Garage and Dune Cafe. Start it now.
”

Reply (23.3 s): I made an agent in Shop called Opener and started it. It added Cedar Garage and Dune Cafe to Deals at New, so Deals now has four deals.

- **It needed a way to be started:** Alpha won't let an agent exist with nothing to start it. I didn't want to put it on a schedule you hadn't asked for, so it only runs when it's given a task. You can also start it by asking me.
- **Running it again is safe:** it won't create duplicates if Cedar Garage and Dune Cafe are still there. But if you've moved either one to Won or Lost, a new run will put it back to New.

The first try failed because the agent wasn't yet allowed to change the Deals table. I gave it that permission and the second run worked.

Steps: Worked on it; Looked for the right connection; Kept the skill opener in Shop; Kept the skill opener in Shop; Kept the agent opener in Shop; Kept the skill opener in Shop; Kept the agent opener in Shop; Ran Opener to try it; Kept the agent opener in Shop; Ran Opener to try it.

Tokens so far in the session: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 232761 (cache read 221394), out 3017.

- pass: the last run ended ok (saw ok: Opener: Opened Cedar Garage and Dune Cafe at New (2 added, 0 changed, 0 already there).)
- pass: rows in Deals: 4 (saw 4)

## 3. Said “Set Alder Bakery and Birch Dental to Won.”

Reply (3.1 s): I've set Alder Bakery and Birch Dental to Won. Cedar Garage and Dune Cafe are still at New.

Steps: Changed 2 rows in Deals.

Tokens so far in the session: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 286700 (cache read 274646), out 3233.

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
