---
name: Overdue claims
function: Admin
trigger: [{ every: day, at: '06:30' }, { changes: [Claims] }]
runs: { script: skills/overdue-claims/run.js }
touches: []
---
Says each morning which open claims are past their due date, so none waits unseen.
