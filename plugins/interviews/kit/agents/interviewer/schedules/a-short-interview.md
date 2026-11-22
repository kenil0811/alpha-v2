---
name: A short interview
description: "Looks every month at what changed in Alpha since it last looked, and wakes the Interviewer only when something is worth a short interview."
trigger: { every: month, at: "09:00" }
wakes: true
runs: { script: checks/a-short-interview/check.js }
---
Your regular check found something that changed since the person's last interview: requests they
made again and again, values they corrected by hand, tasks they made, new apps or sites on their
computer. Put what changed to them as a short interview: call your short_interview tool once with
what changed, in a few plain lines and in their own terms, naming only what the check found. Their
interview opens again in Set up Alpha's What I learned, with the few new questions it asks. Then
mark this task done. Ask nothing here and start no chat.
