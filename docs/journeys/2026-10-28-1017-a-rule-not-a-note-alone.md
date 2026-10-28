# Journey a-rule-not-a-note: 2026-10-28 10:17

a rule the person says in their own words reaches the rule tool and its Save card, not a standing instruction

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 6 s.


## 1. Said “From now on, never email anyone with example.com domian”

Reply (3.5 s): I've drafted the rule: Alpha will never send anything to an address at example.com, anywhere in Alpha. It's on a card in your window, and it only takes effect once you click Save there.

Steps: Worked on it.

Tokens so far in the session: claude-haiku-5-5: in 1179 (cache read 0), out 18; claude-opus-5-5: in 39720 (cache read 34784), out 212.

- pass: a question card waiting (saw Save this rule? Alpha must never send to addresses at example.com, anywhere in Alpha. | )
- pass: cards waiting: 1 (saw 1)
- pass: SELECT id FROM journal WHERE kind = 'remembered' gives 0 (saw [])
- pass: errors: 0 (saw 0)

## 2. Said “From now on, write deal notes in short bullet points.”

Reply (2.2 s): Saved. From now on I'll write your deal notes as short bullet points. The example.com rule still needs you to click Save on its card before it takes effect.

Steps: Remembered: Write deal notes in short bullet points..

Tokens so far in the session: claude-haiku-5-5: in 1179 (cache read 0), out 18; claude-opus-5-5: in 80346 (cache read 75013), out 350.

- pass: SELECT id FROM journal WHERE kind = 'remembered' gives 1 (saw [{"id":10}])
- pass: errors: 0 (saw 0)

## The world after
