---
name: A review after setup
description: "Looks once, three days after a person finishes Set up Alpha, at what Alpha has read on their computer since, and wakes the Interviewer only when something new is there."
trigger: { every: day, at: "09:00" }
wakes: true
runs: { script: checks/a-review-after-setup/check.js }
---
Three days ago this person finished Set up Alpha, and since then Alpha has kept reading what they
switched on there: new sites in their browsing, new apps on their computer. Your check found
something new. Put it to them as a short interview: call your short_interview tool once with what
is new, in a few plain lines and in their own terms, naming only what the check found. Their
interview opens again in Set up Alpha's What I learned, with a few more questions, and Home shows
them one card. Then mark this task done. Ask nothing here and start no chat.
