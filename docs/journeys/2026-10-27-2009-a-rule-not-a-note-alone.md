# Journey a-rule-not-a-note: 2026-10-27 20:09

a rule the person says in their own words reaches the rule tool and its Save card, not a standing instruction

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 7 s.


## 1. Said “From now on, never email anyone with example.com domian”

Reply (4.4 s): A card is open in your window with the rule: **never send anything to an address at example.com**. It covers email and every other kind of sending, everywhere in Alpha. It takes effect once you click Save on the card. Until then it isn't a rule yet.

Steps: Worked on it.

Tokens so far in the session: claude-haiku-5-5: in 1179 (cache read 0), out 18; claude-opus-5-5: in 39718 (cache read 34784), out 233.

- pass: a question card waiting (saw Save this rule? Alpha must never send to addresses at example.com, anywhere in Alpha. | )
- pass: cards waiting: 1 (saw 1)
- pass: SELECT id FROM journal WHERE kind = 'remembered' gives 0 (saw [])
- pass: errors: 0 (saw 0)

## 2. Said “From now on, write deal notes in short bullet points.”

Reply (2.5 s): I've saved that, so from now on I'll write your deal notes as short bullet points.

The example.com rule is still waiting on its card. It won't take effect until you click Save.

Steps: Remembered: Write deal notes in short bullet points..

Tokens so far in the session: claude-haiku-5-5: in 1179 (cache read 0), out 18; claude-opus-5-5: in 80378 (cache read 75028), out 378.

- pass: SELECT id FROM journal WHERE kind = 'remembered' gives 1 (saw [{"id":10}])
- pass: errors: 0 (saw 0)

## The world after
