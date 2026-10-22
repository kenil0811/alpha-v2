---
description: Keeps how close each person in a circle is, and finds the follow-ups.
name: Closeness
trigger: { changes: [Members, Circles, Closeness rules, Follow-ups, Notes, Mail, Events] }
runs: { script: skills/closeness/run.js }
touches: [Closeness, Follow-ups]
---
Keeps how close each person in a circle is, by the person's own rules in Closeness rules, with the
rule and the numbers beside it. In the circles the person keeps warm, someone with no message or
meeting for longer than the circle's days is a follow-up: those found together wait on one card,
Draft a note or Not now. A note is drafted from the words in Notes, for the person's yes, to one
address at a time.
