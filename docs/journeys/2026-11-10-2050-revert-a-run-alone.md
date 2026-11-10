# Journey revert-a-run: 2026-11-10 20:50

a turn and a schedule’s run reverted from Activity put the table back; reverting a revert puts the work back

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 26 s, $0.21.


## 1. Said “In a module called Shop, make a table Deals with a Name and a Stage (New, Won, Lost): Alder Bakery at New and Birch Dental at New.
”

Reply (6.9 s): I made a new Shop module with a Deals table. Each deal has a Name and a Stage, which can be New, Won or Lost. Alder Bakery and Birch Dental are in it, both at New.

The table also got a Notes field for free notes on each deal. I wrote a short description of what the module is for. It counts as my assumption until you change it.

Steps: Made the table Deals; Added 2 rows to Deals.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 67104 (cache read 60830), out 636; $0.08.

- pass: rows in Deals: 2 (saw 2)
- pass: errors: 0 (saw 0)

## 2. Said “Make me a schedule in Shop called Opener that, when it runs, adds two deals at New: Cedar Garage and Dune Cafe. Start it now.
”

Reply (15.8 s): I made the Opener schedule in Shop and ran it just now. It added Cedar Garage and Dune Cafe at New, so Deals now has four deals.

You didn't say how often it should run, so I set it to every day at 08:00. Later runs won't add the two deals again, so they'll just find them already there and do nothing. If you only wanted it to run once, I can turn it off.

Steps: Looked for the right connection; Worked on it; Looked for the right connection; Ran: List module files and show module definition; Kept the skill opener in Shop; Kept the schedule Opener in Shop; Ran Opener to try it; Kept the skill opener in Shop.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 229630 (cache read 217239), out 2158; $0.19.

- pass: the last run ended ok (saw ok: Opener: Opener: 2 added, 0 changed, 0 already there.)
- pass: rows in Deals: 4 (saw 4)

## 3. Said “Set Alder Bakery and Birch Dental to Won.”

Reply (2.8 s): Alder Bakery and Birch Dental are now at Won. Cedar Garage and Dune Cafe are still at New.

Steps: Changed 2 rows in Deals.

Spent so far: claude-haiku-5-5: in 1216 (cache read 0), out 17; claude-opus-5-5: in 288231 (cache read 275307), out 2373; $0.21.

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

The journal verifies, rows included: 44 lines.

## The world after

Deals: Name (text), Stage (choice), Notes (notes)

- name "Alder Bakery" [stated], stage "New" [stated]
- name "Birch Dental" [stated], stage "New" [stated]
- name "Cedar Garage" [looked_up], stage "New" [looked_up]
- name "Dune Cafe" [looked_up], stage "New" [looked_up]
