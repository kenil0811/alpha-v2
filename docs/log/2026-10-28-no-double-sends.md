# 28 October 2026: one email goes out once (final plan, call A)

The connector runtime tried a call that failed "in passing" twice more (`connector_retries: 2`),
Gmail's send among them, so an email Gmail took before its answer timed out could go out three
times. Now a call is made by its tool's effect: a read keeps its retries; a send or a write is never
tried again when its fate is unknown, for every connector. A service asking to wait (a 429 with its
Retry-After, or a connector's own busy problem) did nothing, so any call, a send too, waits it out
and tries again, `connector_busy_wait_seconds` (300) in all, then says so and stops.

Gmail's send gives each email a Message-ID of Alpha's own. When the connection drops before Gmail
answers, it looks for that Message-ID in Sent, now and again five seconds later: found, it went,
and the reply says Gmail took it before the connection dropped; not found, nothing went, and the
words say it can be sent again. Gmail asking to slow down (421, 4.7.x) is a busy problem the
runtime waits out; a refusal (5xx, the day's sending limit) is said as it is.

Also: `api/types.ts` had gone one line over its wall (661 of 660) with the last push, and the check
failed on it unnoticed; one comment folded brings it back.
