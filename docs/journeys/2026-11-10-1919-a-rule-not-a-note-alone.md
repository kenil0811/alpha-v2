# Journey a-rule-not-a-note: 2026-11-10 19:19

a rule the person says in their own words reaches the rule tool and its Save card, not a standing instruction

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 7 s, $0.06.


## 1. Said “From now on, never email anyone with example.com domian”

Reply (4.6 s): I've set up a rule that stops me from sending anything to an address at example.com. It isn't active yet. It's waiting on a card in your window, and it only takes effect once you click Save.

It covers anything I send, not just email, which should match what you meant.

Steps: Worked on it.

Spent so far: claude-haiku-5-5: in 1179 (cache read 0), out 18; claude-opus-5-5: in 41854 (cache read 37596), out 245; $0.05.

- pass: a question card waiting (saw Save this rule? Alpha must never send to addresses at example.com, anywhere in Alpha. | )
- pass: cards waiting: 1 (saw 1)
- pass: SELECT id FROM journal WHERE kind = 'remembered' gives 0 (saw [])
- pass: errors: 0 (saw 0)

## 2. Said “From now on, write deal notes in short bullet points.”

Reply (2.5 s): I've saved that, so I'll write your deal notes as short bullet points from now on.

The example.com rule is still waiting for you to click Save on its card.

Steps: Remembered: Write deal notes in short bullet points..

Spent so far: claude-haiku-5-5: in 1179 (cache read 0), out 18; claude-opus-5-5: in 84764 (cache read 80033), out 384; $0.06.

- pass: SELECT id FROM journal WHERE kind = 'remembered' gives 1 (saw [{"id":10}])
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 12 lines.

## The world after
