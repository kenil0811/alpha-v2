# Journey a-rule-not-a-note: 2026-11-10 20:48

a rule the person says in their own words reaches the rule tool and its Save card, not a standing instruction

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 6 s, $0.07.


## 1. Said “From now on, never email anyone with example.com domian”

Reply (3.2 s): I've set up a rule so Alpha never emails anyone with an example.com address. It isn't active yet: it's waiting on a card for you to click Save. Once you do, it applies across all of Alpha.

Steps: Worked on it.

Spent so far: claude-haiku-5-5: in 1179 (cache read 0), out 18; claude-opus-5-5: in 44065 (cache read 38417), out 209; $0.06.

- pass: a question card waiting (saw Save this rule? Alpha must never send to addresses at example.com, anywhere in Alpha. | )
- pass: cards waiting: 1 (saw 1)
- pass: SELECT id FROM journal WHERE kind = 'remembered' gives 0 (saw [])
- pass: errors: 0 (saw 0)

## 2. Said “From now on, write deal notes in short bullet points.”

Reply (2.5 s): Noted. From now on I'll write your deal notes as short bullet points.

The example.com rule still needs you to click Save on its card before it takes effect.

Steps: Remembered: Write deal notes in short bullet points..

Spent so far: claude-haiku-5-5: in 1179 (cache read 0), out 18; claude-opus-5-5: in 89021 (cache read 82982), out 348; $0.07.

- pass: SELECT id FROM journal WHERE kind = 'remembered' gives 1 (saw [{"id":10}])
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 12 lines.

## The world after
