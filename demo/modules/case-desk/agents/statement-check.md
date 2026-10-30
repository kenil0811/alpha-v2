---
name: Statement check
function: Finance
trigger: { every: day, at: '08:00' }
runs: { script: skills/statement-check/run.js }
touches: []
---
Sets the payments still late or being chased against the bank statement filed on a Payments row,
and says which to look at. With no statement filed, it stops and says so.
