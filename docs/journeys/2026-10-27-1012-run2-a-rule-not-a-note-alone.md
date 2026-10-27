# Journey a-rule-not-a-note: 2026-10-27 10:12

a rule the person says in their own words reaches the rule tool and its Save card, not a standing instruction

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 7 s.


## 1. Said “From now on, never email anyone with example.com domian”

Reply (4.1 s): I've drafted a rule that stops me from emailing any address at example.com. It's waiting on a card in your window, and it won't apply until you click **Save**.

Once you save it, the block covers all of Alpha, not just one area.

Steps: Worked on it.

Tokens so far in the session: claude-haiku-5-5: in 1179 (cache read 0), out 18; claude-opus-5-5: in 37191 (cache read 32701), out 217.

- pass: a question card waiting (saw Save this rule? Alpha must never send to addresses at example.com, anywhere in Alpha. | )
- pass: cards waiting: 1 (saw 1)
- pass: SELECT id FROM journal WHERE kind = 'remembered' gives 0 (saw [])
- pass: errors: 0 (saw 0)

## 2. Said “From now on, write deal notes in short bullet points.”

Reply (2.7 s): Noted. From now on I'll write your deal notes as short bullet points.

The example.com rule still needs you to click **Save** on its card before it applies.

Steps: Remembered: Write deal notes in short bullet points..

Tokens so far in the session: claude-haiku-5-5: in 1179 (cache read 0), out 18; claude-opus-5-5: in 75295 (cache read 70404), out 367.

- pass: SELECT id FROM journal WHERE kind = 'remembered' gives 1 (saw [{"id":10}])
- pass: errors: 0 (saw 0)

## The world after
