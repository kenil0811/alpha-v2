# Journey revert-a-run: 2026-11-09 13:09

a turn and a schedule’s run reverted from Activity put the table back; reverting a revert puts the work back

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 25 s, $0.20.


## 1. Said “In a module called Shop, make a table Deals with a Name and a Stage (New, Won, Lost): Alder Bakery at New and Birch Dental at New.
”

Reply (7.3 s): The Shop module now has a Deals table with Name and Stage (New, Won, Lost). Alder Bakery and Birch Dental are both in it at New, as you stated. It also comes with a Notes field for free notes on each deal.

Steps: Made the table Deals; Added 2 rows to Deals.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 62791 (cache read 56584), out 643; $0.07.

- pass: rows in Deals: 2 (saw 2)
- pass: errors: 0 (saw 0)

## 2. Said “Make me a schedule in Shop called Opener that, when it runs, adds two deals at New: Cedar Garage and Dune Cafe. Start it now.
”

Reply (15.2 s): Opener is set up in Shop and has run: Cedar Garage and Dune Cafe are now in Deals at New, alongside Alder Bakery and Birch Dental. The first attempt failed on a setup slip of mine and added nothing, so there are no duplicates.

You didn't say how often it should run, so I assumed every day at 07:00. Later runs find both deals already there and won't add them twice, but if someone changes one of their stages, the next run will put it back to New. If you only wanted this once, I can turn the schedule off, or give it a different time.

Steps: Looked for the right connection; Worked on it; Kept the skill opener in Shop; Kept the schedule opener in Shop; Ran Opener to try it; Kept the schedule opener in Shop; Ran Opener to try it; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 234794 (cache read 223975), out 2161; $0.17.

- pass: the last run ended ok (saw ok: Opener: Opener landed Cedar Garage and Dune Cafe at New: 2 added, 0 changed, 0 already there.)
- pass: rows in Deals: 4 (saw 4)

## 3. Said “Set Alder Bakery and Birch Dental to Won.”

Reply (2.8 s): Alder Bakery and Birch Dental are now at Won. Opener only touches Cedar Garage and Dune Cafe, so its daily run won't change these two.

Steps: Changed 2 rows in Deals.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 287720 (cache read 276270), out 2432; $0.20.

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
