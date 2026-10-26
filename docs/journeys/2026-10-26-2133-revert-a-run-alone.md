# Journey revert-a-run: 2026-10-26 21:33

a turn and an agent’s run reverted from Activity put the table back; reverting a revert puts the work back

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 32 s.


## 1. Said “In a module called Shop, make a table Deals with a Name and a Stage (New, Won, Lost): Alder Bakery at New and Birch Dental at New.
”

Reply (6.6 s): I made a new Shop module with a Deals table. Each deal has a Name and a Stage, which can be New, Won or Lost. Alder Bakery and Birch Dental are in it, both at New, as you gave them.

Steps: Made the table Deals; Added 2 rows to Deals.

Tokens so far in the session: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 53806 (cache read 48883), out 506.

- pass: rows in Deals: 2 (saw 2)
- pass: errors: 0 (saw 0)

## 2. Said “Make me an agent in Shop called Opener that, when it runs, adds two deals at New: Cedar Garage and Dune Cafe. Start it now.
”

Reply (22.2 s): I made Opener in Shop and ran it. Cedar Garage and Dune Cafe are now in Deals at New, so there are four deals in total.

The first run failed because the agent hadn't been given permission to change Deals. I added that and it went through on the second run.

Opener has no schedule: it only runs when you start it or give it a task. Running it again won't create duplicates, because it skips deals that are already there. If you'd like it to run on its own, for example every morning, I can set that up.

Steps: Worked on it; Looked for the right connection; Kept the skill opener in Shop; Kept the skill opener in Shop; Kept the agent opener in Shop; Kept the skill opener in Shop; Kept the agent opener in Shop; Ran Opener to try it; Kept the agent opener in Shop; Ran Opener to try it.

Tokens so far in the session: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 233654 (cache read 222925), out 2675.

- pass: the last run ended ok (saw ok: Opener: Added Cedar Garage and Dune Cafe at New (2 new, 0 already there).)
- pass: rows in Deals: 4 (saw 4)

## 3. Said “Set Alder Bakery and Birch Dental to Won.”

Reply (3.2 s): Alder Bakery and Birch Dental are now at Won. Cedar Garage and Dune Cafe are still at New.

Steps: Changed 2 rows in Deals.

Tokens so far in the session: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 282797 (cache read 271433), out 2894.

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

Deals: Name (text), Stage (choice)

- name "Alder Bakery" [stated], stage "New" [stated]
- name "Birch Dental" [stated], stage "New" [stated]
- name "Cedar Garage" [looked_up], stage "New" [looked_up]
- name "Dune Cafe" [looked_up], stage "New" [looked_up]
