# Journey a-rule-not-a-note: 2026-10-27 10:12

a rule the person says in their own words reaches the rule tool and its Save card, not a standing instruction

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 7 s.


## 1. Said “From now on, never email anyone with example.com domian”

Reply (3.8 s): I've set up a rule so Alpha never sends to any address at example.com, anywhere in Alpha. It's on a card in your window. It only takes effect once you press Save there.

Steps: Worked on it.

Tokens so far in the session: claude-haiku-5-5: in 1179 (cache read 0), out 18; claude-opus-5-5: in 37220 (cache read 18500), out 216.

- pass: a question card waiting (saw Save this rule? Alpha must never send to addresses at example.com, anywhere in Alpha. | )
- pass: cards waiting: 1 (saw 1)
- pass: SELECT id FROM journal WHERE kind = 'remembered' gives 0 (saw [])
- pass: errors: 0 (saw 0)

## 2. Said “From now on, write deal notes in short bullet points.”

Reply (3.2 s): Done. I'll write your deal notes as short bullet points from now on.

The example.com rule isn't active yet. It's still waiting for you to press Save on its card.

Steps: Remembered: Write deal notes in short bullet points..

Tokens so far in the session: claude-haiku-5-5: in 1179 (cache read 0), out 18; claude-opus-5-5: in 75348 (cache read 56229), out 378.

- pass: SELECT id FROM journal WHERE kind = 'remembered' gives 1 (saw [{"id":10}])
- pass: errors: 0 (saw 0)

## The world after
