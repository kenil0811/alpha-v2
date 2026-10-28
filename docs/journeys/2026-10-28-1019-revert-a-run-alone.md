# Journey revert-a-run: 2026-10-28 10:19

a turn and an agent’s run reverted from Activity put the table back; reverting a revert puts the work back

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 32 s.


## 1. Said “In a module called Shop, make a table Deals with a Name and a Stage (New, Won, Lost): Alder Bakery at New and Birch Dental at New.
”

Reply (7.7 s): I made a new Shop module with a Deals table. Each deal has a Name and a Stage, which can be New, Won or Lost. Alder Bakery and Birch Dental are both in it at New, as you said. The table also has a Notes field, which every table comes with.

I also wrote a short summary of what the module is for, as a placeholder: it tracks the shop's deals so you can decide which ones to follow up and which are won or lost. Change it if that's not right.

Steps: Made the table Deals; Added 2 rows to Deals.

Tokens so far in the session: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 60493 (cache read 54962), out 659.

- pass: rows in Deals: 2 (saw 2)
- pass: errors: 0 (saw 0)

## 2. Said “Make me an agent in Shop called Opener that, when it runs, adds two deals at New: Cedar Garage and Dune Cafe. Start it now.
”

Reply (21.0 s): I made Opener in Shop and started it. It added Cedar Garage and Dune Cafe to Deals at New, so Deals now has four deals.

- **No schedule:** Opener only runs when you start it, or when you give it a task. Every agent has to have one or the other, and you didn't ask for a schedule.
- **Running it again:** if you start it again, it won't make duplicates of Cedar Garage or Dune Cafe.

The first start failed because I hadn't let Opener change the Deals table. Once I gave it that, it ran without problems.

Steps: Worked on it; Looked for the right connection; Kept the skill opener in Shop; Kept the skill opener in Shop; Kept the agent opener in Shop; Kept the skill opener in Shop; Kept the agent opener in Shop; Ran Opener to try it; Kept the agent opener in Shop; Ran Opener to try it.

Tokens so far in the session: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 232024 (cache read 220787), out 2824.

- pass: the last run ended ok (saw ok: Opener: Added Cedar Garage and Dune Cafe at New (2 new, 0 already there).)
- pass: rows in Deals: 4 (saw 4)

## 3. Said “Set Alder Bakery and Birch Dental to Won.”

Reply (3.3 s): I set Alder Bakery and Birch Dental to Won. Cedar Garage and Dune Cafe are still at New.

Steps: Changed 2 rows in Deals.

Tokens so far in the session: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 285581 (cache read 273717), out 3041.

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
