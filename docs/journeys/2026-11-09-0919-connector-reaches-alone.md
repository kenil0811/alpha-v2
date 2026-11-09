# Journey connector-reaches: 2026-11-09 09:19

A connector reaches only the hosts it names; anything else is refused and listed

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 1 s, $0.00.


## 1. Served the made-up site journeys/fixtures/sites/reach at http://127.0.0.1:56268

Took 0.0 s.


## 2. Added the made-up connector reacher and connected it for /tmp

Took 0.8 s.

- pass: Answer of named in Reached is Reached. (saw "Reached.")
- pass: Answer of unnamed in Reached is refused (saw "refused")
- pass: reacher refused reaching localhost 1 time(s) (saw 1)
- pass: errors: 0 (saw 0)

## The world after

Reached: Answer (text)

- answer "Reached." [looked_up]
- answer "refused" [looked_up]
